// java.lang.everything: compiler worker (module worker, stays warm).
// loads teavm-javac (OpenJDK javac + TeaVM compiled to WasmGC) and turns .java sources into a .wasm module.
// protocol (all messages carry `id`):
//   → { type: 'init' }                          ← { type: 'ready', initMs } | { type: 'error', message }
//   → { type: 'compile', files: {path: src} }   ← { type: 'compiled', ok, wasm?, mainClass?, diagnostics, javacMs, teavmMs }
// plain JS on purpose: the TeaVM runtime sniffs `typeof process` and uses dynamic import(),
// so it must not go through a bundler.

const TEAVM = new URL('./teavm/0.16.0-jle1/', import.meta.url);

let compilerPromise = null;
let inputsPromise = null; // classlib bytes survive a compiler restart

async function fetchBytes(name) {
  const res = await fetch(new URL(name, TEAVM));
  if (!res.ok) throw new Error(`could not fetch ${name}: HTTP ${res.status}`);
  return new Int8Array(await res.arrayBuffer());
}

function getCompiler() {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      if (!inputsPromise) {
        inputsPromise = Promise.all([fetchBytes('compile-classlib-teavm.bin'), fetchBytes('runtime-classlib-teavm.bin')]);
        inputsPromise.catch(() => {
          inputsPromise = null;
        });
      }
      const { load } = await import(new URL('compiler.wasm-runtime.js', TEAVM).href);
      const [teavm, [sdk, classlib]] = await Promise.all([load(new URL('compiler.wasm', TEAVM).href), inputsPromise]);
      const compiler = teavm.exports.createCompiler();
      compiler.setSdk(sdk); // class stubs javac compiles against (the JDK 25 API, minus what TeaVM can't do)
      compiler.setTeaVMClasslib(classlib); // TeaVM's actual implementation of those classes
      return compiler;
    })();
    compilerPromise.catch(() => {
      compilerPromise = null;
    });
  }
  return compilerPromise;
}

function normDiag(d, phase) {
  const severity = d.severity === 'error' || d.severity === 'ERROR' ? 'error' : d.severity === 'warning' ? 'warning' : 'other';
  const line = typeof d.lineNumber === 'number' && d.lineNumber > 0 ? d.lineNumber : 0;
  const out = { severity, line, message: String(d.message ?? ''), phase };
  if (phase === 'javac' && typeof d.columnNumber === 'number' && d.columnNumber > 0) out.column = d.columnNumber;
  if (d.fileName) out.file = String(d.fileName).replace(/^\/+/, '');
  return out;
}

// --- tiny class file reader: just enough to find main methods (JEP 512 launch protocol) ---
const ACC_PUBLIC = 0x1, ACC_PRIVATE = 0x2, ACC_STATIC = 0x8, ACC_INTERFACE = 0x200, ACC_ABSTRACT = 0x400;

function readClassInfo(bytes) {
  const u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
  let p = 8; // magic + minor + major
  const cpCount = dv.getUint16(p); p += 2;
  const utf8 = new Array(cpCount);
  const classIdx = new Array(cpCount);
  const dec = new TextDecoder();
  for (let i = 1; i < cpCount; i++) {
    const tag = u8[p++];
    switch (tag) {
      case 1: { const len = dv.getUint16(p); p += 2; utf8[i] = dec.decode(u8.subarray(p, p + len)); p += len; break; }
      case 7: classIdx[i] = dv.getUint16(p); p += 2; break;
      case 8: case 16: case 19: case 20: p += 2; break;
      case 15: p += 3; break;
      case 3: case 4: case 9: case 10: case 11: case 12: case 17: case 18: p += 4; break;
      case 5: case 6: p += 8; i++; break;
      default: throw new Error('bad constant pool tag ' + tag);
    }
  }
  const access = dv.getUint16(p); p += 2;
  const name = utf8[classIdx[dv.getUint16(p)]]; p += 2;
  p += 2; // super
  const ifaces = dv.getUint16(p); p += 2 + ifaces * 2;
  const skipMembers = (collect) => {
    const n = dv.getUint16(p); p += 2;
    for (let i = 0; i < n; i++) {
      const acc = dv.getUint16(p), mName = utf8[dv.getUint16(p + 2)], desc = utf8[dv.getUint16(p + 4)];
      p += 6;
      const attrs = dv.getUint16(p); p += 2;
      for (let a = 0; a < attrs; a++) { const len = dv.getUint32(p + 2); p += 6 + len; }
      if (collect) collect.push({ access: acc, name: mName, desc });
    }
  };
  skipMembers(null);
  const methods = [];
  skipMembers(methods);
  return { name, access, methods };
}

