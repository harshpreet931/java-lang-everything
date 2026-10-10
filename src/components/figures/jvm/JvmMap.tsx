"use client";

import Link from "next/link";
import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// the whole JVM on one page. two modes:
//   explore: click any block to read what it does, with a number measured on a real JVM
//   tour:    step through `java Hello` and watch which blocks light up
//
// numbers measured on jdk 25 (temurin 25.0.4.1, macOS aarch64, M4 Pro, 24 GB),
// from `jcmd <pid> VM.native_memory summary`, `jcmd <pid> Thread.print`,
// `-Xlog:class+load` and `-XX:+PrintCompilation` on a tiny idle program.

type Id =
  | "files"
  | "load"
  | "link"
  | "init"
  | "heap"
  | "meta"
  | "code"
  | "pc"
  | "stack"
  | "nstack"
  | "interp"
  | "c1"
  | "c2"
  | "gc"
  | "jni"
  | "libs";

type Block = { label: string; sub: string; what: string; num?: string; href: string; chapter: string };

const B: Record<Id, Block> = {
  files: {
    label: ".class files",
    sub: "jars, dirs, the jdk image",
    what: "what javac produced. your Hello.class from the classpath, plus the JDK's own classes from lib/modules.",
    num: "java Hello loads 415 classes. 412 of them come pre-parsed from the CDS archive.",
    href: "/learn/jvm/class-file-format",
    chapter: "the class file",
  },
  load: {
    label: "loading",
    sub: "bootstrap · platform · app",
    what: "find the bytes for a class name (a file, a jar, the jrt image, anywhere) and turn them into a class the JVM knows about.",
    num: "Hello was class #402 to load, 21 ms after launch.",
    href: "/learn/jvm/classloaders",
    chapter: "class loaders",
  },
  link: {
    label: "linking",
    sub: "verify · prepare · resolve",
    what: "verify the bytecode can't break the JVM, give static fields their zero values, and turn symbolic names into real pointers (lazily, the first time each one is used).",
    href: "/learn/jvm/class-loading",
    chapter: "class loading",
  },
  init: {
    label: "initialization",
    sub: "<clinit>",
    what: "run the static initializers, once, on the class's first active use. the JVM holds a lock while it does this.",
    href: "/learn/jvm/class-loading",
    chapter: "class loading",
  },
  heap: {
    label: "heap",
    sub: "every object, every array",
    what: "shared by every thread. new allocates here, the GC cleans up here. one big region, split into young and old by the collector.",
    num: "idle on a 24 GB mac: 6 GB reserved (a quarter of RAM), 388 MB committed.",
    href: "/learn/gc/runtime-data-areas",
    chapter: "the JVM's memory map",
  },
  meta: {
    label: "metaspace",
    sub: "class metadata",
    what: "the spec calls it the method area. bytecode, constant pools, field and method tables. native memory, not the heap.",
    num: "815 classes loaded in an idle JVM, ~0.4 MB of metaspace. most class data sits in the 13.6 MB CDS mapping instead.",
    href: "/learn/gc/runtime-data-areas",
    chapter: "the JVM's memory map",
  },
  code: {
    label: "code cache",
    sub: "JIT output",
    what: "where compiled machine code lives. split into segments for JVM stubs, profiled code (C1) and optimized code (C2).",
    num: "244 MB reserved, 7.5 MB committed. hello world compiled 8 methods into it.",
    href: "/learn/jvm/interpreter-and-jit",
    chapter: "the interpreter and the JIT",
  },
  pc: {
    label: "pc register",
    sub: "one per thread",
    what: "which bytecode instruction this thread runs next. undefined while the thread is inside a native method.",
    href: "/learn/jvm/bytecode",
    chapter: "bytecode",
  },
  stack: {
    label: "JVM stack",
    sub: "one per thread",
    what: "a frame per method call. each frame has a local variable array and an operand stack, the two things every bytecode reads and writes.",
    num: "default size on this machine: 2 MB (-Xss).",
    href: "/learn/jvm/bytecode",
    chapter: "bytecode",
  },
  nstack: {
    label: "native stack",
    sub: "one per thread",
    what: "frames for C code reached through JNI, and for the JVM's own C++. in HotSpot it's literally the same OS thread stack as the java frames.",
    href: "/learn/performance/jni",
    chapter: "jni",
  },
  interp: {
    label: "interpreter",
    sub: "tier 0",
    what: "runs bytecode one instruction at a time. HotSpot's is a template interpreter: at startup it generates a little machine code stub for each bytecode, then jumps between them.",
    href: "/learn/jvm/interpreter-and-jit",
    chapter: "the interpreter and the JIT",
  },
  c1: {
    label: "C1",
    sub: "fast JIT · tiers 1-3",
    what: "compiles quickly with light optimization. in tier 3 it also adds counters that record what the code actually does (the profile).",
    href: "/learn/jvm/interpreter-and-jit",
    chapter: "the interpreter and the JIT",
  },
  c2: {
    label: "C2",
    sub: "optimizing JIT · tier 4",
    what: "compiles slowly and well. uses the profile to inline, remove allocations, unroll loops, and bets on assumptions it can take back later.",
    href: "/learn/jvm/jit-optimizations",
    chapter: "JIT optimizations",
  },
  gc: {
    label: "GC",
    sub: "G1 by default",
    what: "finds objects nothing can reach and reuses their memory. it needs every thread stopped at a safepoint for its pauses.",
    num: "5 of the 18 threads in an idle JVM belong to G1.",
    href: "/learn/gc/gc-fundamentals",
    chapter: "how garbage collection works",
  },
  jni: {
    label: "JNI",
    sub: "java ↔ C",
    what: "the bridge between java frames and C functions. every file write, socket read and clock lookup crosses it eventually.",
    href: "/learn/performance/jni",
    chapter: "jni",
  },
  libs: {
    label: "native libraries",
    sub: "libjava, libnio, libjvm",
    what: "C code shipped in the JDK's lib/ folder. libjvm is the JVM itself: the launcher (java) is a tiny program that loads it.",
    href: "/learn/performance/ffm-api",
    chapter: "the foreign function and memory api",
  },
};

