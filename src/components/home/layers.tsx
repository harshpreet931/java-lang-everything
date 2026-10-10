import type { ReactNode } from "react";

// the descent: one line of java, followed all the way down.
// every artifact here is real output from jdk 25 (temurin 25.0.4, macOS aarch64),
// except the machine code, which is labelled as simplified.

export type Layer = {
  id: string;
  title: string;
  /** what the reader learns at this depth, in two or three lines */
  text: ReactNode;
  href: string;
  linkLabel: string;
  stage: ReactNode;
};

const k = (s: string) => <span className="text-hi">{s}</span>;
const d = (s: string) => <span className="text-faint">{s}</span>;
const lit = (s: string) => <span className="text-[var(--code-lit)]">{s}</span>;
const hot = (s: string) => <span className="text-hot">{s}</span>;

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-center pb-4 font-mono text-13">
      <div className="mb-6 text-12 text-faint">{label}</div>
      <div className="min-h-0 overflow-x-auto overflow-y-hidden">{children}</div>
    </div>
  );
}

const pre = "whitespace-pre text-13 leading-[1.85] sm:text-14";

export const layers: Layer[] = [
  {
    id: "source",
    title: "your code",
    text: (
      <>
        three lines. since java 25 you don&apos;t even need a class. this is what you write, and it&apos;s the only layer most
        people ever look at.
      </>
    ),
    href: "/learn/start/hello-world",
    linkLabel: "hello, world",
    stage: (
      <Panel label="Main.java">
        <pre className="text-15 leading-[1.85] whitespace-pre sm:text-[clamp(1rem,0.6rem+0.9vw,1.375rem)]">
          {k("void")} main() {d("{")}
          {"\n    "}IO.println({lit('"hello"')});
          {"\n"}
          {d("}")}
        </pre>
      </Panel>
    ),
  },
  {
    id: "javac",
    title: "javac",
    text: (
      <>
        the compiler reads characters, groups them into tokens, builds a tree and checks every type. it also wraps your
        method in an implicit <code>final class Main</code>, because the JVM only understands classes.
      </>
    ),
    href: "/learn/start/compile-and-run",
    linkLabel: "compile and run",
    stage: (
      <Panel label="tokens → tree">
        <div className="flex flex-wrap gap-1.5 text-13">
          {["void", "main", "(", ")", "{", "IO", ".", "println", "(", '"hello"', ")", ";", "}"].map((t, i) => (
            <span key={i} className="rounded-xs px-2 py-1 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
              {t}
            </span>
          ))}
        </div>
        <pre className={`${pre} mt-6 text-mute`}>
          {"final class Main\n"}
          {"└── method main()\n"}
          {"    └── call "}
          {k("IO.println")}
          {"\n        └── literal "}
          {lit('"hello"')}
        </pre>
      </Panel>
    ),
  },
  {
    id: "bytecode",
    title: "bytecode",
    text: (
      <>
        javac doesn&apos;t make machine code. it makes instructions for an imaginary stack machine: push a constant, call
        a static method, return. three of them, for your whole program.
      </>
    ),
    href: "/learn/jvm/bytecode",
    linkLabel: "bytecode",
    stage: (
      <Panel label="javap -c Main.class">
        <pre className={pre}>
          {d("void main();\n  Code:\n")}
          {"     0: "}
          {k("ldc")}
          {"           #7   "}
          {d("// String hello")}
          {"\n     2: "}
          {k("invokestatic")}
          {"  #9   "}
          {d("// Method java/lang/IO.println")}
          {"\n     5: "}
          {k("return")}
        </pre>
      </Panel>
    ),
  },
  {
    id: "classfile",
    title: "the class file",
    text: (
      <>
        all of that, packed into 310 bytes. the first four are always <code>CA FE BA BE</code>. the next four say which
        java it was compiled for: <code>0x45</code> is 69, which means java 25.
      </>
    ),
    href: "/learn/jvm/class-file-format",
    linkLabel: "the class file",
    stage: (
      <Panel label="xxd Main.class">
        <pre className={`${pre} !text-12 sm:!text-13`}>
          {d("00000000: ")}
          {hot("cafe babe")} <span className="text-meta">0000 0045</span> 0016 0a00 0200 0307{"\n"}
          {d("00000010: ")}0004 0c00 0500 0601 0010 6a61 7661 2f6c{"\n"}
          {d("00000020: ")}616e 672f 4f62 6a65 6374 0100 063c 696e{"\n"}
          {d("00000030: ")}6974 3e01 0003 2829 5608 0008 0100 0568{"\n"}
          {d("00000040: ")}
          <span className="text-hi">656c 6c6f</span> 0a00 0a00 0b07 000c 0c00 0d00{"\n"}
          {d("00000050: ")}0e01 000c 6a61 7661 2f6c 616e 672f 494f{"\n"}
          {d("   ...   ")}
          {d("310 bytes total")}
        </pre>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-11">
          <span>
            <span className="text-hot">cafe babe</span> <span className="text-faint">magic</span>
          </span>
          <span>
            <span className="text-meta">0045</span> <span className="text-faint">major version 69</span>
          </span>
          <span>
            <span className="text-hi">656c 6c6f</span> <span className="text-faint">&quot;hello&quot;</span>
          </span>
        </div>
      </Panel>
    ),
  },
  {
    id: "loading",
    title: "class loading",
    text: (
      <>
        <code>java Main</code> starts the JVM, and a class loader finds <code>Main.class</code>, checks it, and turns it into
        a live class. <code>IO</code> comes from the JDK itself, via a different loader. hello world loads 418 classes before it exits.
      </>
    ),
    href: "/learn/jvm/classloaders",
    linkLabel: "class loaders",
    stage: (
      <Panel label="java -Xlog:class+load Main">
        <pre className={`${pre} !text-12 sm:!text-13`}>
          {d("[0.007s] ")}java.lang.Object {d("source: shared objects file")}
          {"\n"}
          {d("   ...    ")}
          {d("400 more JDK classes")}
          {"\n"}
          {d("[0.017s] ")}
          {k("Main")} {d("source: file:/…/descent/")}
          {"\n"}
          {d("[0.018s] ")}java.lang.IO {d("source: jrt:/java.base")}
        </pre>
        <pre className={`${pre} mt-6 text-mute`}>
          {"bootstrap loader   "}
          {d("java.lang.*  (IO, Object)")}
          {"\n  └── platform loader\n        └── app loader   "}
          <span className="text-meta">Main</span>
        </pre>
      </Panel>
    ),
  },
  {
    id: "interpreter",
    title: "the interpreter",
    text: (
      <>
        the JVM runs the bytecode one instruction at a time, pushing and popping an operand stack. it&apos;s slow-ish, and
        that&apos;s fine: most code only ever runs a few times.
      </>
    ),
    href: "/learn/jvm/bytecode",
    linkLabel: "bytecode, stepped",
    stage: (
      <Panel label="operand stack">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8">
          <pre className={pre}>
            {"  "}
            {hot("→")} {k("ldc")} {d('"hello"')}
            {"\n    invokestatic IO.println\n    return"}
          </pre>
          <div className="flex w-36 flex-col-reverse gap-1">
            <div className="flex h-9 items-center justify-center rounded-xs text-12 text-ref shadow-[inset_0_0_0_1px_var(--ref)]">
              ● → &quot;hello&quot;
            </div>
            <div className="h-9 rounded-xs shadow-[inset_0_0_0_1px_var(--line)]" />
            <div className="h-9 rounded-xs shadow-[inset_0_0_0_1px_var(--line)]" />
          </div>
        </div>
        <p className="mt-6 text-12 text-faint">
          ldc pushes a <span className="text-ref">reference</span> to the &quot;hello&quot; string. invokestatic pops it and
          calls println.
        </p>
      </Panel>
    ),
  },
  {
    id: "jit",
    title: "the JIT",
    text: (
      <>
        run something a million times and the JVM notices. it compiles the hot method to native code with C1 (fast to
        compile), then again with C2 (fast to run). this is real output: tier 3, then tier 4, within the first 15 ms.
      </>
    ),
    href: "/learn/jvm/interpreter-and-jit",
    linkLabel: "the interpreter and the JIT",
    stage: (
      <Panel label="java -XX:+PrintCompilation Main">
        <pre className={`${pre} !text-12 sm:!text-13`}>
          {d("ms  id   tier")}
          {"\n"}
          {"15   9      3  "}Main::square {d("(4 bytes)")}
          {"\n"}
          {"15  10      "}
          {hot("4")}
          {"  "}Main::square {d("(4 bytes)")}
          {"\n"}
          {"15   9      3  "}
          <span className="text-dead">Main::square</span> {d("made not entrant")}
          {"\n"}
          {"16  11 "}
          <span className="text-meta">%</span>
          {"    3  "}Main::main @ 4 {d("(32 bytes)")}
          {"\n"}
          {"16  13 "}
          <span className="text-meta">%</span>
          {"    "}
          {hot("4")}
          {"  "}Main::main @ 4 {d("(32 bytes)")}
        </pre>
        <div className="mt-6 grid grid-cols-5 gap-1 text-center text-11">
          {["0 interp", "1 c1", "2 c1", "3 c1+prof", "4 c2"].map((t, i) => (
            <div key={t} className="flex flex-col gap-1.5">
              <div
                className="h-1.5 rounded-xs"
                style={{ background: i === 0 || i === 3 ? "var(--line-2)" : i === 4 ? "var(--hot)" : "var(--line)" }}
              />
              <span className={i === 4 ? "text-hot" : "text-faint"}>{t}</span>
            </div>
          ))}
        </div>
      </Panel>
    ),
  },
  {
    id: "machine",
    title: "machine code",
    text: (
      <>
        and at the bottom, it&apos;s just instructions for your CPU. <code>square(x)</code> becomes a multiply and a return.
        (simplified: real C2 output has a prologue, a safepoint poll and some bookkeeping around it.)
      </>
    ),
    href: "/learn/jvm/jit-optimizations",
    linkLabel: "JIT optimizations",
    stage: (
      <Panel label="arm64, simplified">
        <pre className={pre}>
          {d("; int square(int x)   x arrives in w1\n")}
          {"  "}
          {k("mul")}
          {"   w0, w1, w1   "}
          {d("; w0 = x * x")}
          {"\n  "}
          {k("ret")}
          {"              "}
          {d("; back to the caller")}
        </pre>
        <p className="mt-6 text-12 text-faint">
          from <code className="text-ink">IO.println(&quot;hello&quot;)</code> to here is six layers. this site teaches all of them.
        </p>
      </Panel>
    ),
  },
  {
    id: "gc",
    title: "and the garbage collector",
    text: (
      <>
        meanwhile, every object you made sits on the heap, and a collector keeps finding the ones nothing points at
        anymore. you never call it. it&apos;s always there.
      </>
    ),
    href: "/learn/gc/gc-fundamentals",
    linkLabel: "how garbage collection works",
    stage: (
      <Panel label="heap">
        <div className="grid max-w-[440px] grid-cols-12 gap-1" aria-hidden>
          {Array.from({ length: 72 }, (_, i) => {
            const dead = [3, 7, 9, 14, 18, 21, 26, 29, 33, 38, 41, 45, 50, 55, 58, 63, 66, 70].includes(i);
            const free = [5, 11, 23, 35, 44, 47, 52, 61, 69, 71].includes(i);
            return (
              <div
                key={i}
                className={`aspect-square rounded-xs ${dead ? "gc-dead" : ""}`}
                style={{
                  boxShadow: `inset 0 0 0 1px ${free ? "var(--line)" : dead ? "var(--dead)" : "var(--live)"}`,
                  background: free
                    ? "transparent"
                    : dead
                      ? "color-mix(in srgb, var(--dead) 16%, transparent)"
                      : "color-mix(in srgb, var(--live) 14%, transparent)",
                  animationDelay: `${(i % 12) * 70}ms`,
                }}
              />
            );
          })}
        </div>
        <div className="mt-5 flex gap-5 text-11">
          <span className="text-live">reachable</span>
          <span className="text-dead">garbage</span>
          <span className="text-faint">free</span>
        </div>
      </Panel>
    ),
  },
];
