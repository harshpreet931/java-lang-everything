// java.lang.everything: runner worker (module worker, one per run, terminated by the page on timeout).
// protocol:
//   → { type: 'run', wasm: ArrayBuffer, launcher: boolean, maxOutputChars: number }
//   ← { type: 'loaded' }                                   module instantiated, main() is about to start
//   ← { type: 'out', stream: 'stdout' | 'stderr', text }   streamed output, in order across both streams
//   ← { type: 'truncated' }                                output cap hit, the page should kill us
//   ← { type: 'exit', status: 'ok' | 'exception' | 'blocked' | 'error', exception?, runMs }
// plain JS on purpose (see compiler.worker.js).

const TEAVM = new URL('./teavm/0.16.0-jle1/', import.meta.url);
const DEOBFUSCATOR = new URL('compiler.wasm-deobfuscator.wasm', TEAVM).href;
const runtimePromise = import(new URL('compiler.wasm-runtime.js', TEAVM).href);
runtimePromise.catch(() => {});

Error.stackTraceLimit = 64;

const post = (m) => self.postMessage(m);

// ---------- output: UTF-16 code units in, ordered chunks out ----------

let maxOutputChars = 1_000_000;
let totalChars = 0;
let truncated = false;
let bufStream = null;
let buf = '';
// rate limit: lines go out as they're printed, until a print loop does more than 64 posts in 50ms.
// then we batch (at most one post per 16ms) so the page isn't flooded with messages.
let lastPost = -Infinity;
let windowStart = -Infinity;
let postsInWindow = 0;

function flush() {
  if (buf && bufStream) {
    post({ type: 'out', stream: bufStream, text: buf });
    const now = performance.now();
    if (now - windowStart > 50) {
      windowStart = now;
      postsInWindow = 0;
    }
    postsInWindow++;
    lastPost = now;
  }
  buf = '';
}

function lineFlushAllowed() {
  const now = performance.now();
  return now - windowStart > 50 || postsInWindow < 64 || now - lastPost >= 16;
}

function pushText(stream, text) {
  if (truncated || !text) return;
  if (bufStream !== stream) {
    flush();
    bufStream = stream;
  }
  if (totalChars + text.length > maxOutputChars) {
    buf += text.slice(0, Math.max(0, maxOutputChars - totalChars));
    totalChars = maxOutputChars;
    truncated = true;
    flush();
    post({ type: 'truncated' });
    return;
  }
  totalChars += text.length;
  buf += text;
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) return; // never split a surrogate pair across chunks
  if (buf.length >= 16384 || (last === 10 && lineFlushAllowed())) flush();
}

// System.out → putcharStdout(UTF-16 code unit)
function putStdout(code) {
  pushText('stdout', String.fromCharCode(code));
}

// System.err is handled a line at a time so stack traces can be cleaned up before they're shown.
// our launcher prints EXIT_MARKER on stderr when main() returns normally.
const EXIT_MARKER = '\u0000jle-exit';
let mainCompleted = false;
let stderrLine = '';
function putStderr(code) {
  if (code === 10) {
    let raw = stderrLine;
    stderrLine = '';
    if (raw.endsWith(EXIT_MARKER)) {
      mainCompleted = true;
      raw = raw.slice(0, -EXIT_MARKER.length);
      if (raw) pushText('stderr', cleanStderrLine(raw) ?? '');
      return;
    }
    const line = cleanStderrLine(raw);
    if (line !== null) pushText('stderr', line + '\n');
  } else {
    stderrLine += String.fromCharCode(code);
    if (stderrLine.length > 8192) {
      pushText('stderr', stderrLine);
      stderrLine = '';
    }
  }
}

function writeStderr(text) {
  for (let i = 0; i < text.length; i++) putStderr(text.charCodeAt(i));
}

function endOutput() {
  if (stderrLine) {
    const line = cleanStderrLine(stderrLine);
    stderrLine = '';
    if (line !== null) pushText('stderr', line);
  }
  flush();
}

// ---------- stack trace cleanup ----------
// TeaVM's traces include its own runtime frames, the classlib's constructor chain and our launcher.
// the real JVM hides all of that, so we do too.

