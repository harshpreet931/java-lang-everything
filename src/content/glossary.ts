// the dictionary. every term links to the chapter that explains it best.
// keep `short` to one line, lowercase, no em dashes.
//
// core terms are below. each part adds its own in content/<part>/terms.json:
//   [{ "term": "TLAB", "short": "one line, lowercase", "chapter": "allocation-and-tlabs", "aka": ["thread local allocation buffer"] }]
import t0 from "@content/start/terms.json";
import t1 from "@content/basics/terms.json";
import t2 from "@content/oop/terms.json";
import t3 from "@content/core-api/terms.json";
import t4 from "@content/generics/terms.json";
import t5 from "@content/collections/terms.json";
import t6 from "@content/functional/terms.json";
import t7 from "@content/modern/terms.json";
import t8 from "@content/concurrency/terms.json";
import t9 from "@content/io/terms.json";
import t10 from "@content/meta/terms.json";
import t11 from "@content/tooling/terms.json";
import t12 from "@content/jvm/terms.json";
import t13 from "@content/gc/terms.json";
import t14 from "@content/performance/terms.json";
import t15 from "@content/effective-java/terms.json";
import t16 from "@content/deep-dives/terms.json";
import t17 from "@content/future/terms.json";

export type Term = {
  id: string;
  term: string;
  short: string;
  /** chapter href that explains it best */
  href: string;
  /** other spellings people search for */
  aka?: string[];
};

const t = (term: string, short: string, href: string, aka?: string[]): Term => ({
  id: term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, ""),
  term,
  short,
  href,
  aka,
});