// figures out how a launcher should call main, following the java 25 launch protocol:
// static main(String[]) > static main() > instance main(String[]) > instance main()
function mainShape(info) {
  const nonPrivate = (m) => (m.access & ACC_PRIVATE) === 0;
  const isStatic = (m) => (m.access & ACC_STATIC) !== 0;
  const mains = info.methods.filter((m) => m.name === 'main' && nonPrivate(m) && (m.desc === '([Ljava/lang/String;)V' || m.desc === '()V'));
  const order = [
    (m) => isStatic(m) && m.desc !== '()V',
    (m) => isStatic(m) && m.desc === '()V',
    (m) => !isStatic(m) && m.desc !== '()V',
    (m) => !isStatic(m) && m.desc === '()V',
  ];
  for (const test of order) {
    const m = mains.find(test);
    if (!m) continue;
    if (!isStatic(m)) {
      if (info.access & (ACC_INTERFACE | ACC_ABSTRACT)) return null;
      const ctor = info.methods.find((c) => c.name === '<init>' && c.desc === '()V' && nonPrivate(c));
      if (!ctor) return null;
    }
    return { isStatic: isStatic(m), withArgs: m.desc !== '()V' };
  }
  return null;
}

const LAUNCHER = '__JleLauncher';

// a launcher that catches whatever main throws and prints it like the real `java` launcher does.
// then rethrows, so the runner knows the program died.
function launcherSource(mainClass, shape) {
  const dot = mainClass.lastIndexOf('.');
  const pkg = dot >= 0 ? mainClass.slice(0, dot) : '';
  const simple = dot >= 0 ? mainClass.slice(dot + 1) : mainClass;
  const target = shape.isStatic ? simple : `new ${simple}()`;
  const call = `${target}.main(${shape.withArgs ? 'args' : ''})`;
  // the exit marker tells the runner that main() actually returned (vs. its thread being stuck forever)
  return `${pkg ? `package ${pkg};\n` : ''}final class ${LAUNCHER} {
  public static void main(String[] args) throws Throwable {
    try {
      ${call};
    } catch (Throwable t) {
      System.err.print("Exception in thread \\"main\\" ");
      t.printStackTrace();
      throw t;
    }
    System.err.print("\\u0000jle-exit\\n");
  }
}
`;
}

