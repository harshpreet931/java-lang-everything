// java 8 → 28, as data. every GA date and JEP number below was checked against
// openjdk.org/projects/jdk/<n> (and /projects/jdk8/features, /projects/jdk9) on
// 2026-10-08/09. jdk 28 is in development: "targeted" JEPs can still move, and
// "proposed" ones aren't targeted yet.

export type Kind = "lang" | "api" | "jvm" | "tools";

export type Feature = { t: string; jep?: number; kind: Kind };

export type Release = {
  v: number;
  /** general availability, yyyy-mm-dd (planned for 28) */
  ga: string;
  lts?: boolean;
  dev?: boolean;
  /** the headline final (non-preview) features */
  final: Feature[];
  /** removals and deprecations worth knowing */
  gone?: string[];
  /** how many preview / incubator / experimental JEPs shipped in it (counted from the
   *  project page; left out for 8 and 9, before the preview process existed) */
  previews?: number;
};

export const RELEASES: Release[] = [
  {
    v: 8,
    ga: "2014-03-18",
    lts: true,
    final: [
      { t: "lambda expressions and default methods", jep: 126, kind: "lang" },
      { t: "streams (bulk data operations)", jep: 107, kind: "api" },
      { t: "java.time", jep: 150, kind: "api" },
      { t: "type annotations, repeating annotations", jep: 104, kind: "lang" },
      { t: "metaspace replaces permgen", jep: 122, kind: "jvm" },
    ],
  },
  {
    v: 9,
    ga: "2017-09-21",
    final: [
      { t: "the module system", jep: 261, kind: "lang" },
      { t: "jshell", jep: 222, kind: "tools" },
      { t: "G1 is the default GC", jep: 248, kind: "jvm" },
      { t: "compact strings (latin-1 strings use 1 byte per char)", jep: 254, kind: "jvm" },
      { t: "List.of, Set.of, Map.of", jep: 269, kind: "api" },
      { t: "private interface methods and other small language fixes", jep: 213, kind: "lang" },
      { t: "jlink", jep: 282, kind: "tools" },
    ],
  },
  {
    v: 10,
    ga: "2018-03-20",
    previews: 1,
    final: [
      { t: "var for local variables", jep: 286, kind: "lang" },
      { t: "parallel full GC for G1", jep: 307, kind: "jvm" },
      { t: "application class-data sharing", jep: 310, kind: "jvm" },
      { t: "time-based version numbers", jep: 322, kind: "tools" },
    ],
  },
  {
    v: 11,
    ga: "2018-09-25",
    lts: true,
    previews: 1,
    final: [
      { t: "HttpClient", jep: 321, kind: "api" },
      { t: "java Main.java (single-file programs, no javac step)", jep: 330, kind: "tools" },
      { t: "var in lambda parameters", jep: 323, kind: "lang" },
      { t: "flight recorder (JFR) in OpenJDK", jep: 328, kind: "tools" },
      { t: "Epsilon, the no-op GC", jep: 318, kind: "jvm" },
      { t: "String.strip, isBlank, lines, repeat", kind: "api" },
    ],
    gone: ["Java EE and CORBA modules removed (JEP 320)"],
  },
  {
    v: 12,
    ga: "2019-03-19",
    previews: 2,
    final: [
      { t: "JVM constants API", jep: 334, kind: "api" },
      { t: "default CDS archives", jep: 341, kind: "jvm" },
      { t: "G1 returns unused memory promptly", jep: 346, kind: "jvm" },
    ],
  },
  {
    v: 13,
    ga: "2019-09-17",
    previews: 2,
    final: [
      { t: "dynamic CDS archives", jep: 350, kind: "jvm" },
      { t: "legacy Socket API reimplemented", jep: 353, kind: "api" },
    ],
  },
  {
    v: 14,
    ga: "2020-03-17",
    previews: 5,
    final: [
      { t: "switch expressions", jep: 361, kind: "lang" },
      { t: "helpful NullPointerException messages", jep: 358, kind: "jvm" },
      { t: "JFR event streaming", jep: 349, kind: "tools" },
    ],
    gone: ["CMS garbage collector removed (JEP 363)"],
  },
  {
    v: 15,
    ga: "2020-09-15",
    previews: 4,
    final: [
      { t: "text blocks", jep: 378, kind: "lang" },
      { t: "ZGC ready for production", jep: 377, kind: "jvm" },
      { t: "Shenandoah ready for production", jep: 379, kind: "jvm" },
      { t: "hidden classes", jep: 371, kind: "jvm" },
    ],
    gone: ["Nashorn removed (JEP 372)", "biased locking disabled (JEP 374)"],
  },
  {
    v: 16,
    ga: "2021-03-16",
    previews: 4,
    final: [
      { t: "records", jep: 395, kind: "lang" },
      { t: "pattern matching for instanceof", jep: 394, kind: "lang" },
      { t: "jpackage", jep: 392, kind: "tools" },
      { t: "JDK internals strongly encapsulated by default", jep: 396, kind: "jvm" },
      { t: "Stream.toList(), Stream.mapMulti()", kind: "api" },
    ],
  },
  {
    v: 17,
    ga: "2021-09-14",
    lts: true,
    previews: 3,
    final: [
      { t: "sealed classes", jep: 409, kind: "lang" },
      { t: "JDK internals strongly encapsulated, no opt-out", jep: 403, kind: "jvm" },
      { t: "RandomGenerator and new PRNGs", jep: 356, kind: "api" },
      { t: "always-strict floating point", jep: 306, kind: "lang" },
      { t: "macOS on apple silicon", jep: 391, kind: "jvm" },
    ],
    gone: ["security manager deprecated for removal (JEP 411)"],
  },
  {
    v: 18,
    ga: "2022-03-22",
    previews: 3,
    final: [
      { t: "UTF-8 by default", jep: 400, kind: "api" },
      { t: "jwebserver, a simple web server", jep: 408, kind: "tools" },
      { t: "code snippets in javadoc", jep: 413, kind: "tools" },
      { t: "core reflection reimplemented with method handles", jep: 416, kind: "jvm" },
    ],
    gone: ["finalization deprecated for removal (JEP 421)"],
  },
  {
    v: 19,
    ga: "2022-09-20",
    previews: 6,
    final: [{ t: "linux on RISC-V", jep: 422, kind: "jvm" }],
  },
  {
    v: 20,
    ga: "2023-03-21",
    previews: 7,
    final: [],
  },
  {
    v: 21,
    ga: "2023-09-19",
    lts: true,
    previews: 7,
    final: [
      { t: "virtual threads", jep: 444, kind: "jvm" },
      { t: "pattern matching for switch", jep: 441, kind: "lang" },
      { t: "record patterns", jep: 440, kind: "lang" },
      { t: "sequenced collections", jep: 431, kind: "api" },
      { t: "generational ZGC", jep: 439, kind: "jvm" },
      { t: "key encapsulation mechanism API", jep: 452, kind: "api" },
    ],
  },
  {
    v: 22,
    ga: "2024-03-19",
    previews: 8,
    final: [
      { t: "foreign function and memory API", jep: 454, kind: "api" },
      { t: "unnamed variables and patterns (_)", jep: 456, kind: "lang" },
      { t: "multi-file java Main.java", jep: 458, kind: "tools" },
      { t: "region pinning for G1", jep: 423, kind: "jvm" },
    ],
  },
  {
    v: 23,
    ga: "2024-09-17",
    previews: 9,
    final: [
      { t: "markdown documentation comments", jep: 467, kind: "tools" },
      { t: "generational mode is ZGC's default", jep: 474, kind: "jvm" },
    ],
    gone: ["sun.misc.Unsafe memory access deprecated for removal (JEP 471)", "string templates dropped before this release (JEP 465 withdrawn)"],
  },
  {
    v: 24,
    ga: "2025-03-18",
    previews: 10,
    final: [
      { t: "stream gatherers", jep: 485, kind: "api" },
      { t: "class-file API", jep: 484, kind: "api" },
      { t: "virtual threads stop pinning on synchronized", jep: 491, kind: "jvm" },
      { t: "ahead-of-time class loading and linking", jep: 483, kind: "jvm" },
      { t: "quantum-resistant ML-KEM and ML-DSA", jep: 496, kind: "api" },
    ],
    gone: ["security manager permanently disabled (JEP 486)", "ZGC's non-generational mode removed (JEP 490)"],
  },
  {
    v: 25,
    ga: "2025-09-16",
    lts: true,
    previews: 6,
    final: [
      { t: "compact source files and instance main methods", jep: 512, kind: "lang" },
      { t: "module import declarations", jep: 511, kind: "lang" },
      { t: "flexible constructor bodies", jep: 513, kind: "lang" },
      { t: "scoped values", jep: 506, kind: "api" },
      { t: "compact object headers", jep: 519, kind: "jvm" },
      { t: "key derivation function API", jep: 510, kind: "api" },
      { t: "AOT method profiling, AOT command-line ergonomics", jep: 515, kind: "jvm" },
      { t: "generational Shenandoah", jep: 521, kind: "jvm" },
    ],
    gone: ["32-bit x86 port removed (JEP 503)"],
  },
  {
    v: 26,
    ga: "2026-03-17",
    previews: 5,
    final: [
      { t: "HTTP/3 in HttpClient", jep: 517, kind: "api" },
      { t: "AOT object caching with any GC", jep: 516, kind: "jvm" },
      { t: "warnings when deep reflection mutates final fields", jep: 500, kind: "jvm" },
      { t: "G1 throughput: less synchronization", jep: 522, kind: "jvm" },
    ],
    gone: ["applet API removed (JEP 504)"],
  },
  {
    v: 27,
    ga: "2026-09-15",
    previews: 5,
    final: [
      { t: "G1 is the default GC in every environment", jep: 523, kind: "jvm" },
      { t: "compact object headers by default", jep: 534, kind: "jvm" },
      { t: "post-quantum hybrid key exchange for TLS 1.3", jep: 527, kind: "api" },
      { t: "JFR in-process data redaction", jep: 536, kind: "tools" },
    ],
  },
  {
    v: 28,
    ga: "2027-03",
    dev: true,
    previews: 3,
    final: [
      { t: "PEM encodings of cryptographic objects (targeted)", jep: 542, kind: "api" },
      { t: "ahead-of-time code compilation (targeted)", jep: 544, kind: "jvm" },
      { t: "generational mode is Shenandoah's default (targeted)", jep: 535, kind: "jvm" },
      { t: "structured concurrency (proposed)", jep: 543, kind: "api" },
    ],
    gone: ["macOS/x64 port deprecated for removal (targeted, JEP 541)"],
  },
];