const FRAME = /^\tat (.+)\.([^.(]+)\((.*)\)$/;
const HEADER = /^(?:Exception in thread "[^"]*" |Caused by: |\s*Suppressed: )?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?::\s|$)/;
const MAIN_HEADER = 'Exception in thread "main" ';

let headerClass = null; // class of the exception whose frames we're reading
let inLeadingCtors = false;
let uncaughtHeader = null; // first `Exception in thread "main" X: msg` seen

function cleanStderrLine(line) {
  const m = FRAME.exec(line);
  if (!m) {
    const h = HEADER.exec(line);
    if (h && (h[1].includes('.') || /(Exception|Error|Throwable)$/.test(h[1]))) {
      headerClass = h[1];
      inLeadingCtors = true;
    } else {
      headerClass = null;
      inLeadingCtors = false;
    }
    if (uncaughtHeader === null && line.startsWith(MAIN_HEADER)) uncaughtHeader = line.slice(MAIN_HEADER.length);
    return line;
  }
  const [, cls, method, where] = m;
  if (cls.startsWith('org.teavm.') || method.includes('$caller$exported') || cls === '__JleLauncher' || cls.endsWith('.__JleLauncher')) {
    return null;
  }
  if (inLeadingCtors) {
    const ctorish = method === 'fillInStackTrace' || method === '<init>';
    const throwableClass = cls === headerClass || cls.startsWith('java.') || /(Exception|Error|Throwable)$/.test(cls);
    if (ctorish && throwableClass) return null;
    inLeadingCtors = false;
  }
  // TeaVM's classlib lives in files like TArrayList.java with TeaVM's own line numbers. show ArrayList.java instead.
  const file = /^javax?\./.test(cls) ? where.replace(/^T([A-Z][\w$]*\.java)(?::\d+)?$/, '$1') : where;
  return `\tat ${cls}.${method}(${file})`;
}

// ---------- uncaught stuff: wasm traps and java exceptions without our launcher ----------

// TeaVM's runtime marks java exceptions crossing into JS with Symbol("javaException")
function isJavaException(err) {
  return !!err && typeof err === 'object' && Object.getOwnPropertySymbols(err).some((s) => s.description === 'javaException');
}

// what the JVM would have thrown. engines word their traps differently, so match loosely.
function trapToJava(err) {
  const msg = String((err && err.message) || err);
  if ((err instanceof RangeError && /call stack/i.test(msg)) || /too much recursion/i.test(msg)) return 'java.lang.StackOverflowError';
  if (/unrepresentable|overflow/i.test(msg)) return null; // e.g. Integer.MIN_VALUE / -1, which java defines as MIN_VALUE
  if (/divi|remainder|by zero/i.test(msg)) return 'java.lang.ArithmeticException: / by zero';
  if (/out of bounds|index/i.test(msg)) return 'java.lang.ArrayIndexOutOfBoundsException';
  if (/null/i.test(msg)) return 'java.lang.NullPointerException';
  if (/cast/i.test(msg)) return 'java.lang.ClassCastException';
  if (/too large|out of memory|allocation/i.test(msg)) return 'java.lang.OutOfMemoryError';
  return null;
}

let deobfuscatorPromise = null;
async function deobfuscate(wasmBytes, stack) {
  const addresses = [];
  for (const line of String(stack || '').split('\n')) {
    const m = /wasm-function\[\d+\]:0x([0-9a-f]+)/.exec(line);
    if (m) addresses.push(parseInt(m[1], 16));
  }
  if (!addresses.length) return fallbackFrames(stack);
  try {
    if (!deobfuscatorPromise) {
      deobfuscatorPromise = (async () => {
        const { defaults } = await runtimePromise;
        const imports = {};
        const ctl = defaults(imports, {}, {});
        const mod = await WebAssembly.compileStreaming(fetch(DEOBFUSCATOR), { builtins: ['js-string'] });
        const instance = await WebAssembly.instantiate(mod, imports);
        ctl.supplyExports(instance.exports);
        return instance;
      })();
    }
    const instance = await deobfuscatorPromise;
    const userModule = await WebAssembly.compile(wasmBytes, { builtins: ['js-string'] });
    const frames = instance.exports.createForModule.value(userModule).deobfuscate(addresses) || [];
    const out = [];
    for (const f of frames) {
      out.push({ cls: String(f.className), method: String(f.method), where: f.file ? f.file + (f.line > 0 ? ':' + f.line : '') : 'Unknown Source' });
    }
    return out.length ? out : fallbackFrames(stack);
  } catch {
    return fallbackFrames(stack);
  }
}

// chrome and firefox name wasm frames like "Main::main". better than nothing.
function fallbackFrames(stack) {
  const out = [];
  for (const line of String(stack || '').split('\n')) {
    const m = /([\w$.]+)::([\w$<>]+)/.exec(line);
    if (m) out.push({ cls: m[1], method: m[2], where: 'Unknown Source' });
  }
  return out;
}

async function printUncaught(err, wasmBytes) {
  const frames = await deobfuscate(wasmBytes, err && err.stack);
  let header;
  if (isJavaException(err)) {
    // TeaVM only hands us the message. the class is the last constructor in the chain that built the exception.
    let cls = 'java.lang.Throwable';
    for (const f of frames) {
      if (f.method === 'fillInStackTrace') continue;
      if (f.method !== '<init>') break;
      cls = f.cls;
    }
    header = err.message && err.message !== '(could not fetch message)' ? `${cls}: ${err.message}` : cls;
  } else {
    header = trapToJava(err) ?? `java.lang.InternalError: ${(err && err.message) || err} (WebAssembly trap, a TeaVM limitation)`;
  }
  const cap = 40;
  const lines = frames.slice(0, cap).map((f) => `\tat ${f.cls}.${f.method}(${f.where})`);
  if (frames.length > cap) lines.push(`\t... ${frames.length - cap} more`);
  writeStderr([MAIN_HEADER + header, ...lines].join('\n') + '\n');
  return header;
}

// ---------- run ----------

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type !== 'run') return;
  if (typeof msg.maxOutputChars === 'number') maxOutputChars = msg.maxOutputChars;
  const wasmBytes = new Uint8Array(msg.wasm);

  const timers = new Set();
  let mainDone = false;
  let finished = false;
  let failure = null;
  let t0 = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    endOutput();
    // with the launcher we know whether main() really returned. if it didn't and nothing is scheduled,
    // the main thread is waiting forever (deadlock). a real JVM would hang right here.
    const blocked = !failure && msg.launcher && !mainCompleted;
    post({ type: 'exit', status: failure ? 'exception' : blocked ? 'blocked' : 'ok', exception: failure ?? undefined, runMs: performance.now() - t0 });
  };
  // done = main's fiber returned to JS and no green thread is waiting on a timer
  const maybeFinish = () => {
    if (mainDone && timers.size === 0) finish();
  };
  // a java exception or a wasm trap escaped main (or a resumed green thread)
  const onEscape = async (err) => {
    mainDone = true;
    timers.clear();
    if (failure) return;
    if (isJavaException(err) && msg.launcher) {
      endOutput();
      // the launcher already printed `Exception in thread "main" ...` through System.err
      failure = uncaughtHeader ?? String(err.message);
    } else {
      failure = await printUncaught(err, wasmBytes);
    }
  };

  let teavm;
  try {
    const { load } = await runtimePromise;
    teavm = await load(wasmBytes, {
      stackDeobfuscator: { enabled: true, path: DEOBFUSCATOR },
      installImports(imports) {
        imports.teavmConsole.putcharStdout = putStdout;
        imports.teavmConsole.putcharStderr = putStderr;
        // safari's stack strings have wasm function names but no code offsets ("Main::main@wasm-function[79]"),
        // so TeaVM can't map them and printStackTrace() prints no frames. fall back to the names there.
        const takeStackTrace = imports.teavm.takeStackTrace;
        imports.teavm.takeStackTrace = () => {
          const stack = String(new Error().stack || '');
          if (/wasm-function\[\d+\]:0x[0-9a-f]+/.test(stack)) return takeStackTrace();
          const frames = fallbackFrames(stack).map((f) => ({ className: f.cls, method: f.method, file: null, line: -1 }));
          return { getStack: () => frames };
        };
        // TeaVM's green threads (Thread.sleep, thread switches) resume through these timers
        const { offer, kill } = imports.teavmAsync;
        imports.teavmAsync.offer = (arg, callback, time) => {
          const id = offer(arg, (x) => {
            timers.delete(id);
            if (finished) return;
            try {
              callback(x);
            } catch (err) {
              onEscape(err).then(finish);
              return;
            }
            maybeFinish();
          }, time);
          timers.add(id);
          return id;
        };
        imports.teavmAsync.kill = (id) => {
          timers.delete(id);
          kill(id);
        };
      },
    });
  } catch (err) {
    post({ type: 'exit', status: 'error', exception: 'could not load the compiled program: ' + ((err && err.message) || err), runMs: 0 });
    return;
  }

  post({ type: 'loaded' });
  t0 = performance.now();
  try {
    teavm.exports.main([]);
    mainDone = true;
    maybeFinish();
  } catch (err) {
    await onEscape(err);
    finish();
  }
};
