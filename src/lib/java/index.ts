// run java in the browser. javac + TeaVM (compiled to WasmGC) live in a warm worker that turns
// .java into .wasm, and every run gets a fresh worker that is killed when it's done or out of time.
// the workers are plain JS in public/java/ (the TeaVM runtime must not go through a bundler).
// nothing here touches window/Worker at import time, so this is safe to import anywhere.

export type JavaStatus = 'idle' | 'loading' | 'ready' | 'error';

export type JavaDiagnostic = {
  severity: 'error' | 'warning';
  line: number; // 1-based, 0 when the compiler doesn't know
  column?: number; // 1-based
  message: string;
  file?: string; // key from the files you passed in
};

export type RunResult = {
  ok: boolean; // compiled and main() finished without an uncaught exception
  stdout: string;
  stderr: string; // includes javac-style errors and `Exception in thread "main" ...` traces
  diagnostics: JavaDiagnostic[];
  compileMs: number;
  runMs: number;
  timedOut?: boolean;
  deadlocked?: boolean; // main() never returned and nothing else can run (a real JVM would hang)
  exception?: string; // e.g. "java.lang.ArithmeticException: / by zero" when main died
  truncated?: boolean; // output hit maxOutputChars and the program was stopped
  aborted?: boolean; // opts.signal fired
  error?: string; // the runtime itself failed (couldn't load, compiler crashed, ...)
};

export type RunOptions = {
  timeoutMs?: number; // wall clock limit for main(), default 5000
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  signal?: AbortSignal; // abort to stop a running program
  mainClass?: string; // which class to run when several have a main()
  maxOutputChars?: number; // default 1_000_000
};

const DEFAULT_TIMEOUT_MS = 5000;
const INIT_TIMEOUT_MS = 180_000; // first load pulls ~7MB (about 3.7MB with brotli), give slow networks room
const COMPILE_TIMEOUT_MS = 30_000;
const LOAD_TIMEOUT_MS = 15_000; // compiled program has to start within this

// ---------- config ----------

let assetBase = '/java/';

/** where public/java/ is served from. only needed with a basePath (e.g. `/docs/java/`). */
export function configureJava(opts: { assetBase?: string }): void {
  if (opts.assetBase) assetBase = opts.assetBase.endsWith('/') ? opts.assetBase : opts.assetBase + '/';
}

function workerUrl(name: string): URL {
  return new URL(name, new URL(assetBase, self.location.href));
}

/** true when this browser can run the compiler (needs WebAssembly GC). */
export function isJavaSupported(): boolean {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof WebAssembly !== 'object') return false;
  try {
    // (module (type (struct (field (mut i32)))))
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 0x5f, 1, 0x7f, 1]));
  } catch {
    return false;
  }
}

// ---------- status ----------

let status: JavaStatus = 'idle';
const subscribers = new Set<(s: JavaStatus) => void>();

function setStatus(next: JavaStatus) {
  if (next === status) return;
  status = next;
  for (const cb of subscribers) {
    try {
      cb(next);
    } catch {
      // a broken subscriber shouldn't break the runtime
    }
  }
}

export function javaStatus(): JavaStatus {
  return status;
}

/** works as the `subscribe` half of useSyncExternalStore (with javaStatus as the snapshot). */
export function subscribeJavaStatus(cb: (s: JavaStatus) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ---------- compiler worker ----------

type CompilerReply = {
  id: number;
  type: 'ready' | 'compiled' | 'error';
  message?: string;
  ok?: boolean;
  wasm?: ArrayBuffer;
  mainClass?: string;
  launcher?: boolean;
  diagnostics?: (Omit<JavaDiagnostic, 'severity'> & { severity: 'error' | 'warning' | 'other' })[];
  javacMs?: number;
  teavmMs?: number;
};

let compiler: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (m: CompilerReply) => void; reject: (e: Error) => void }>();
let compileQueue: Promise<unknown> = Promise.resolve();

function killCompiler(reason: Error) {
  compiler?.terminate();
  compiler = null;
  readyPromise = null;
  for (const p of pending.values()) p.reject(reason);
  pending.clear();
}

