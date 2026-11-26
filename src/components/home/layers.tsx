import type { ReactNode } from "react";
import { DotArt } from "./DotArt";

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
  /** a small dot drawing of this depth, on the hero's grid (see DotArt) */
  art: string[];
  artLabel: string;
};

const k = (s: string) => <span className="text-hi">{s}</span>;
const d = (s: string) => <span className="text-faint">{s}</span>;
const lit = (s: string) => <span className="text-[var(--code-lit)]">{s}</span>;
const hot = (s: string) => <span className="text-hot">{s}</span>;

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="font-mono text-13 text-ink">
      <div className="mb-4 font-[family-name:var(--font-addr)] text-11 text-faint">{label}</div>
      <div className="min-h-0 overflow-x-auto overflow-y-hidden">{children}</div>
    </div>
  );
}

const pre = "whitespace-pre text-13 leading-[1.8]";

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
    art: [".........", "oooo.ooo.", "..ooohhh.", "o........", "........."],
    artLabel: "three rows of dots for three lines of code, the string hello lit",
    stage: (
      <Panel label="Main.java">
        <pre className="text-15 leading-[1.8] whitespace-pre sm:text-17">
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
    art: ["o.oo.o.hh", ".........", "mmm......", ".rRoo....", "..rRooo..", "...rRhh.."],
    artLabel: "a row of tokens, then a tree: class, method, call, literal",
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
    art: [".........", "m.hhh.oo.", "m.oooooo.", "m.oooo...", "........."],
    artLabel: "three instructions, the first one lit",
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
    art: [".........", "hhhhmmmm.", "oooooooo.", "oooooooo.", "ooooo...."],
    artLabel: "bytes in rows: four magic bytes lit, four version bytes in the header colour",
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
    art: [".........", "moooooo..", "rRmooo...", "..rRmhh..", "........."],
    artLabel: "three class loaders, each a child of the one above, Main lit in the last",
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
    art: [".........", "oRrrrRmhh", "oo....mhh", "oo.......", "oo......."],
    artLabel: "an operand stack whose top slot points at the hello string",
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
    art: ["oo.......", "ooo......", "oooo.....", "ooooo....", "hhhhhhh.."],
    artLabel: "five tiers as bars, the last and longest lit",
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
    art: [".........", "h.hh.h.hh", "o.oo..o.o", ".........", "........."],
    artLabel: "two machine instructions as rows of bits",
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
    art: ["mll..mxx.", "mll..mxx.", ".........", "mxx.mlll.", "....mlll."],
    artLabel: "a small heap: live objects filled, garbage as hollow rings, free dots between",
    stage: (
      <Panel label="the heap, drawn mid-collection">
        <div className="max-w-[460px]">
          <DotArt
            label="a heap of objects: most are live and filled, some are garbage drawn as hollow rings, and free dots sit between them"
            rows={[
              "mlll.mxx..mllll.mxxx.mll",
              "mlll.mxx..mllll.mxxx.mll",
              "..........mllll.........",
              "mxxx.mllll....mll.mxx...",
              "mxxx.mllll....mll.mxx.ml",
              "..............mll.....ml",
            ]}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-[family-name:var(--font-ui)] text-12">
          <span className="text-live">reachable, kept</span>
          <span className="text-dead">garbage, about to be freed</span>
          <span className="text-mute">free</span>
        </div>
      </Panel>
    ),
  },
];