const TOUR: { on: Id[]; note: string }[] = [
  { on: ["libs"], note: "you type java Hello. the launcher, a small C program, loads libjvm and asks it to create a VM." },
  { on: ["load", "meta"], note: "the bootstrap loader maps the CDS archive. java.lang.Object, String and 410 more classes appear in metaspace without being parsed." },
  { on: ["files", "load"], note: "the app class loader finds Hello.class on the classpath and defines it. class #402, at 21 ms." },
  { on: ["link"], note: "linking: the verifier checks main's 4 instructions are type-safe. references like System.out stay symbolic for now." },
  { on: ["init"], note: "initialization: Hello has no static state, so there's no <clinit> to run. main can start." },
  { on: ["stack", "pc"], note: "the main thread pushes a frame for main(String[]). the pc register points at instruction 0." },
  { on: ["interp", "meta"], note: "the interpreter runs getstatic System.out. first use, so it resolves the symbolic reference through the constant pool." },
  { on: ["interp", "heap"], note: "ldc \"hello\" pushes a String from the heap, invokevirtual println calls into PrintStream." },
  { on: ["jni", "nstack", "libs"], note: "deep inside println, the bytes reach a native write() through JNI. the same thread's stack now holds C frames." },
  { on: ["c1", "code"], note: "a few JDK methods got hot during startup (String.hashCode, Object.<init>). C1 compiled 8 of them into the code cache." },
  { on: ["gc"], note: "the GC never ran: hello world allocated nowhere near enough to fill even the young generation." },
  { on: [], note: "main returns, no non-daemon threads are left, the VM shuts down. 415 classes, about 25 ms of wall time, start to finish." },
];

