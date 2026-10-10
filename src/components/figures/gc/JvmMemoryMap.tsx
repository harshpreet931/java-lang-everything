"use client";

import { useState, type ReactNode } from "react";

// the memory map of one running JVM, as areas you can click.
// numbers: jdk 25.0.4 (temurin, macOS aarch64, 24 GB, 14 cores), javac compiling three
// small files with -Xmx512m, read from -XX:NativeMemoryTracking=summary at exit.

type Id =
  | "pc"
  | "stack"
  | "heap"
  | "eden"
  | "survivor"
  | "old"
  | "meta"
  | "klass"
  | "code"
  | "gc"
  | "direct"
  | "cds"
  | "rest";

type Area = { name: string; what: ReactNode; sized: ReactNode; out: ReactNode; real: ReactNode; meta?: boolean };

const AREAS: Record<Id, Area> = {
  pc: {
    name: "pc register",
    what: "which bytecode this thread runs next. one per thread. meaningless while the thread is inside native code.",
    sized: "one word. nothing to tune.",
    out: "it can't.",
    real: "one per thread.",
  },
  stack: {
    name: "thread stack",
    what: "a frame per active call: locals, the operand stack, the return address. in HotSpot, java frames and native frames share this one stack.",
    sized: "-Xss. 2 MB reserved per thread on this mac, but pages only become real when a deep call touches them.",
    out: (
      <>
        <span className="text-dead">StackOverflowError</span> when one thread goes too deep.{" "}
        <span className="text-dead">OutOfMemoryError: unable to create native thread</span> when there are too many threads.
      </>
    ),
    real: "14 threads: 30 MB reserved, 0.25 MB committed.",
  },
  heap: {
    name: "java heap",
    what: "every object and every array. string literals too (the string pool lives here), and static fields (they sit inside the Class object).",
    sized: "-Xmx and -Xms. without them the max is 25% of RAM: 6 GB on this 24 GB mac.",
    out: <span className="text-dead">OutOfMemoryError: Java heap space</span>,
    real: "520 MB reserved, 386 MB committed.",
  },
  eden: {
    name: "young gen: eden",
    what: "where new objects are born. each thread bump-allocates in its own slice of it (a TLAB). most objects die here.",
    sized: "the collector sizes it on the fly. G1 aims for whatever fits the pause goal.",
    out: "a full eden isn't an error. it's a young GC.",
    real: "part of the 386 MB.",
  },
  survivor: {
    name: "young gen: survivor",
    what: "objects that survived a young GC or two, waiting to see if they die soon.",
    sized: "a slice of the young gen. -XX:SurvivorRatio for serial and parallel.",
    out: "overflow just promotes objects to old early.",
    real: "part of the 386 MB.",
  },
  old: {
    name: "old gen",
    what: "objects that survived long enough to be promoted. caches, sessions, everything your app keeps.",
    sized: "whatever the heap has left after the young gen.",
    out: "a full old gen means a bigger collection. if that can't free enough: heap space OOM.",
    real: "part of the 386 MB.",
  },
  meta: {
    name: "metaspace",
    meta: true,
    what: "class metadata: method bytecode, constant pools, field layouts, vtables. allocated per class loader and freed when the loader is collected.",
    sized: "-XX:MaxMetaspaceSize. unlimited by default, so it grows until the machine says no.",
    out: <span className="text-dead">OutOfMemoryError: Metaspace</span>,
    real: "3,056 classes loaded: 64 MB reserved, 9.0 MB committed.",
  },
  klass: {
    name: "compressed class space",
    meta: true,
    what: "the Klass structures that object headers point at. one contiguous range, so a header can store a 32-bit offset instead of a 64-bit pointer.",
    sized: "-XX:CompressedClassSpaceSize. 1 GB reserved up front.",
    out: <span className="text-dead">OutOfMemoryError: Compressed class space</span>,
    real: "1,024 MB reserved, 1.25 MB used.",
  },
  code: {
    name: "code cache",
    meta: true,
    what: "machine code. the interpreter and stubs (non-nmethods), C1 code that's still profiling (profiled), and C2's optimized code (non-profiled). three segments since java 9.",
    sized: "-XX:ReservedCodeCacheSize. 240 MB here.",
    out: (
      <>
        a warning, not an exception: <span className="text-dead">CodeCache is full. Compiler has been disabled.</span> the app keeps going,
        interpreted, slowly.
      </>
    ),
    real: "245 MB reserved, 9.2 MB committed.",
  },
  gc: {
    name: "GC data structures",
    meta: true,
    what: "the collector's own bookkeeping: mark bitmaps, card tables, remembered sets, work queues.",
    sized: "depends on the collector and the heap size. -Xmx doesn't cap it.",
    out: "it doesn't fail. the process just gets bigger.",
    real: "G1: 62 MB committed for a 512 MB heap.",
  },
  direct: {
    name: "direct buffers",
    what: "ByteBuffer.allocateDirect: off-heap bytes for fast I/O. the heap only holds a small DirectByteBuffer that points out here.",
    sized: "-XX:MaxDirectMemorySize. defaults to the max heap size.",
    out: <span className="text-dead">OutOfMemoryError: Cannot reserve N bytes of direct buffer memory</span>,
    real: "0 in this run. javac doesn't use any.",
  },
  cds: {
    name: "CDS archive",
    meta: true,
    what: "pre-parsed metadata for the JDK's own classes, mapped straight from a file that ships with the JDK, so startup doesn't parse them all again.",
    sized: "-Xshare, -XX:SharedArchiveFile.",
    out: "it's read-mostly and fixed size.",
    real: "16 MB reserved, 13.6 MB committed.",
  },
  rest: {
    name: "everything else",
    meta: true,
    what: "the symbol table, JIT compiler scratch arenas, native memory tracking itself, safepoint polling pages.",
    sized: "mostly not tunable.",
    out: "native OOM, or the OS kills the process.",
    real: "symbols 2.6 MB, compiler 3.9 MB, arenas 5 MB.",
  },
};