function spawnCompiler(): Worker {
  const w = new Worker(workerUrl('compiler.worker.js'), { type: 'module', name: 'java-compiler' });
  w.onmessage = (e: MessageEvent<CompilerReply>) => {
    const p = pending.get(e.data?.id);
    if (!p) return;
    pending.delete(e.data.id);
    p.resolve(e.data);
  };
  w.onerror = (e) => {
    e.preventDefault();
    killCompiler(new Error('the compiler worker crashed' + (e.message ? ': ' + e.message : '')));
    setStatus('error');
  };
  return w;
}

function ask(msg: Record<string, unknown>, timeoutMs: number): Promise<CompilerReply> {
  const w = compiler;
  if (!w) return Promise.reject(new Error('the compiler is not running'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      killCompiler(new Error(`the compiler did not answer within ${Math.round(timeoutMs / 1000)}s, so it was restarted`));
      setStatus('idle');
    }, timeoutMs);
    pending.set(id, {
      resolve: (m) => {
        clearTimeout(timer);
        resolve(m);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ ...msg, id });
  });
}

/** downloads and warms up the compiler. idempotent, retries after an error. */
export function preloadJava(): Promise<void> {
  if (readyPromise) return readyPromise;
  if (!isJavaSupported()) {
    setStatus('error');
    const p = Promise.reject(new Error('this browser cannot run the java compiler (it needs WebAssembly GC: chrome 119+, firefox 120+, safari 18.2+)'));
    p.catch(() => {});
    return p;
  }
  setStatus('loading');
  compiler = spawnCompiler();
  const p: Promise<void> = ask({ type: 'init' }, INIT_TIMEOUT_MS)
    .then((m) => {
      if (m.type !== 'ready') throw new Error(m.message || 'the compiler failed to start');
      setStatus('ready');
      spareRunner ??= spawnRunner();
    })
    .catch((err: Error) => {
      if (readyPromise === p) killCompiler(err);
      setStatus('error');
      throw err;
    });
  readyPromise = p;
  p.catch(() => {}); // callers that fire and forget shouldn't see unhandled rejections
  return p;
}

// ---------- runner workers ----------

let spareRunner: Worker | null = null;

function spawnRunner(): Worker {
  return new Worker(workerUrl('runner.worker.js'), { type: 'module', name: 'java-program' });
}

function takeRunner(): Worker {
  const w = spareRunner ?? spawnRunner();
  spareRunner = null;
  return w;
}

type RunnerMessage =
  | { type: 'loaded' }
  | { type: 'out'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'truncated' }
  | { type: 'exit'; status: 'ok' | 'exception' | 'blocked' | 'error'; exception?: string; runMs: number };

function execute(wasm: ArrayBuffer, launcher: boolean, opts: RunOptions, result: RunResult): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const w = takeRunner();
    let t0 = 0;
    let runTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      clearTimeout(runTimer);
      opts.signal?.removeEventListener('abort', onAbort);
      w.terminate();
      if (!result.runMs && t0) result.runMs = performance.now() - t0;
      // have a fresh one ready for the next run
      if (!spareRunner && status === 'ready') spareRunner = spawnRunner();
      resolve();
    };
    const onAbort = () => {
      result.aborted = true;
      done();
    };
    const loadTimer = setTimeout(() => {
      result.error = 'the compiled program did not start in time';
      done();
    }, LOAD_TIMEOUT_MS);

    w.onmessage = (e: MessageEvent<RunnerMessage>) => {
      const m = e.data;
      if (settled) return;
      if (m.type === 'loaded') {
        clearTimeout(loadTimer);
        t0 = performance.now();
        runTimer = setTimeout(() => {
          result.timedOut = true;
          result.runMs = performance.now() - t0;
          done();
        }, timeoutMs);
      } else if (m.type === 'out') {
        if (m.stream === 'stdout') {
          result.stdout += m.text;
          opts.onStdout?.(m.text);
        } else {
          result.stderr += m.text;
          opts.onStderr?.(m.text);
        }
      } else if (m.type === 'truncated') {
        result.truncated = true;
        done();
      } else if (m.type === 'exit') {
        result.runMs = m.runMs;
        if (m.status === 'ok') result.ok = true;
        else if (m.status === 'exception') result.exception = m.exception;
        else if (m.status === 'blocked') {
          result.deadlocked = true;
          const note = 'the main thread is waiting forever (deadlock?), so the program was stopped. a real JVM would hang here.\n';
          result.stderr += note;
          opts.onStderr?.(note);
        } else result.error = m.exception;
        done();
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      result.error = 'the program worker crashed' + (e.message ? ': ' + e.message : '');
      done();
    };
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener('abort', onAbort);
    w.postMessage({ type: 'run', wasm, launcher, maxOutputChars: opts.maxOutputChars ?? 1_000_000 }, [wasm]);
  });
}

