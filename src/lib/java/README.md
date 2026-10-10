# java in the browser

the "run" button. compiles and runs real java 25 source in the reader's browser. no server, no backend, works on a static export.

## in short

```
your code → javac (OpenJDK, as wasm) → .class → TeaVM (as wasm) → app.wasm → run in a throwaway worker
```

both compilers are [teavm-javac](https://github.com/konsoletyper/teavm-javac): OpenJDK's javac and the TeaVM AOT compiler, compiled to WebAssembly GC. we self-host its files (teavm.org sends no CORS headers) in `public/java/teavm/0.16.0-jle1/`.

## usage

```ts
import { preloadJava, runJava, javaStatus, subscribeJavaStatus } from '@/lib/java';

preloadJava(); // on hover / when a code block scrolls into view. idempotent, never throws unhandled

const r = await runJava(source, {
  timeoutMs: 5000,
  onStdout: (chunk) => append(chunk),
  onStderr: (chunk) => appendRed(chunk),
});
// r = { ok, stdout, stderr, diagnostics, compileMs, runMs, timedOut?, deadlocked?, exception?, truncated?, aborted?, error? }
```

- a string is one file, named after its `public class` (else `Main.java`). or pass `{ 'Main.java': src, 'Util.java': src }`.
- `runJava` never throws. compile errors land in `diagnostics` (1-based `line`, `column`, `file`) **and** in `stderr`, javac style with a caret.
- an uncaught exception ends up in `stderr` like the JVM prints it (`Exception in thread "main" java.lang.ArithmeticException: / by zero` + `at Main.divide(Main.java:19)`), and in `r.exception`.
- `javaStatus()` / `subscribeJavaStatus()` plug straight into `useSyncExternalStore` (server snapshot: `'idle'`).
- also exported: `isJavaSupported()` (hide the button on old browsers), `javaFileName(src)`, `configureJava({ assetBase })` (only if the site gets a basePath), options `signal` (abort = stop button), `mainClass`, `maxOutputChars` (default 1M).
- nothing touches `window` at import time, so it's fine to import from anything. call it from client components.

## how it works

- `compiler.worker.js` (plain JS in `public/java/`, on purpose: TeaVM's loader sniffs `typeof process` and does `import(variable)`, a bundler would break it) loads `compiler.wasm` + the two class library archives once, then does a warm-up compile so the first real run is fast. it stays alive.
- each compile: javac → find `main` (java 25 rules: static `main(String[])` > static `main()` > instance `main(String[])` > instance `main()`) → a tiny generated launcher class wraps `main` in `try/catch` so uncaught exceptions print like the real `java` launcher → TeaVM → `app.wasm`.
- `runner.worker.js` is created fresh per run and terminated afterwards. that's the infinite loop kill switch (`timeoutMs`, measured from when `main` starts). output streams out in order across stdout/stderr, rate limited so a print loop can't flood the page.
- `System.out` arrives as UTF-16 code units, so emoji and CJK are fine (surrogate pairs are never split across chunks).
- stack traces are cleaned up: TeaVM's runtime frames, our launcher and the exception constructor chain are hidden, classlib files show as `ArrayList.java` instead of TeaVM's `TArrayList.java:123`.
- if the compiler itself crashes (it can, see below), it is thrown away and reloaded on the next run.

## what works (tested in chromium 156 and webkit 27, see the matrix in the PR)

classes, interfaces with default/static methods, generics, lambdas, method refs, streams + `Collectors` (`groupingBy`, `partitioningBy`, `joining` ...), records, sealed types, pattern matching `switch` with record patterns and guards, `instanceof` patterns, text blocks, `var`, labeled break/continue, enums with bodies, inner/anonymous/local classes, compact source files (`void main() { IO.println("hi"); }`), multiple files, `String.format`/`printf` (`%d %s %x %c %b %f %,d %n %%`), `StringBuilder`, the `Integer` cache (`127 == 127`, `128 != 128`), `HashMap`, `TreeMap`, `LinkedHashMap`, `ArrayList`, `ArrayDeque`, `PriorityQueue`, `java.time`, `BigInteger`/`BigDecimal`, regex, `Random(seed)`, try/catch/finally, try-with-resources, custom exceptions, cause chains, `e.printStackTrace()`, `Thread` start/join/sleep, `synchronized`, `wait`/`notify`, unicode output, integer overflow, `Math`.

## what doesn't (be honest with readers about these)

**exceptions that are WebAssembly traps.** TeaVM 0.16's WasmGC backend turns these into traps, not java exceptions. they **can't be caught**, so `try { x / 0 } catch (ArithmeticException e)` doesn't work. uncaught, we still print them like the JVM would (class name + stack):
- integer `/ 0` and `% 0` → `ArithmeticException`
- array index out of bounds → `ArrayIndexOutOfBoundsException` (without the "Index 5 out of bounds for length 3" message)
- most implicit null dereferences → `NullPointerException` (`String s = null; s.length()` with a literal null is caught fine)
- stack overflow → `StackOverflowError` (works uncaught, can't be caught)

for chapters that teach catching these, show the output instead of running it.

**other runtime differences from HotSpot**
- casts: a failing cast whose result is never used doesn't throw, and a failing cast followed by unboxing traps as `NullPointerException` instead of `ClassCastException`.
- `Integer.MIN_VALUE / -1` traps (java says `MIN_VALUE`). written as a constant it even crashes javac; the compiler restarts and tells you so.
- `ConcurrentModificationException` is missed when you remove the second-to-last element inside a for-each (the classic middle-element case does throw).
- `EnumSet.allOf(X.class)` is empty if the program never names one of `X`'s constants (`X.values()` or `X.A` anywhere fixes it).
- `HashMap` iteration order differs from HotSpot (it's unspecified anyway, but readers will compare).
- `System.identityHashCode`/`Object.toString()` hashes differ (as they would on any JVM run).
- `Double.compare(0.0, -0.0)` returns 0, `Math.multiplyExact` overflow has a null message, `IntSummaryStatistics.toString()` uses a different format.
- `%e`, `%g` and date/time conversions in `String.format` are not supported (`UnknownFormatConversionException`).
- threads are green threads on one JS thread: no real parallelism, `synchronized`/`wait`/`notify`/`join`/`sleep` work. a deadlocked main thread is reported right away (`r.deadlocked`) instead of hanging.

**missing APIs** (these are compile errors, "cannot find symbol"):
`Scanner` and any stdin (`System.in` reads nothing, `IO.readln` is missing), `System.exit`, `Thread.ofVirtual()`/virtual threads, `Executors`/`ExecutorService`/`CompletableFuture`/`Future`, `java.util.concurrent.locks`, `CountDownLatch`, `Semaphore`, `LinkedBlockingQueue`, `ConcurrentLinkedQueue`, `ForkJoinPool`, `Thread.State`, `StringJoiner`, `HexFormat`, `StackWalker`, stream gatherers, `ProcessHandle`, `MethodHandles.lookup()`. reflection is thin. no files, no network.

**javac crash:** a `switch` with the same record pattern twice on primitive components, one guarded (`case Rect(double w, double h) when w == h -> ...; case Rect(double w, double h) -> ...`) crashes javac-in-wasm (javac 25 needs `ConstantBootstraps` for that, TeaVM doesn't have it). workaround: `case Rect r when r.w() == r.h()`.

**stack traces in safari** have method names but no line numbers (safari doesn't expose wasm code offsets). firefox wasn't tested here (it needs WebAssembly GC, firefox 120+).

## cost

- first run downloads ~6.9MB (`compiler.wasm` 4.3MB, runtime classlib 2.36MB, sdk 0.21MB). with brotli on `.wasm` it's ~3.8MB (the `.bin` files are already gzipped inside). call `preloadJava()` early.
- measured cold preload incl. warm-up compile: ~0.6s on localhost, ~1.1s at 50 Mbps (brotli), ~3.8s at 10 Mbps (brotli), ~6.5s at 10 Mbps uncompressed.
- warm: compile ~200-300ms for small programs, up to ~1s for ones that pull in streams/`java.time` (TeaVM compiles the whole program each time). running is usually under 10ms plus ~5ms to spin up the worker.

## the patched TeaVM files

the playground build we started from has bugs that hit teaching code hard (every `%f` crashed, `getMessage()` didn't compile, `join()` could hang). `0.16.0-jle1` = upstream files + fixes:

- `compile-classlib-teavm.bin` regenerated with teavm-javac's own later fix (`@Rename`), so `getMessage()`, `getClass()`, `toString()`, `clone()`, `wait/notify` exist for javac.
- `runtime-classlib-teavm.bin`: 11 classes patched (`DecimalFormatSymbols.clone`, `Formatter` `%n`/`%%`/half-up rounding, `Thread` join race + names, `Math.round`/`log10`, `Integer/Long/Float/Double.sum`).
- `compiler.wasm`, `compiler.wasm-runtime.js`, `compiler.wasm-deobfuscator.wasm` are untouched.

`teavm-patches/build.sh` rebuilds that folder from teavm.org's files (hash-pinned) with a JDK 21+, deterministically. licenses: `THIRD_PARTY_NOTICES.md`.

## deploying

- `.wasm` must be served as `application/wasm` (vercel does). check whether the host compresses it: `curl -sI -H 'accept-encoding: br' https://<site>/java/teavm/0.16.0-jle1/compiler.wasm`. if not, it's worth shipping a pre-gzipped copy and decompressing in the worker.
- the folder name is versioned, so `Cache-Control: public, max-age=31536000, immutable` on `/java/teavm/**` is safe. bump the folder (and the `TEAVM` constant in both workers) when the files change.