function Cell({
  id,
  sel,
  onSel,
  children,
  className = "",
  sub,
}: {
  id: Id;
  sel: Id;
  onSel: (id: Id) => void;
  children: ReactNode;
  className?: string;
  sub?: ReactNode;
}) {
  const on = sel === id;
  const a = AREAS[id];
  return (
    <button
      onClick={() => onSel(id)}
      onMouseEnter={() => onSel(id)}
      onFocus={() => onSel(id)}
      aria-pressed={on}
      className={`flex min-w-0 flex-col justify-between rounded-xs px-2.5 py-2 text-left transition-[box-shadow,background-color] duration-150 ease-jle ${className}`}
      style={{
        boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
        background: on ? "color-mix(in srgb, var(--hot) 8%, transparent)" : "var(--well)",
      }}
    >
      <span className="truncate text-12" style={{ color: on ? "var(--hot)" : a.meta ? "var(--meta)" : "var(--hi)" }}>
        {children}
      </span>
      {sub && <span className="mt-1 truncate text-11 text-faint">{sub}</span>}
    </button>
  );
}

function Group({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-11">
        <span className="text-faint">{label}</span>
        {note && <span className="text-faint">{note}</span>}
      </div>
      {children}
    </div>
  );
}

const THREADS = [
  { name: "main", frames: ["main()", "compile()", "parse()"], pc: 41 },
  { name: "C2 compiler", frames: ["run()", "compile_method()"], pc: null },
  { name: "G1 worker", frames: ["run()", "evacuate()"], pc: null },
];

export function JvmMemoryMap() {
  const [sel, setSel] = useState<Id>("heap");
  const a = AREAS[sel];
  const cell = { sel, onSel: setSel };

  return (
    <div className="@container">
      <div className="grid gap-5 @[720px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4 rounded-md bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex items-baseline justify-between text-11 text-faint">
            <span>one JVM process</span>
            <span>java -Xmx512m …</span>
          </div>

          <Group label="per thread" note="× 14 threads in this run">
            <div className="grid grid-cols-3 gap-1.5">
              {THREADS.map((t) => (
                <div key={t.name} className="min-w-0 rounded-md p-1.5 shadow-[inset_0_0_0_1px_var(--line)]">
                  <div className="mb-1 truncate px-1 text-11 text-mute">{t.name}</div>
                  <div className="grid gap-1">
                    <Cell id="pc" {...cell} className="!py-1">
                      pc = {t.pc ?? "·"}
                    </Cell>
                    <Cell
                      id="stack"
                      {...cell}
                      sub={
                        <span className="flex flex-col-reverse">
                          {t.frames.map((f) => (
                            <span key={f} className="truncate">
                              {f}
                            </span>
                          ))}
                        </span>
                      }
                    >
                      stack
                    </Cell>
                  </div>
                </div>
              ))}
            </div>
          </Group>

          <Group label="shared by every thread" note="capped by -Xmx">
            <div className="grid gap-1.5 rounded-md p-1.5 shadow-[inset_0_0_0_1px_var(--line)]">
              <Cell id="heap" {...cell} className="!py-1.5">
                java heap
              </Cell>
              <div className="grid grid-cols-[1.1fr_0.8fr_1.7fr] gap-1.5">
                <Cell id="eden" {...cell} sub="new">
                  eden
                </Cell>
                <Cell id="survivor" {...cell} sub="aging">
                  surv
                </Cell>
                <Cell id="old" {...cell} sub="long-lived">
                  old
                </Cell>
              </div>
            </div>
          </Group>

          <Group label="native memory the JVM manages" note="not counted by -Xmx">
            <div className="grid grid-cols-2 gap-1.5 @[420px]:grid-cols-3">
              <Cell id="meta" {...cell} sub="class metadata">
                metaspace
              </Cell>
              <Cell id="klass" {...cell} sub="Klass structures">
                class space
              </Cell>
              <Cell id="code" {...cell} sub="JIT'd machine code">
                code cache
              </Cell>
              <Cell id="gc" {...cell} sub="bitmaps, card tables">
                GC structures
              </Cell>
              <Cell id="direct" {...cell} sub="allocateDirect">
                direct buffers
              </Cell>
              <Cell id="cds" {...cell} sub="JDK classes, mapped">
                CDS archive
              </Cell>
            </div>
            <div className="mt-1.5 grid">
              <Cell id="rest" {...cell} className="!py-1.5">
                symbols, compiler arenas, the rest
              </Cell>
            </div>
          </Group>
        </div>

        <div className="min-w-0" aria-live="polite">
          <div className="text-15 text-hi">{a.name}</div>
          <dl className="mt-3 grid gap-3 text-13 leading-[1.6]">
            {(
              [
                ["what lives here", a.what],
                ["sized by", a.sized],
                ["when it runs out", a.out],
                ["this run", a.real],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="border-t border-line pt-2.5">
                <dt className="text-11 text-faint">{k}</dt>
                <dd className="mt-0.5 font-serif text-[16px] leading-[1.55] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
