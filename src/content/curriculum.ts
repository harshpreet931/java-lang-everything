// the whole book, in order. this file is the single source of truth for the
// sidebar, the map, prev/next and every chapter address.
//
// a chapter lives at content/<part>/<chapter>.mdx and is served at /learn/<part>/<chapter>.
// its address (the breadcrumb) is everything.<part>.<chapterInCamelCase>.

export type Chapter = {
  slug: string;
  title: string;
  /** one line, lowercase, what you'll get out of it */
  blurb: string;
  /** java version that made this final, when it's a modern feature */
  since?: number;
  /** still preview/incubator in the latest jdk */
  preview?: boolean;
};

export type Part = {
  slug: string;
  n: number;
  title: string;
  blurb: string;
  /** which tiny animated glyph represents this part on the map */
  glyph: Glyph;
  chapters: Chapter[];
};

export type Glyph =
  | "cup"
  | "bits"
  | "objects"
  | "toolbox"
  | "brackets"
  | "buckets"
  | "stream"
  | "spark"
  | "threads"
  | "pipes"
  | "mirror"
  | "wrench"
  | "bytecode"
  | "sweep"
  | "gauge"
  | "book"
  | "magnifier"
  | "horizon";

export const parts: Part[] = [
  {
    slug: "start",
    n: 1,
    title: "start here",
    blurb: "what java even is, a JDK on your machine, and your first program running.",
    glyph: "cup",
    chapters: [
      { slug: "what-is-java", title: "what java actually is", blurb: "the language, the JDK, the JVM, and why they're three different things." },
      { slug: "setup", title: "getting a JDK", blurb: "which JDK to install (there are like ten), JAVA_HOME, and an editor." },
      { slug: "hello-world", title: "hello, world", blurb: "from void main() to public static void main(String[] args), and why both exist." },
      { slug: "compile-and-run", title: "compile and run", blurb: "javac → .class → java. what each step actually produces." },
      { slug: "jshell", title: "jshell", blurb: "a REPL for java. the fastest way to try anything on this site." },
      { slug: "debugging", title: "debugging and stack traces", blurb: "breakpoints, stepping, and reading a stack trace without panicking." },
    ],
  },
  {
    slug: "basics",
    n: 2,
    title: "the basics",
    blurb: "variables, types, control flow, methods, and the stack/heap mental model everything else sits on.",
    glyph: "bits",
    chapters: [
      { slug: "variables-and-primitives", title: "variables and primitives", blurb: "eight primitive types, how many bits each one gets, and what that means." },
      { slug: "operators", title: "operators", blurb: "precedence, short-circuiting, and the ++i vs i++ thing." },
      { slug: "casting-and-overflow", title: "casting and overflow", blurb: "widening, narrowing, and why Integer.MAX_VALUE + 1 is negative." },
      { slug: "floating-point", title: "floating point", blurb: "why 0.1 + 0.2 != 0.3, IEEE 754 bit by bit, and when to reach for BigDecimal." },
      { slug: "strings-101", title: "strings, the basics", blurb: "string literals, immutability, concatenation and text blocks." },
      { slug: "control-flow", title: "control flow", blurb: "if, loops, break, continue, and labeled breaks (yes, java has those)." },
      { slug: "switch", title: "switch", blurb: "the old fallthrough switch vs the new arrow switch expression." },
      { slug: "arrays", title: "arrays", blurb: "fixed-size boxes in a row. 2d arrays are arrays of arrays (literally)." },
      { slug: "methods", title: "methods", blurb: "parameters, return values, overloading and varargs." },
      { slug: "call-stack-and-recursion", title: "the call stack and recursion", blurb: "every call pushes a frame. watch them stack up and unwind." },
      { slug: "stack-and-heap", title: "stack and heap", blurb: "where your variables live vs where your objects live. the most important picture in java." },
      { slug: "pass-by-value", title: "java is pass-by-value", blurb: "always. even for objects. here's the proof, step by step." },
      { slug: "var", title: "var", blurb: "local type inference: what it infers, and where it isn't allowed." },
      { slug: "console-io", title: "reading and printing", blurb: "System.out, printf formatting, Scanner and IO.println." },
    ],
  },
  {
    slug: "oop",
    n: 3,
    title: "objects and classes",
    blurb: "classes, constructors, inheritance, polymorphism, interfaces, and the contracts every object signs.",
    glyph: "objects",
    chapters: [
      { slug: "classes-and-objects", title: "classes and objects", blurb: "a class is a blueprint, new stamps out an object. what's actually in memory." },
      { slug: "constructors-and-init-order", title: "constructors and init order", blurb: "the exact order fields, initializers and constructors run in." },
      { slug: "access-control", title: "access control", blurb: "private, package-private, protected, public. who can see what." },
      { slug: "static", title: "static", blurb: "one copy per class vs one copy per object." },
      { slug: "packages-and-imports", title: "packages and imports", blurb: "fully qualified names, the classpath, and import module." },
      { slug: "inheritance", title: "inheritance", blurb: "extends, super, and how a subclass object is laid out in memory." },
      { slug: "polymorphism", title: "polymorphism and dynamic dispatch", blurb: "overloading picks at compile time, overriding picks at runtime. the vtable." },
      { slug: "abstract-classes-and-interfaces", title: "abstract classes and interfaces", blurb: "default methods, the diamond problem, and when to use which." },
      { slug: "object-methods", title: "equals, hashCode, toString", blurb: "the contracts every object signs, and what breaks when you don't keep them." },
      { slug: "enums", title: "enums", blurb: "type-safe constants that are secretly full classes." },
      { slug: "nested-classes", title: "nested and inner classes", blurb: "static nested, inner, local, anonymous. and the hidden this$0." },
      { slug: "immutability", title: "immutability", blurb: "final fields, defensive copies, and the aliasing bug that ruins your day." },
      { slug: "composition-over-inheritance", title: "composition over inheritance", blurb: "the fragile base class problem, animated." },
    ],
  },
  {
    slug: "core-api",
    n: 4,
    title: "core apis and exceptions",
    blurb: "the standard library you use every day, and how errors move through a program.",
    glyph: "toolbox",
    chapters: [
      { slug: "string-api", title: "the string api", blurb: "StringBuilder, formatting, compact strings and the methods worth knowing." },
      { slug: "wrappers-and-boxing", title: "wrappers and autoboxing", blurb: "int vs Integer, the integer cache, and why 127 == 127 but 128 != 128." },
      { slug: "math-and-random", title: "math and random numbers", blurb: "Math, StrictMath, BigInteger, and RandomGenerator." },
      { slug: "exceptions", title: "exceptions", blurb: "Throwable, Error, Exception. checked vs unchecked." },
      { slug: "try-catch-finally", title: "try, catch, finally", blurb: "how an exception unwinds the stack, frame by frame." },
      { slug: "try-with-resources", title: "try-with-resources", blurb: "automatic closing, in reverse order, with suppressed exceptions." },
      { slug: "designing-exceptions", title: "designing with exceptions", blurb: "custom exceptions, chaining, and translating across layers." },
      { slug: "optional", title: "optional", blurb: "a box that might be empty. idioms and anti-patterns." },
      { slug: "date-and-time", title: "dates and time", blurb: "Instant vs LocalDateTime vs ZonedDateTime, and daylight saving traps." },
      { slug: "regex", title: "regular expressions", blurb: "Pattern, Matcher, groups, and how backtracking can melt your cpu." },
      { slug: "logging", title: "logging", blurb: "System.Logger, java.util.logging, SLF4J. levels and where logs go." },
    ],
  },
  {
    slug: "generics",
    n: 5,
    title: "generics",
    blurb: "type parameters, wildcards, erasure. how java gets type safety without changing the JVM.",
    glyph: "brackets",
    chapters: [
      { slug: "why-generics", title: "why generics exist", blurb: "life before generics was ClassCastException at 3am." },
      { slug: "generic-types-and-methods", title: "generic types and methods", blurb: "writing your own Box<T>, and how inference figures out T." },
      { slug: "bounded-types", title: "bounded type parameters", blurb: "<T extends Comparable<? super T>> decoded." },
      { slug: "wildcards-and-pecs", title: "wildcards and PECS", blurb: "? extends vs ? super. producer extends, consumer super." },
      { slug: "type-erasure", title: "type erasure", blurb: "what the compiler deletes, what it adds (bridge methods), and why." },
      { slug: "generics-limitations", title: "arrays, varargs and other limits", blurb: "no new T(), no generic arrays, heap pollution and @SafeVarargs." },
      { slug: "generics-and-reflection", title: "generics at runtime", blurb: "type tokens and the bits of type info that do survive erasure." },
    ],
  },
  {
    slug: "collections",
    n: 6,
    title: "collections",
    blurb: "lists, sets, maps, queues. what each one actually is in memory, and which to pick.",
    glyph: "buckets",
    chapters: [
      { slug: "the-big-picture", title: "the big picture", blurb: "the interface family tree, from Iterable down to SequencedMap." },
      { slug: "arraylist", title: "ArrayList", blurb: "an array that grows. how much, when, and what it costs." },
      { slug: "linkedlist-and-arraydeque", title: "LinkedList and ArrayDeque", blurb: "nodes and pointers vs a circular buffer. (spoiler: use the deque.)" },
      { slug: "hashmap", title: "HashMap", blurb: "buckets, hashes, collisions, resizing. put a key in and watch where it lands." },
      { slug: "linkedhashmap-and-lru", title: "LinkedHashMap and LRU caches", blurb: "a hashmap with a linked list threaded through it." },
      { slug: "treemap", title: "TreeMap and sorted maps", blurb: "a red-black tree that stays balanced while you insert." },
      { slug: "sets", title: "sets", blurb: "HashSet (a HashMap in disguise), TreeSet, and EnumSet (a bit vector)." },
      { slug: "priorityqueue", title: "PriorityQueue", blurb: "a binary heap in an array. sift up, sift down." },
      { slug: "immutable-collections", title: "immutable collections", blurb: "List.of, copyOf, and unmodifiable views that aren't actually immutable." },
      { slug: "iterators-and-fail-fast", title: "iterators and fail-fast", blurb: "modCount and the ConcurrentModificationException you got in a single thread." },
      { slug: "sorting-and-comparators", title: "sorting and comparators", blurb: "Comparable, Comparator.comparing().thenComparing(), and TimSort." },
      { slug: "choosing-a-collection", title: "choosing a collection", blurb: "a decision tree and a big-O cheat sheet." },
    ],
  },
  {
    slug: "functional",
    n: 7,
    title: "lambdas and streams",
    blurb: "functions as values, and pipelines that process data lazily, one element at a time.",
    glyph: "stream",
    chapters: [
      { slug: "lambdas", title: "lambdas", blurb: "syntax, target typing, and why captured variables must be effectively final." },
      { slug: "functional-interfaces", title: "functional interfaces", blurb: "Function, Supplier, Consumer, Predicate and the rest of the zoo." },
      { slug: "method-references", title: "method references", blurb: "the four kinds of ::, and what each one desugars to." },
      { slug: "stream-pipeline", title: "how a stream pipeline runs", blurb: "source → intermediate → terminal. lazy, one element at a time." },
      { slug: "stream-operations", title: "stream operations", blurb: "map, filter, flatMap, sorted, distinct, limit, takeWhile." },
      { slug: "collectors", title: "collectors", blurb: "toList, groupingBy, partitioningBy, toMap, teeing." },
      { slug: "reduction", title: "reduction", blurb: "reduce with identity, accumulator, combiner. and when to use collect instead." },
      { slug: "primitive-streams", title: "primitive streams", blurb: "IntStream and friends, and the cost of boxing." },
      { slug: "gatherers", title: "gatherers", blurb: "custom intermediate operations: windows, scans, and mapConcurrent.", since: 24 },
      { slug: "parallel-streams", title: "parallel streams", blurb: "spliterators, the common pool, and when parallel is slower." },
    ],
  },
  {
    slug: "modern",
    n: 8,
    title: "modern java",
    blurb: "records, sealed types, pattern matching. java from 8 to 27 and how it writes now.",
    glyph: "spark",
    chapters: [
      { slug: "release-timeline", title: "java 8 → 27", blurb: "every release, what it shipped, and the six-month train." },
      { slug: "preview-features", title: "preview and incubator features", blurb: "--enable-preview, and how features graduate." },
      { slug: "records", title: "records", blurb: "data carriers in one line. what the compiler generates for you.", since: 16 },
      { slug: "sealed-types", title: "sealed types", blurb: "closed hierarchies the compiler can check exhaustively.", since: 17 },
      { slug: "pattern-matching", title: "pattern matching", blurb: "instanceof patterns, switch patterns, guards and dominance.", since: 21 },
      { slug: "record-patterns", title: "record patterns", blurb: "destructure records, nested, right in the pattern. plus _.", since: 21 },
      { slug: "data-oriented-programming", title: "data-oriented programming", blurb: "records + sealed + patterns = algebraic data types in java." },
      { slug: "simpler-programs", title: "simpler programs", blurb: "compact source files, instance main, and import module.", since: 25 },
      { slug: "flexible-constructors", title: "flexible constructor bodies", blurb: "statements before super(), finally.", since: 25 },
      { slug: "in-preview", title: "what's in preview right now", blurb: "primitive patterns, lazy constants, structured concurrency in jdk 27.", preview: true },
    ],
  },
  {
    slug: "concurrency",
    n: 9,
    title: "concurrency",
    blurb: "threads, races, locks, the memory model, executors and virtual threads.",
    glyph: "threads",
    chapters: [
      { slug: "threads", title: "threads", blurb: "starting threads, their lifecycle, and the six states." },
      { slug: "race-conditions", title: "race conditions", blurb: "two threads, one counter++, and a lost update. interleave them yourself." },
      { slug: "synchronized", title: "synchronized and monitors", blurb: "every object has a lock. entry sets, reentrancy, and what it guards." },
      { slug: "wait-and-notify", title: "wait and notify", blurb: "guarded blocks, spurious wakeups, and why you should use something else." },
      { slug: "java-memory-model", title: "the java memory model", blurb: "happens-before, volatile, reordering, and safe publication." },
      { slug: "atomics-and-cas", title: "atomics and CAS", blurb: "compare-and-swap loops, AtomicInteger, LongAdder, and ABA." },
      { slug: "locks-and-aqs", title: "locks and AQS", blurb: "ReentrantLock, ReadWriteLock, StampedLock, and the queue under all of them." },
      { slug: "executors", title: "executors and thread pools", blurb: "core size, max size, the queue, and rejection. play with a pool." },
      { slug: "completablefuture", title: "CompletableFuture", blurb: "async pipelines: thenApply, thenCompose, allOf, and error handling." },
      { slug: "fork-join", title: "fork/join and work stealing", blurb: "split work recursively, idle threads steal from busy ones." },
      { slug: "concurrent-collections", title: "concurrent collections", blurb: "ConcurrentHashMap, CopyOnWriteArrayList, BlockingQueue." },
      { slug: "synchronizers", title: "synchronizers", blurb: "CountDownLatch, CyclicBarrier, Semaphore, Phaser." },
      { slug: "deadlocks-and-liveness", title: "deadlocks and liveness", blurb: "deadlock, livelock, starvation. the dining philosophers, live." },
      { slug: "virtual-threads", title: "virtual threads", blurb: "millions of threads, mounted on a few carriers.", since: 21 },
      { slug: "structured-concurrency", title: "structured concurrency and scoped values", blurb: "task trees that cancel together, and ThreadLocal's replacement.", since: 25 },
      { slug: "testing-concurrent-code", title: "testing concurrent code", blurb: "why your test passed 1000 times and failed in prod. jcstress." },
    ],
  },
  {
    slug: "io",
    n: 10,
    title: "i/o, networking and data",
    blurb: "bytes in, bytes out. files, buffers, sockets, http, databases and crypto.",
    glyph: "pipes",
    chapters: [
      { slug: "io-streams", title: "i/o streams", blurb: "InputStream, Reader, and the decorator onion." },
      { slug: "charsets-and-encoding", title: "charsets and encoding", blurb: "chars are not bytes. UTF-8, UTF-16, and mojibake." },
      { slug: "files-and-paths", title: "files and paths", blurb: "Path, Files, walking trees, and watching directories." },
      { slug: "buffers-and-channels", title: "buffers and channels", blurb: "ByteBuffer position, limit, flip. and memory-mapped files." },
      { slug: "serialization", title: "serialization", blurb: "how objects become bytes, and why everyone says don't." },
      { slug: "networking", title: "sockets and selectors", blurb: "TCP, UDP, and one thread watching many connections." },
      { slug: "http-client", title: "the http client", blurb: "HttpClient, async requests, http/2 and http/3." },
      { slug: "jdbc", title: "jdbc", blurb: "connections, prepared statements, transactions and pools." },
      { slug: "json-and-xml", title: "json and xml", blurb: "parsing and writing both, plus the new json api on the way." },
      { slug: "security-and-crypto", title: "security and crypto", blurb: "hashing, signing, encryption, and a TLS handshake, step by step." },
    ],
  },
  {
    slug: "meta",
    n: 11,
    title: "reflection and metaprogramming",
    blurb: "code that looks at code. reflection, annotations, proxies, method handles, invokedynamic.",
    glyph: "mirror",
    chapters: [
      { slug: "reflection", title: "reflection", blurb: "Class, Field, Method, and why setAccessible stopped working." },
      { slug: "annotations", title: "annotations", blurb: "retention, targets, and what an annotation actually is at runtime." },
      { slug: "annotation-processing", title: "annotation processing", blurb: "code that runs inside javac. how lombok and mapstruct work." },
      { slug: "dynamic-proxies", title: "dynamic proxies", blurb: "fake objects that intercept every call. spring's favourite trick." },
      { slug: "method-handles-and-varhandles", title: "method handles and varhandles", blurb: "fast, typed references to methods and fields." },
      { slug: "invokedynamic", title: "invokedynamic", blurb: "the bytecode that powers lambdas, string concat and records." },
      { slug: "class-file-api", title: "the class-file api", blurb: "generate and transform .class files with a real api.", since: 24 },
      { slug: "service-loader", title: "ServiceLoader", blurb: "plugins without a framework." },
    ],
  },
  {
    slug: "tooling",
    n: 12,
    title: "tools and ecosystem",
    blurb: "the JDK's own tools, modules, build tools, testing, and the libraries everyone uses.",
    glyph: "wrench",
    chapters: [
      { slug: "jdk-tools", title: "the jdk toolbox", blurb: "javac, jar, javap, jdeps, jcmd, jdb. what's in bin/ and why." },
      { slug: "modules", title: "modules", blurb: "module-info.java, requires, exports, opens. strong encapsulation." },
      { slug: "classpath-to-modulepath", title: "classpath to module path", blurb: "unnamed modules, automatic modules, and migrating for real." },
      { slug: "jars-jlink-jpackage", title: "jar, jlink, jpackage", blurb: "from a jar to a tiny custom runtime to a native installer." },
      { slug: "maven", title: "maven", blurb: "the pom, the lifecycle, and how dependency conflicts get resolved." },
      { slug: "gradle", title: "gradle", blurb: "tasks, the task graph, and the kotlin dsl." },
      { slug: "testing-with-junit", title: "testing with junit", blurb: "junit 6, assertions, parameterized tests, mocks and testcontainers." },
      { slug: "code-quality", title: "code quality tools", blurb: "error prone, spotbugs, nullaway and jspecify." },
      { slug: "javadoc", title: "javadoc", blurb: "doc comments, @snippet, and markdown docs." },
      { slug: "ecosystem-map", title: "the ecosystem map", blurb: "spring, quarkus, micronaut, jakarta ee, kotlin. who does what." },
    ],
  },
  {
    slug: "jvm",
    n: 13,
    title: "inside the JVM",
    blurb: "class files, bytecode, class loaders, the interpreter and the JIT. how your code actually runs.",
    glyph: "bytecode",
    chapters: [
      { slug: "jvm-architecture", title: "JVM architecture", blurb: "class loaders, runtime data areas, execution engine. the whole map." },
      { slug: "class-file-format", title: "the class file", blurb: "CAFEBABE, the constant pool, and every byte of a tiny .class." },
      { slug: "bytecode", title: "bytecode", blurb: "a stack machine. watch the operand stack while a method runs." },
      { slug: "invoke-instructions", title: "the five invoke instructions", blurb: "invokestatic, virtual, interface, special, dynamic. who calls what." },
      { slug: "class-loading", title: "class loading", blurb: "load → link → initialize. and the exact moments a class gets initialized." },
      { slug: "classloaders", title: "class loaders", blurb: "bootstrap, platform, app. delegation, and why two loaders = two classes." },
      { slug: "interpreter-and-jit", title: "the interpreter and the JIT", blurb: "tiered compilation: how hot code climbs from tier 0 to C2." },
      { slug: "jit-optimizations", title: "JIT optimizations", blurb: "inlining, escape analysis, loop tricks, and deoptimization." },
      { slug: "object-layout", title: "object layout", blurb: "mark word, class pointer, fields, padding. and compact headers.", since: 25 },
      { slug: "locking-internals", title: "how locks work inside", blurb: "lightweight locking, inflation, and what happened to biased locking." },
      { slug: "safepoints", title: "safepoints", blurb: "how the JVM stops every thread, and why your latency spiked." },
      { slug: "aot-and-leyden", title: "AOT, Leyden and native images", blurb: "CDS, the AOT cache, and starting fast." },
    ],
  },
  {
    slug: "gc",
    n: 14,
    title: "memory and garbage collection",
    blurb: "allocation, reachability, and every collector from Serial to generational ZGC.",
    glyph: "sweep",
    chapters: [
      { slug: "runtime-data-areas", title: "the JVM's memory map", blurb: "heap, stacks, metaspace, code cache. what lives where." },
      { slug: "allocation-and-tlabs", title: "allocation and TLABs", blurb: "new is usually just a pointer bump. here's why it's so fast." },
      { slug: "reachability-and-references", title: "reachability", blurb: "GC roots, and soft, weak and phantom references." },
      { slug: "gc-fundamentals", title: "how garbage collection works", blurb: "mark, sweep, compact, copy. and tri-color marking." },
      { slug: "generational-gc", title: "generational collection", blurb: "most objects die young. eden, survivors, and the old generation." },
      { slug: "serial-and-parallel", title: "serial and parallel", blurb: "the stop-the-world collectors, and when they're still the right call." },
      { slug: "g1", title: "G1", blurb: "regions, remembered sets, mixed collections. the default collector." },
      { slug: "zgc", title: "ZGC", blurb: "colored pointers and load barriers. sub-millisecond pauses." },
      { slug: "shenandoah", title: "Shenandoah", blurb: "concurrent compaction with forwarding pointers." },
      { slug: "choosing-a-gc", title: "choosing a collector", blurb: "throughput, latency, footprint. pick two." },
      { slug: "reading-gc-logs", title: "reading GC logs", blurb: "-Xlog:gc and what all those numbers mean." },
      { slug: "memory-leaks", title: "memory leaks", blurb: "yes, java leaks. heap dumps, dominators, and the usual suspects." },
      { slug: "native-memory", title: "native memory", blurb: "the memory the heap doesn't count. NMT and direct buffers." },
    ],
  },
  {
    slug: "performance",
    n: 15,
    title: "performance and native",
    blurb: "measuring honestly, profiling, flame graphs, the CPU underneath, and calling C.",
    glyph: "gauge",
    chapters: [
      { slug: "measuring-performance", title: "measuring performance", blurb: "averages lie. percentiles, and coordinated omission." },
      { slug: "jmh", title: "microbenchmarks with JMH", blurb: "dead code elimination ate your benchmark. how to not get fooled." },
      { slug: "jfr-and-jmc", title: "flight recorder", blurb: "JFR events, always-on profiling, and mission control." },
      { slug: "profiling-and-flame-graphs", title: "profiling and flame graphs", blurb: "async-profiler, safepoint bias, and reading a flame graph." },
      { slug: "jvm-in-containers", title: "the JVM in containers", blurb: "ergonomics, memory limits, and the flags that matter." },
      { slug: "mechanical-sympathy", title: "mechanical sympathy", blurb: "cache lines, false sharing, and why arrays beat linked lists." },
      { slug: "ffm-api", title: "the foreign function and memory api", blurb: "call C and manage off-heap memory, safely.", since: 22 },
      { slug: "jni", title: "jni", blurb: "the old way to call native code, and why it's being fenced in." },
      { slug: "vector-api", title: "the vector api", blurb: "SIMD from java: one instruction, many lanes.", preview: true },
    ],
  },
  {
    slug: "effective-java",
    n: 16,
    title: "effective java, visualized",
    blurb: "a companion to Bloch's 90 items: the idea, the bad version, the good version, and what changed since.",
    glyph: "book",
    chapters: [
      { slug: "creating-and-destroying-objects", title: "creating and destroying objects", blurb: "items 1–9: factories, builders, singletons, and not leaking." },
      { slug: "methods-common-to-all-objects", title: "methods common to all objects", blurb: "items 10–14: equals, hashCode, toString, clone, compareTo." },
      { slug: "classes-and-interfaces", title: "classes and interfaces", blurb: "items 15–25: accessibility, immutability, composition, interfaces." },
      { slug: "generics", title: "generics", blurb: "items 26–33: raw types, wildcards, and typesafe containers." },
      { slug: "enums-and-annotations", title: "enums and annotations", blurb: "items 34–41: enums over ints, EnumSet, EnumMap, @Override." },
      { slug: "lambdas-and-streams", title: "lambdas and streams", blurb: "items 42–48: lambdas, method refs, and using streams judiciously." },
      { slug: "methods", title: "methods", blurb: "items 49–56: validation, defensive copies, overloading, optionals." },
      { slug: "general-programming", title: "general programming", blurb: "items 57–68: scope, libraries, floats, boxing, strings, naming." },
      { slug: "exceptions", title: "exceptions", blurb: "items 69–77: when to throw, what to throw, and never ignoring them." },
      { slug: "concurrency", title: "concurrency", blurb: "items 78–84: synchronization, executors, and thread safety docs." },
      { slug: "serialization", title: "serialization", blurb: "items 85–90: mostly, don't. and if you must, use a proxy." },
    ],
  },
  {
    slug: "deep-dives",
    n: 17,
    title: "deep dives",
    blurb: "the interview-grade internals. source-level, bit-level, no hand-waving.",
    glyph: "magnifier",
    chapters: [
      { slug: "hashmap-internals", title: "HashMap, line by line", blurb: "hash spreading, (n-1) & hash, the resize split, and treeification." },
      { slug: "concurrenthashmap-internals", title: "ConcurrentHashMap internals", blurb: "CAS on empty bins, locked bin heads, and cooperative resizing." },
      { slug: "string-pool", title: "the string pool", blurb: "literals, intern(), and every == trap in one place." },
      { slug: "string-concatenation", title: "string concatenation internals", blurb: "from StringBuilder to invokedynamic and StringConcatFactory." },
      { slug: "integer-cache", title: "the integer cache", blurb: "why -128..127, and how to make it bigger." },
      { slug: "singleton-and-dcl", title: "singletons and double-checked locking", blurb: "the half-constructed object, and the three ways to do it right." },
      { slug: "threadlocal-internals", title: "ThreadLocal internals", blurb: "weak keys, the per-thread map, and the thread pool leak." },
      { slug: "threadpoolexecutor-internals", title: "ThreadPoolExecutor internals", blurb: "the ctl field: run state and worker count in one int." },
      { slug: "lambda-internals", title: "how lambdas are compiled", blurb: "no anonymous classes. invokedynamic and LambdaMetafactory." },
      { slug: "virtual-thread-internals", title: "virtual threads, inside", blurb: "continuations, mounting, unmounting, and pinning." },
      { slug: "arraylist-vs-linkedlist", title: "ArrayList vs LinkedList, measured", blurb: "big-O says one thing, the CPU cache says another." },
      { slug: "out-of-memory-zoo", title: "the OutOfMemoryError zoo", blurb: "every OOM message, what it means, and what to do." },
      { slug: "equals-and-hashcode-traps", title: "equals and hashCode traps", blurb: "mutable keys, inheritance, and the object that vanished from a set." },
      { slug: "classloader-leaks", title: "class loader leaks", blurb: "how redeploying an app leaks an entire copy of it." },
    ],
  },
  {
    slug: "future",
    n: 18,
    title: "where java is going",
    blurb: "valhalla, leyden, amber, loom, panama. what's landing next and why it matters.",
    glyph: "horizon",
    chapters: [
      { slug: "valhalla", title: "valhalla: value objects", blurb: "objects without identity, flattened into arrays. preview in jdk 28.", preview: true },
      { slug: "leyden", title: "leyden: starting fast", blurb: "AOT caches today, AOT code next.", preview: true },
      { slug: "amber", title: "amber: the language keeps moving", blurb: "derived record creation, and what happened to string templates.", preview: true },
      { slug: "loom-next", title: "loom: what's left", blurb: "structured concurrency going final, and beyond.", preview: true },
      { slug: "panama-and-babylon", title: "panama and babylon", blurb: "vectors, native code, and java on GPUs.", preview: true },
      { slug: "whats-next", title: "what's next", blurb: "the json api, null-restricted types, CRaC, and how to follow along.", preview: true },
    ],
  },
];

// ---- helpers ----------------------------------------------------------------

export type FlatChapter = Chapter & { part: Part; index: number; href: string; address: string };

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export const flat: FlatChapter[] = parts.flatMap((part) =>
  part.chapters.map((c) => ({
    ...c,
    part,
    index: 0,
    href: `/learn/${part.slug}/${c.slug}`,
    address: `everything.${camel(part.slug)}.${camel(c.slug)}`,
  })),
).map((c, index) => ({ ...c, index }));

export const totalChapters = flat.length;

export function getPart(slug: string) {
  return parts.find((p) => p.slug === slug);
}

export function getChapter(partSlug: string, chapterSlug: string) {
  return flat.find((c) => c.part.slug === partSlug && c.slug === chapterSlug);
}

export function neighbours(c: FlatChapter) {
  return { prev: flat[c.index - 1], next: flat[c.index + 1] };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