const core: Term[] = [
  t("JVM", "the java virtual machine. a program that runs bytecode on any OS.", "/learn/start/what-is-java", ["java virtual machine"]),
  t("JDK", "java development kit. the JVM plus javac, jar, jshell and the rest of the tools.", "/learn/start/what-is-java"),
  t("JRE", "java runtime environment. the JVM plus the standard library, without the dev tools. mostly historical now.", "/learn/start/what-is-java"),
  t("bytecode", "the instruction set of the JVM. what javac produces, what the JVM runs.", "/learn/jvm/bytecode"),
  t("javac", "the java compiler. .java in, .class out.", "/learn/start/compile-and-run"),
  t("class file", "the binary file javac produces. starts with CAFEBABE.", "/learn/jvm/class-file-format"),
  t("primitive", "one of the 8 non-object types: byte, short, int, long, float, double, char, boolean.", "/learn/basics/variables-and-primitives"),
  t("reference", "a value that points at an object on the heap. never the object itself.", "/learn/basics/stack-and-heap"),
  t("stack frame", "the chunk of the thread's stack a method call gets for its locals and operands.", "/learn/basics/call-stack-and-recursion"),
  t("heap", "the shared memory where every object lives. cleaned up by the garbage collector.", "/learn/basics/stack-and-heap"),
  t("pass-by-value", "java copies the value of every argument. for objects, the value is the reference.", "/learn/basics/pass-by-value"),
  t("autoboxing", "the compiler quietly converting int ↔ Integer for you.", "/learn/core-api/wrappers-and-boxing"),
  t("integer cache", "Integer.valueOf reuses objects for -128..127, which is why == works there and nowhere else.", "/learn/deep-dives/integer-cache"),
  t("string pool", "the JVM's table of interned strings. every literal lives there once.", "/learn/deep-dives/string-pool", ["intern"]),
  t("immutable", "can't change after construction. String, Integer, records (shallowly).", "/learn/oop/immutability"),
  t("polymorphism", "one call site, different behaviour depending on the object's runtime class.", "/learn/oop/polymorphism"),
  t("dynamic dispatch", "picking which override to run at runtime, from the object's actual class.", "/learn/oop/polymorphism", ["virtual method"]),
  t("vtable", "a per-class table of method pointers the JVM uses for fast virtual calls.", "/learn/oop/polymorphism"),
  t("interface", "a type that only describes what something can do. can have default methods since java 8.", "/learn/oop/abstract-classes-and-interfaces"),
  t("record", "a class that's just its data. constructor, accessors, equals, hashCode and toString for free.", "/learn/modern/records"),
  t("sealed", "a class or interface that lists exactly who may extend it.", "/learn/modern/sealed-types"),
  t("pattern matching", "testing a value's shape and pulling it apart in one step.", "/learn/modern/pattern-matching"),
  t("generics", "type parameters like List<String>. checked at compile time, erased at runtime.", "/learn/generics/why-generics"),
  t("type erasure", "the compiler removing generic type arguments after checking them.", "/learn/generics/type-erasure"),
  t("PECS", "producer extends, consumer super. how to pick between ? extends and ? super.", "/learn/generics/wildcards-and-pecs"),
  t("hashCode", "an int summary of an object. equal objects must have equal hash codes.", "/learn/oop/object-methods"),
  t("load factor", "how full a HashMap may get before it doubles. 0.75 by default.", "/learn/collections/hashmap"),
  t("treeification", "a HashMap bucket turning from a linked list into a red-black tree after 8 collisions.", "/learn/deep-dives/hashmap-internals"),
  t("fail-fast", "iterators that throw ConcurrentModificationException when the collection changes under them.", "/learn/collections/iterators-and-fail-fast"),
  t("lambda", "an anonymous function. compiled with invokedynamic, not anonymous classes.", "/learn/functional/lambdas"),
  t("functional interface", "an interface with exactly one abstract method. lambdas target these.", "/learn/functional/functional-interfaces"),
  t("stream", "a lazy pipeline over a source. nothing runs until a terminal operation.", "/learn/functional/stream-pipeline"),
  t("collector", "a recipe for folding a stream into a result: a list, a map, a string.", "/learn/functional/collectors"),
  t("gatherer", "a custom intermediate stream operation. java 24.", "/learn/functional/gatherers"),
  t("thread", "an independent path of execution with its own stack.", "/learn/concurrency/threads"),
  t("race condition", "a bug where the result depends on how threads happen to interleave.", "/learn/concurrency/race-conditions", ["data race"]),
  t("monitor", "the lock every java object carries. what synchronized grabs.", "/learn/concurrency/synchronized"),
  t("happens-before", "the memory model's guarantee that one action's effects are visible to another.", "/learn/concurrency/java-memory-model"),
  t("volatile", "a field whose writes are immediately visible to other threads, and never reordered around.", "/learn/concurrency/java-memory-model"),
  t("CAS", "compare-and-swap. an atomic cpu instruction: set it to B, but only if it's still A.", "/learn/concurrency/atomics-and-cas", ["compare and swap"]),
  t("deadlock", "two or more threads each waiting for a lock the other holds. forever.", "/learn/concurrency/deadlocks-and-liveness"),
  t("thread pool", "a fixed crew of threads that pull tasks off a queue.", "/learn/concurrency/executors"),
  t("virtual thread", "a cheap thread managed by the JVM, mounted on a platform thread only while running.", "/learn/concurrency/virtual-threads"),
  t("carrier thread", "the platform thread a virtual thread is currently mounted on.", "/learn/concurrency/virtual-threads"),
  t("pinning", "a virtual thread stuck to its carrier, unable to unmount while blocked.", "/learn/deep-dives/virtual-thread-internals"),
  t("class loader", "the object that finds a class's bytes and turns them into a Class.", "/learn/jvm/classloaders"),
  t("JIT", "just-in-time compiler. turns hot bytecode into native machine code while the program runs.", "/learn/jvm/interpreter-and-jit"),
  t("C1 / C2", "the JVM's two JIT compilers. C1 compiles fast, C2 compiles well.", "/learn/jvm/interpreter-and-jit"),
  t("inlining", "the JIT pasting a called method's body into the caller. the mother of all optimizations.", "/learn/jvm/jit-optimizations"),
  t("escape analysis", "the JIT proving an object never leaves a method, so it doesn't need the heap.", "/learn/jvm/jit-optimizations"),
  t("deoptimization", "the JVM throwing away compiled code when an assumption it made turns out wrong.", "/learn/jvm/jit-optimizations"),
  t("safepoint", "a point where a thread can be safely paused so the JVM can do global work.", "/learn/jvm/safepoints"),
  t("mark word", "the first header word of every object: hash, lock state, GC age.", "/learn/jvm/object-layout"),
  t("garbage collection", "finding objects nothing can reach anymore, and reusing their memory.", "/learn/gc/gc-fundamentals", ["gc"]),
  t("GC root", "a starting point for reachability: locals on stacks, statics, JNI handles.", "/learn/gc/reachability-and-references"),
  t("stop-the-world", "a pause where every application thread is frozen so the GC can work.", "/learn/gc/gc-fundamentals", ["stw"]),
  t("generational hypothesis", "most objects die young. the reason heaps are split into young and old.", "/learn/gc/generational-gc"),
  t("TLAB", "thread-local allocation buffer. each thread's private slice of eden for fast allocation.", "/learn/gc/allocation-and-tlabs"),
  t("G1", "the garbage-first collector. region-based, the default since java 9.", "/learn/gc/g1"),
  t("ZGC", "a concurrent collector with sub-millisecond pauses, using colored pointers.", "/learn/gc/zgc"),
  t("metaspace", "native memory where the JVM keeps class metadata. replaced permgen in java 8.", "/learn/gc/runtime-data-areas"),
  t("OutOfMemoryError", "thrown when the JVM can't get memory it needs. there are like seven kinds.", "/learn/deep-dives/out-of-memory-zoo", ["oom"]),
  t("invokedynamic", "a bytecode whose call target is decided at runtime by a bootstrap method.", "/learn/meta/invokedynamic", ["indy"]),
  t("reflection", "inspecting and calling classes, fields and methods at runtime by name.", "/learn/meta/reflection"),
  t("annotation", "metadata on code. @Override, @Deprecated, or your own.", "/learn/meta/annotations"),
  t("module", "a named group of packages with explicit exports and requires. java 9.", "/learn/tooling/modules", ["jpms"]),
  t("JFR", "java flight recorder. a low-overhead event recorder built into the JVM.", "/learn/performance/jfr-and-jmc"),
  t("JMH", "the java microbenchmark harness. the only sane way to benchmark small code.", "/learn/performance/jmh"),
  t("false sharing", "two threads writing different variables that share a cpu cache line, slowing each other down.", "/learn/performance/mechanical-sympathy"),
  t("FFM", "the foreign function and memory api. call C and manage off-heap memory from java.", "/learn/performance/ffm-api", ["panama"]),
  t("LTS", "long-term support. every 2 years a release gets years of updates. 21 and 25 are LTS.", "/learn/modern/release-timeline"),
  t("preview feature", "a finished-but-not-final feature you can try with --enable-preview.", "/learn/modern/preview-features"),
  t("value object", "an object without identity, so the JVM can flatten it. valhalla.", "/learn/future/valhalla"),
];