export function JvmMap({ tour = false }: { tour?: boolean }) {
  const [sel, setSel] = useState<Id>("heap");
  const s = useStepper(TOUR.length, { interval: 2600 });
  const lit = new Set<Id>(tour ? TOUR[s.i].on : []);
  const info = B[sel];

  const block = (id: Id, wide?: boolean) => {
    const b = B[id];
    const on = tour ? lit.has(id) : sel === id;
    const style = tour
      ? on
        ? "shadow-[inset_0_0_0_1px_var(--hot)] bg-[color-mix(in_srgb,var(--hot)_12%,transparent)]"
        : "bg-bg shadow-[inset_0_0_0_1px_var(--line-2)] opacity-55"
      : on
        ? "bg-well-2 shadow-[inset_0_0_0_1px_var(--mute)]"
        : "bg-bg shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--mute)]";
    const content = (
      <>
        <span className={`block text-13 leading-tight ${tour && on ? "text-hot" : "text-hi"}`}>{b.label}</span>
        <span className={`mt-1 block text-11 leading-tight ${!tour && on ? "text-mute" : "text-faint"}`}>{b.sub}</span>
      </>
    );
    const cls = `min-w-0 rounded-md px-2.5 py-2 text-left transition-[background-color,box-shadow,opacity] duration-200 ease-jle ${wide ? "col-span-full" : ""} ${style}`;
    if (tour) {
      return (
        <div key={id} className={cls}>
          {content}
        </div>
      );
    }
    return (
      <button key={id} className={cls} aria-pressed={on} onClick={() => setSel(id)}>
        {content}
      </button>
    );
  };

  const region = (title: string, children: React.ReactNode, extra = "") => (
    <div className={`relative rounded-md px-2.5 pt-6 pb-2.5 shadow-[inset_0_0_0_1px_var(--line)] ${extra}`}>
      <span className="absolute top-1.5 left-2.5 text-11 text-faint">{title}</span>
      {children}
    </div>
  );

  const down = (label: string) => (
    <div className="flex items-center gap-2 py-1.5 pl-[22%] text-11 text-faint" aria-hidden>
      <span className="h-4 w-px bg-line-2" />
      <span>{label}</span>
    </div>
  );

  return (
    <div {...(tour ? s.keys : {})} className="@container outline-none">
      <div
        className="grid gap-0"
        role={tour ? "img" : undefined}
        aria-label={tour ? `java Hello, step ${s.i + 1}: ${TOUR[s.i].note}` : undefined}
      >
        <div className="grid grid-cols-1 @[560px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">{block("files")}</div>
        {down("bytes in")}
        {region(
          "class loader subsystem",
          <div className="grid grid-cols-1 gap-1.5 @[560px]:grid-cols-[1fr_auto_1fr_auto_1fr] @[560px]:items-center">
            {block("load")}
            <span className="hidden text-faint @[560px]:block" aria-hidden>
              →
            </span>
            {block("link")}
            <span className="hidden text-faint @[560px]:block" aria-hidden>
              →
            </span>
            {block("init")}
          </div>,
        )}
        {down("classes in")}
        {region(
          "runtime data areas",
          <div className="grid gap-2.5 @[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-1.5 text-11 text-mute">shared by all threads</div>
              <div className="grid grid-cols-2 gap-1.5">
                {block("heap", true)}
                {block("meta")}
                {block("code")}
              </div>
            </div>
            <div className="relative">
              <div className="mb-1.5 text-11 text-mute">one set per thread (18 in an idle JVM)</div>
              {/* two hairline outlines peeking out behind: there's one of these per thread */}
              <div className="relative">
                <div className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-md shadow-[inset_0_0_0_1px_var(--line)]" aria-hidden />
                <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-md shadow-[inset_0_0_0_1px_var(--line)]" aria-hidden />
                <div className="relative grid grid-cols-2 gap-1.5 rounded-md bg-well p-1.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
                  {block("stack", true)}
                  {block("pc")}
                  {block("nstack")}
                </div>
              </div>
            </div>
          </div>,
        )}
        {down("reads + writes")}
        <div className="grid gap-2.5 @[560px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {region(
            "execution engine",
            <div className="grid grid-cols-2 gap-1.5 @[380px]:grid-cols-4">
              {block("interp")}
              {block("c1")}
              {block("c2")}
              {block("gc")}
            </div>,
          )}
          {region(
            "native interface",
            <div className="grid grid-cols-2 gap-1.5">
              {block("jni")}
              {block("libs")}
            </div>,
          )}
        </div>
      </div>

      {tour ? (
        <div className="mt-6 grid gap-3">
          <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
            {TOUR[s.i].note}
          </p>
          <StepControls s={s} />
        </div>
      ) : (
        <div className="mt-6 min-h-[9.5em] border-t border-line pt-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-15 text-hi">{info.label}</span>
            <Link href={info.href} className="text-12 text-mute underline decoration-line-2 underline-offset-4 hover:text-hi">
              → {info.chapter}
            </Link>
          </div>
          <p className="mt-2 font-serif text-17 leading-[1.6] text-ink">{info.what}</p>
          {info.num && (
            <p className="mt-2 text-12 leading-[1.6] text-mute">
              <span className="text-hot">measured · </span>
              {info.num}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