function pickMainClass(candidates, preferred) {
  const names = candidates.map((c) => String(c).replace(/\//g, '.'));
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (preferred) {
    const hit = names.find((n) => n === preferred || n.endsWith('.' + preferred));
    if (hit) return hit;
  }
  return names.find((n) => n === 'Main' || n.endsWith('.Main')) ?? names[0];
}

// pass 2: compile the launcher against the user's classes (as class files, so compact source
// files' implicitly declared classes can be referenced). falls back to the plain main class on any trouble.
function addLauncher(compiler, mainClass) {
  const classFile = compiler.getOutputFile(mainClass.replace(/\./g, '/') + '.class');
  if (!classFile) return null;
  const shape = mainShape(readClassInfo(classFile));
  if (!shape) return null;
  const userOutputs = Array.from(compiler.listOutputFiles()).map((n) => [n, compiler.getOutputFile(n)]);
  const dot = mainClass.lastIndexOf('.');
  const pkg = dot >= 0 ? mainClass.slice(0, dot) : '';
  let ok = false;
  try {
    compiler.clearSourceFiles();
    compiler.clearInputClassFiles();
    for (const [n, b] of userOutputs) compiler.addClassFile(n, b);
    compiler.clearOutputFiles();
    compiler.addSourceFile((pkg ? pkg.replace(/\./g, '/') + '/' : '') + LAUNCHER + '.java', launcherSource(mainClass, shape));
    ok = compiler.compile();
  } catch {
    ok = false;
  }
  if (!ok) compiler.clearOutputFiles();
  for (const [n, b] of userOutputs) compiler.addOutputClassFile(n, b);
  compiler.clearInputClassFiles();
  return ok ? (pkg ? pkg + '.' : '') + LAUNCHER : null;
}

async function compile(req) {
  const compiler = await getCompiler();
  try {
    return compileWith(compiler, req);
  } catch (err) {
    // javac/TeaVM running as wasm can trap (e.g. constant folding Integer.MIN_VALUE / -1). a trap skips
    // their finally blocks and leaves the instance half-initialised, so throw it away and start fresh next time.
    compilerPromise = null;
    console.warn('[java] compiler crashed', err && err.stack);
    const detail = describeError(err);
    throw new Error('the compiler crashed on this code (a bug in javac/TeaVM running as WebAssembly, not in your code)' + (detail && !detail.startsWith('(could not') ? ': ' + detail : '') + '. it restarts on the next run.');
  }
}

function compileWith(compiler, { files, mainClass: preferred, warmup, launcher = true }) {
  const diagnostics = [];
  let collect = true;
  let fileNames = new Map();
  const reg = compiler.onDiagnostic((d) => {
    if (!collect) return;
    const nd = normDiag(d, d.type === 'teavm' ? 'teavm' : 'javac');
    if (nd.file && fileNames.has(nd.file)) nd.file = fileNames.get(nd.file);
    diagnostics.push(nd);
  });
  try {
    compiler.clearSourceFiles();
    compiler.clearInputClassFiles();
    compiler.clearOutputFiles(); // otherwise stale classes from the last run leak onto the classpath
    // this javac build wants flat file names ("app/Hello.java" fails the public-class/file-name check),
    // so we pass basenames and map diagnostics back to whatever the caller called the file.
    const names = new Map();
    for (const [path, src] of Object.entries(files)) {
      const base = path.split('/').pop();
      if (names.has(base)) {
        diagnostics.push({ severity: 'error', line: 0, phase: 'javac', file: path, message: `two files are both called ${base}. file names have to be unique.` });
        return { ok: false, diagnostics, javacMs: 0, teavmMs: 0 };
      }
      names.set(base, path);
      compiler.addSourceFile(base, src);
    }
    fileNames = names;

    const t0 = performance.now();
    let ok = compiler.compile();
    if (!ok) return { ok: false, diagnostics, javacMs: performance.now() - t0, teavmMs: 0 };

    const mainClass = pickMainClass(Array.from(compiler.detectMainClasses()), preferred);
    if (!mainClass) {
      diagnostics.push({ severity: 'error', line: 0, phase: 'teavm', message: 'no main method found. add `public static void main(String[] args)` (or `void main()`).' });
      return { ok: false, diagnostics, javacMs: performance.now() - t0, teavmMs: 0 };
    }
    let entry = mainClass;
    if (launcher) {
      collect = false;
      try {
        entry = addLauncher(compiler, mainClass) ?? mainClass;
      } catch {
        entry = mainClass;
      }
      collect = true;
    }
    const javacMs = performance.now() - t0;

    const t1 = performance.now();
    ok = compiler.generateWebAssembly({ outputName: 'app', mainClass: entry, strictMode: true, obfuscated: true });
    const teavmMs = performance.now() - t1;
    if (!ok) {
      if (!diagnostics.some((d) => d.severity === 'error')) {
        diagnostics.push({ severity: 'error', line: 0, phase: 'teavm', message: 'TeaVM could not translate this program to WebAssembly.' });
      }
      return { ok: false, mainClass, diagnostics, javacMs, teavmMs };
    }
    if (warmup) return { ok: true, mainClass, launcher: entry !== mainClass, diagnostics, javacMs, teavmMs };
    const bytes = compiler.getWebAssemblyOutputFile('app.wasm');
    // copy into a fresh ArrayBuffer we can transfer
    const wasm = new Uint8Array(bytes.length);
    wasm.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length));
    return { ok: true, mainClass, launcher: entry !== mainClass, wasm: wasm.buffer, diagnostics, javacMs, teavmMs };
  } finally {
    reg.destroy();
  }
}

const WARMUP_SRC = 'public class Main { public static void main(String[] args) { System.out.println("warm " + java.util.List.of(1, 2).stream().map(x -> x * 2).toList()); } }';

self.onmessage = async (event) => {
  const msg = event.data || {};
  const { id } = msg;
  try {
    if (msg.type === 'init') {
      const t0 = performance.now();
      await getCompiler();
      const loadMs = performance.now() - t0;
      let warmupMs = 0;
      if (msg.warmup !== false) {
        // first javac + TeaVM pass is much slower (class loading, caches). pay it during preload.
        const t1 = performance.now();
        await compile({ files: { 'Main.java': WARMUP_SRC }, warmup: true, launcher: true });
        warmupMs = performance.now() - t1;
      }
      self.postMessage({ id, type: 'ready', loadMs, warmupMs });
    } else if (msg.type === 'compile') {
      const result = await compile(msg);
      self.postMessage({ id, type: 'compiled', ...result }, result.wasm ? [result.wasm] : []);
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', message: describeError(err) });
  }
};

function describeError(err) {
  if (err && typeof err === 'object') {
    const m = err.message || String(err);
    return m;
  }
  return String(err);
}