type PartTerm = { term: string; short: string; chapter: string; aka?: string[] };
const perPart: [string, PartTerm[]][] = [
  ["start", t0 as PartTerm[]],
  ["basics", t1 as PartTerm[]],
  ["oop", t2 as PartTerm[]],
  ["core-api", t3 as PartTerm[]],
  ["generics", t4 as PartTerm[]],
  ["collections", t5 as PartTerm[]],
  ["functional", t6 as PartTerm[]],
  ["modern", t7 as PartTerm[]],
  ["concurrency", t8 as PartTerm[]],
  ["io", t9 as PartTerm[]],
  ["meta", t10 as PartTerm[]],
  ["tooling", t11 as PartTerm[]],
  ["jvm", t12 as PartTerm[]],
  ["gc", t13 as PartTerm[]],
  ["performance", t14 as PartTerm[]],
  ["effective-java", t15 as PartTerm[]],
  ["deep-dives", t16 as PartTerm[]],
  ["future", t17 as PartTerm[]],
];

const seen = new Set(core.map((x) => x.id));
export const glossary: Term[] = [
  ...core,
  ...perPart.flatMap(([part, list]) =>
    list.map((x) => t(x.term, x.short, `/learn/${part}/${x.chapter}`, x.aka)).filter((x) => !seen.has(x.id) && seen.add(x.id)),
  ),
].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