// ---------- public run ----------

const TYPE_DECL = /\bpublic\s+(?:(?:abstract|final|sealed|non-sealed|strictfp|static)\s+)*(?:class|interface|enum|record|@\s*interface)\s+([A-Za-z_$][\w$]*)/;

/** `public class X` → X.java, otherwise Main.java (which also names a compact source file's class Main). */
export function javaFileName(source: string): string {
  const code = source.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
  const m = TYPE_DECL.exec(code);
  return (m ? m[1] : 'Main') + '.java';
}

// javac-ish text, so a plain console still shows something useful
function formatDiagnostics(diags: JavaDiagnostic[], files: Record<string, string>): string {
  if (!diags.length) return '';
  const out: string[] = [];
  for (const d of diags) {
    const where = d.file ? `${d.file}:${d.line > 0 ? d.line + ':' : ''} ` : '';
    const [first, ...rest] = d.message.split('\n');
    out.push(`${where}${d.severity}: ${first}`, ...rest);
    const src = d.file ? files[d.file] : undefined;
    if (src && d.line > 0) {
      const text = src.split('\n')[d.line - 1];
      if (text !== undefined) {
        out.push(text.replace(/\t/g, '    '));
        if (d.column) out.push(' '.repeat(Math.max(0, text.slice(0, d.column - 1).replace(/\t/g, '    ').length)) + '^');
      }
    }
  }
  const errors = diags.filter((d) => d.severity === 'error').length;
  const warnings = diags.length - errors;
  if (errors) out.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings) out.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return out.join('\n') + '\n';
}

/**
 * compile and run java. a string is one file (named after its public class, else Main.java),
 * or pass { 'Main.java': src, 'Util.java': src }. never throws: problems land in the result.
 */
export async function runJava(input: Record<string, string> | string, opts: RunOptions = {}): Promise<RunResult> {
  const files = typeof input === 'string' ? { [javaFileName(input)]: input } : { ...input };
  const result: RunResult = { ok: false, stdout: '', stderr: '', diagnostics: [], compileMs: 0, runMs: 0 };
  const fail = (message: string) => {
    result.error = message;
    result.stderr += message + '\n';
    opts.onStderr?.(message + '\n');
    return result;
  };

  try {
    await preloadJava();
  } catch (err) {
    return fail(`couldn't start java: ${(err as Error).message}`);
  }

  const preferred = opts.mainClass ?? Object.keys(files)[0]?.split('/').pop()?.replace(/\.java$/, '');
  const t0 = performance.now();
  let reply: CompilerReply;
  try {
    // one compile at a time. re-check the compiler, an earlier job may have crashed or timed it out.
    const job = compileQueue.then(async () => {
      await preloadJava();
      return ask({ type: 'compile', files, mainClass: preferred }, COMPILE_TIMEOUT_MS);
    });
    compileQueue = job.catch(() => {});
    reply = await job;
  } catch (err) {
    result.compileMs = performance.now() - t0;
    return fail((err as Error).message);
  }
  result.compileMs = performance.now() - t0;
  if (reply.type === 'error') return fail(reply.message || 'the compiler failed');

  result.diagnostics = (reply.diagnostics ?? [])
    .filter((d): d is JavaDiagnostic => d.severity === 'error' || d.severity === 'warning')
    .map(({ severity, line, column, message, file }) => ({ severity, line, message, ...(column ? { column } : {}), ...(file ? { file } : {}) }));
  if (!reply.ok || !reply.wasm) {
    const text = formatDiagnostics(result.diagnostics, files);
    if (text) {
      result.stderr += text;
      opts.onStderr?.(text);
    }
    return result;
  }
  if (opts.signal?.aborted) {
    result.aborted = true;
    return result;
  }

  await execute(reply.wasm, !!reply.launcher, opts, result);
  return result;
}
