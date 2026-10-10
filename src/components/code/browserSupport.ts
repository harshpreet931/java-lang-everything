// the in-browser runtime is javac + TeaVM (WasmGC), not a JVM. it runs most teaching code
// exactly like java 25, but a few things are missing or behave differently (see
// src/lib/java/README.md). for those programs we hide the run button and say why,
// instead of showing an answer that real java wouldn't give.

const unsupported: [RegExp, string][] = [
  [/\bThread\.ofVirtual\b|\bnewVirtualThreadPerTaskExecutor\b|\bThread\.startVirtualThread\b/, "virtual threads"],
  [/\bExecutors?\b|\bExecutorService\b|\bCompletableFuture\b|\bForkJoinPool\b|\bStructuredTaskScope\b/, "executors and futures"],
  [/\bjava\.util\.concurrent\.locks\b|\bReentrantLock\b|\bReadWriteLock\b|\bStampedLock\b|\bCountDownLatch\b|\bCyclicBarrier\b|\bSemaphore\b|\bPhaser\b/, "java.util.concurrent synchronizers"],
  [/\bScanner\b|\bSystem\.in\b|\bIO\.readln\b|\bConsole\b/, "keyboard input"],
  [/\bSystem\.exit\b/, "System.exit"],
  [/\bStringJoiner\b|\bHexFormat\b|\bStackWalker\b|\bGatherers?\b|\bThread\.State\b/, "a library class the browser runtime doesn't have"],
  [/catch\s*\(\s*(final\s+)?(ArithmeticException|ArrayIndexOutOfBoundsException|IndexOutOfBoundsException|NullPointerException|ClassCastException|RuntimeException|Exception|Throwable)\b/, "catching a runtime exception"],
  [/%[-#+ 0,(]*\d*(\.\d+)?[eEgGaA]/, "%e / %g formatting"],
  [/\bjava\.lang\.foreign\b|\bMemorySegment\b|\bArena\b|\bLinker\b/, "the foreign function api"],
  [/\bjava\.lang\.reflect\b|\bgetDeclaredMethod|getDeclaredField|\.getMethods\(|\bMethodHandles?\b|\bVarHandle\b|\bProxy\.newProxyInstance\b/, "reflection"],
  [/\bjava\.lang\.classfile\b|\bClassLoader\b|\bjava\.lang\.management\b|\bRuntime\.getRuntime\(\)|\bManagementFactory\b/, "JVM internals"],
  [/\bjava\.nio\.file\b|\bFiles\.|\bjava\.io\.File\b|\bFileInputStream\b|\bFileOutputStream\b|\bjava\.net\b|\bHttpClient\b|\bjava\.sql\b/, "files, the network or a database"],
  [/\bjava\.util\.logging\b|\bSystem\.getLogger\b/, "logging"],
  [/\bjdk\.incubator\b|\bjdk\.jfr\b/, "an incubator or JDK-internal module"],
];

/** null when the browser can run it; otherwise a short reason, lowercase. */
export function browserCantRun(source: string): string | null {
  for (const [re, why] of unsupported) if (re.test(source)) return why;
  return null;
}

// runs fine, but the answer can differ from real java. shown as a note under the output.
const caveats: [RegExp, string][] = [
  [/\bHashMap\b|\bHashSet\b|\.hashCode\(\)|\bidentityHashCode\b/, "the browser runtime has its own HashMap and hash codes, so iteration order and hash values can differ from real java. the order the book shows is jdk 25's."],
  [/\bint\s+hashCode\s*\(/, "the browser runtime's default toString ignores an overridden hashCode, so ClassName@hash can print a different hash than real java."],
  [/\bDouble\.compare\b|-0\.0/, "the browser runtime gets a couple of floating point edge cases (like -0.0) wrong. trust the book's output."],
];

/** null when the browser's answer should match real java; otherwise a one-line warning. */
export function browserCaveat(source: string): string | null {
  for (const [re, why] of caveats) if (re.test(source)) return why;
  return null;
}