/* ---- features that went through preview or incubation, as tracks ---------- */

/** i = incubator, p = preview, e = experimental, f = final, x = withdrawn, t = targeted/proposed (in development) */
export type Stage = "i" | "p" | "e" | "f" | "x" | "t";
export type Track = {
  id: string;
  /** label in the grid */
  short: string;
  name: string;
  kind: Kind;
  steps: { v: number; s: Stage; jep: number; note?: string }[];
  chapter?: string;
  says: string;
};

export const TRACKS: Track[] = [
  {
    id: "switch",
    short: "switch expressions",
    name: "switch expressions",
    kind: "lang",
    chapter: "/learn/basics/switch",
    steps: [
      { v: 12, s: "p", jep: 325 },
      { v: 13, s: "p", jep: 354, note: "break value became yield" },
      { v: 14, s: "f", jep: 361 },
    ],
    says: "the first feature through the new preview process. the second preview renamed `break value` to `yield`, which is exactly why previews exist.",
  },
  {
    id: "text",
    short: "text blocks",
    name: "text blocks",
    kind: "lang",
    chapter: "/learn/basics/strings-101",
    steps: [
      { v: 13, s: "p", jep: 355 },
      { v: 14, s: "p", jep: 368, note: "added \\ and \\s escapes" },
      { v: 15, s: "f", jep: 378 },
    ],
    says: "multi-line string literals with \"\"\". the second preview added two escapes. (an earlier design, raw string literals, was dropped before it ever shipped.)",
  },
  {
    id: "records",
    short: "records",
    name: "records",
    kind: "lang",
    chapter: "/learn/modern/records",
    steps: [
      { v: 14, s: "p", jep: 359 },
      { v: 15, s: "p", jep: 384 },
      { v: 16, s: "f", jep: 395 },
    ],
    says: "data carriers in one line. the second preview allowed local records, interfaces and enums. final in 16.",
  },
  {
    id: "instanceof",
    short: "instanceof patterns",
    name: "pattern matching for instanceof",
    kind: "lang",
    chapter: "/learn/modern/pattern-matching",
    steps: [
      { v: 14, s: "p", jep: 305 },
      { v: 15, s: "p", jep: 375 },
      { v: 16, s: "f", jep: 394, note: "pattern variables no longer implicitly final" },
    ],
    says: "if (o instanceof String s). the first piece of project amber's pattern matching to land.",
  },
  {
    id: "sealed",
    short: "sealed classes",
    name: "sealed classes",
    kind: "lang",
    chapter: "/learn/modern/sealed-types",
    steps: [
      { v: 15, s: "p", jep: 360 },
      { v: 16, s: "p", jep: 397 },
      { v: 17, s: "f", jep: 409 },
    ],
    says: "closed hierarchies with permits. final in the 17 LTS, which is why 17 is where modern java really starts.",
  },
  {
    id: "ffm",
    short: "FFM API",
    name: "foreign function and memory API",
    kind: "api",
    chapter: "/learn/performance/ffm-api",
    steps: [
      { v: 14, s: "i", jep: 370, note: "foreign-memory access" },
      { v: 15, s: "i", jep: 383 },
      { v: 16, s: "i", jep: 393, note: "plus the foreign linker, JEP 389" },
      { v: 17, s: "i", jep: 412, note: "merged into one API" },
      { v: 18, s: "i", jep: 419 },
      { v: 19, s: "p", jep: 424 },
      { v: 20, s: "p", jep: 434 },
      { v: 21, s: "p", jep: 442 },
      { v: 22, s: "f", jep: 454 },
    ],
    says: "calling C without JNI. five incubators and three previews before going final in 22: the longest road on this chart that has actually finished.",
  },
  {
    id: "switchpat",
    short: "switch patterns",
    name: "pattern matching for switch",
    kind: "lang",
    chapter: "/learn/modern/pattern-matching",
    steps: [
      { v: 17, s: "p", jep: 406 },
      { v: 18, s: "p", jep: 420 },
      { v: 19, s: "p", jep: 427, note: "guards became when" },
      { v: 20, s: "p", jep: 433 },
      { v: 21, s: "f", jep: 441 },
    ],
    says: "type patterns, guards and case null in switch. four previews: the guard syntax changed from && to when along the way.",
  },
  {
    id: "recpat",
    short: "record patterns",
    name: "record patterns",
    kind: "lang",
    chapter: "/learn/modern/record-patterns",
    steps: [
      { v: 19, s: "p", jep: 405 },
      { v: 20, s: "p", jep: 432, note: "record patterns in enhanced for" },
      { v: 21, s: "f", jep: 440, note: "...which was dropped again" },
    ],
    says: "deconstructing records right in the pattern. the second preview added patterns in enhanced for loops, and the final version removed them.",
  },
  {
    id: "vthreads",
    short: "virtual threads",
    name: "virtual threads",
    kind: "jvm",
    chapter: "/learn/concurrency/virtual-threads",
    steps: [
      { v: 19, s: "p", jep: 425 },
      { v: 20, s: "p", jep: 436 },
      { v: 21, s: "f", jep: 444 },
    ],
    says: "project loom's big one. two previews, final in the 21 LTS. (24 then fixed pinning on synchronized, JEP 491.)",
  },
  {
    id: "templates",
    short: "string templates",
    name: "string templates",
    kind: "lang",
    steps: [
      { v: 21, s: "p", jep: 430 },
      { v: 22, s: "p", jep: 459 },
      { v: 23, s: "x", jep: 465, note: "proposed third preview, withdrawn" },
    ],
    says: "STR.\"hello \\{name}\". previewed twice, then pulled in 2024 to rethink the design, so 23 shipped without it. proof that preview really means preview.",
  },
  {
    id: "unnamed",
    short: "unnamed _",
    name: "unnamed variables and patterns",
    kind: "lang",
    chapter: "/learn/modern/record-patterns",
    steps: [
      { v: 21, s: "p", jep: 443 },
      { v: 22, s: "f", jep: 456 },
    ],
    says: "_ for things you don't need. one preview, then final.",
  },
  {
    id: "classfile",
    short: "class-file API",
    name: "class-file API",
    kind: "api",
    chapter: "/learn/meta/class-file-api",
    steps: [
      { v: 22, s: "p", jep: 457 },
      { v: 23, s: "p", jep: 466 },
      { v: 24, s: "f", jep: 484 },
    ],
    says: "reading and writing .class files from the JDK itself, so the JDK can stop depending on a bundled copy of ASM.",
  },
  {
    id: "gatherers",
    short: "stream gatherers",
    name: "stream gatherers",
    kind: "api",
    chapter: "/learn/functional/gatherers",
    steps: [
      { v: 22, s: "p", jep: 461 },
      { v: 23, s: "p", jep: 473 },
      { v: 24, s: "f", jep: 485 },
    ],
    says: "custom intermediate stream operations. two previews, no changes, final in 24.",
  },
  {
    id: "flex",
    short: "flexible constructors",
    name: "flexible constructor bodies",
    kind: "lang",
    chapter: "/learn/modern/flexible-constructors",
    steps: [
      { v: 22, s: "p", jep: 447, note: "statements before super(...)" },
      { v: 23, s: "p", jep: 482, note: "renamed, fields may be set early" },
      { v: 24, s: "p", jep: 492 },
      { v: 25, s: "f", jep: 513 },
    ],
    says: "code before super(...). started life as \"statements before super\" and grew the ability to initialize fields early.",
  },
  {
    id: "imports",
    short: "module imports",
    name: "module import declarations",
    kind: "lang",
    chapter: "/learn/modern/simpler-programs",
    steps: [
      { v: 23, s: "p", jep: 476 },
      { v: 24, s: "p", jep: 494 },
      { v: 25, s: "f", jep: 511 },
    ],
    says: "import module java.base; imports every package a module exports.",
  },
  {
    id: "compact",
    short: "compact source files",
    name: "compact source files and instance main",
    kind: "lang",
    chapter: "/learn/modern/simpler-programs",
    steps: [
      { v: 21, s: "p", jep: 445, note: "unnamed classes" },
      { v: 22, s: "p", jep: 463, note: "implicitly declared classes" },
      { v: 23, s: "p", jep: 477 },
      { v: 24, s: "p", jep: 495, note: "simple source files" },
      { v: 25, s: "f", jep: 512 },
    ],
    says: "void main() { IO.println(\"hi\"); }. four previews and three names before it settled.",
  },
  {
    id: "scoped",
    short: "scoped values",
    name: "scoped values",
    kind: "api",
    chapter: "/learn/concurrency/structured-concurrency",
    steps: [
      { v: 20, s: "i", jep: 429 },
      { v: 21, s: "p", jep: 446 },
      { v: 22, s: "p", jep: 464 },
      { v: 23, s: "p", jep: 481 },
      { v: 24, s: "p", jep: 487 },
      { v: 25, s: "f", jep: 506 },
    ],
    says: "an immutable, inheritable alternative to ThreadLocal, built for virtual threads.",
  },
  {
    id: "sc",
    short: "structured concurrency",
    name: "structured concurrency",
    kind: "api",
    chapter: "/learn/concurrency/structured-concurrency",
    steps: [
      { v: 19, s: "i", jep: 428 },
      { v: 20, s: "i", jep: 437 },
      { v: 21, s: "p", jep: 453, note: "fork returns Subtask" },
      { v: 22, s: "p", jep: 462 },
      { v: 23, s: "p", jep: 480 },
      { v: 24, s: "p", jep: 499 },
      { v: 25, s: "p", jep: 505, note: "StructuredTaskScope.open()" },
      { v: 26, s: "p", jep: 525 },
      { v: 27, s: "p", jep: 533, note: "join() throws ExecutionException" },
      { v: 28, s: "t", jep: 543, note: "proposed final" },
    ],
    says: "task trees that fail and cancel together. two incubators and seven previews, and the API kept changing, so code from one preview often doesn't compile on the next. JEP 543 proposes finishing it in 28.",
  },
  {
    id: "primpat",
    short: "primitive patterns",
    name: "primitive types in patterns",
    kind: "lang",
    chapter: "/learn/modern/in-preview",
    steps: [
      { v: 23, s: "p", jep: 455 },
      { v: 24, s: "p", jep: 488 },
      { v: 25, s: "p", jep: 507 },
      { v: 26, s: "p", jep: 530, note: "stricter exactness and dominance" },
      { v: 27, s: "p", jep: 532 },
    ],
    says: "case int i, x instanceof byte b. five previews so far, still preview in 27.",
  },
  {
    id: "lazy",
    short: "lazy constants",
    name: "lazy constants",
    kind: "api",
    chapter: "/learn/modern/in-preview",
    steps: [
      { v: 25, s: "p", jep: 502, note: "as StableValue" },
      { v: 26, s: "p", jep: 526, note: "renamed LazyConstant" },
      { v: 27, s: "p", jep: 531 },
    ],
    says: "values computed once, on first use, that the JVM can then treat like constants. started as StableValue in 25. a fourth preview (JEP 547) is a candidate for 28.",
  },
  {
    id: "pem",
    short: "PEM encodings",
    name: "PEM encodings",
    kind: "api",
    chapter: "/learn/modern/in-preview",
    steps: [
      { v: 25, s: "p", jep: 470 },
      { v: 26, s: "p", jep: 524 },
      { v: 27, s: "p", jep: 538 },
      { v: 28, s: "t", jep: 542, note: "targeted final" },
    ],
    says: "reading and writing keys and certificates in the -----BEGIN----- text format, without a third-party library. targeted to go final in 28.",
  },
  {
    id: "vector",
    short: "vector API",
    name: "vector API",
    kind: "api",
    chapter: "/learn/performance/vector-api",
    steps: [
      { v: 16, s: "i", jep: 338 },
      { v: 17, s: "i", jep: 414 },
      { v: 18, s: "i", jep: 417 },
      { v: 19, s: "i", jep: 426 },
      { v: 20, s: "i", jep: 438 },
      { v: 21, s: "i", jep: 448 },
      { v: 22, s: "i", jep: 460 },
      { v: 23, s: "i", jep: 469 },
      { v: 24, s: "i", jep: 489 },
      { v: 25, s: "i", jep: 508 },
      { v: 26, s: "i", jep: 529 },
      { v: 27, s: "i", jep: 537 },
    ],
    says: "SIMD from plain java. twelve incubators and counting: it's waiting on valhalla's value classes before it can become a preview.",
  },
  {
    id: "coh",
    short: "compact headers",
    name: "compact object headers",
    kind: "jvm",
    chapter: "/learn/jvm/object-layout",
    steps: [
      { v: 24, s: "e", jep: 450 },
      { v: 25, s: "f", jep: 519, note: "a product option, off by default" },
      { v: 27, s: "f", jep: 534, note: "on by default" },
    ],
    says: "8-byte object headers instead of 12, which shrinks most heaps. JVM features don't preview, they go experimental (-XX:+UnlockExperimentalVMOptions) first.",
  },
  {
    id: "valhalla",
    short: "value objects",
    name: "value objects",
    kind: "lang",
    chapter: "/learn/future/valhalla",
    steps: [{ v: 28, s: "t", jep: 401, note: "targeted, first preview" }],
    says: "objects without identity, so the JVM can flatten them. project valhalla's first preview, targeted to jdk 28.",
  },
];

export const STAGE_LABEL: Record<Stage, string> = {
  i: "incubator",
  p: "preview",
  e: "experimental",
  f: "final",
  x: "withdrawn",
  t: "in development",
};
