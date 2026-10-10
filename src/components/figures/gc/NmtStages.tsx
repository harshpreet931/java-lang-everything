"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Readout, Stat } from "./kit";

// one JVM, grown one native category at a time. every number is real: NativeLab.java on
// jdk 25.0.4 (macOS aarch64, G1, -Xms256m -Xmx256m, -XX:NativeMemoryTracking=summary). the
// program ran jcmd VM.native_memory summary scale=MB and ps -o rss on itself after each
// step; the same run three times gave the same NMT numbers and RSS within 7 MB.
// "classes" = Class + Metaspace + Shared class space. "the rest" = Internal, Symbol, Arena
// Chunk, Synchronization, Native Memory Tracking, Compiler.

const CATS = ["heap", "classes", "threads", "code", "GC", "direct", "rest"] as const;
type Cat = (typeof CATS)[number];
const LABEL: Record<Cat, string> = {
  heap: "java heap",
  classes: "classes + metaspace",
  threads: "thread stacks",
  code: "code cache",
  GC: "GC structures",
  direct: "direct buffers (Other)",
  rest: "everything else",
};

type Stage = { name: string; mb: Record<Cat, number>; total: number; rss: number; changed: Cat | "rss" | null; note: string };

const STAGES: Stage[] = [
  {
    name: "start",
    mb: { heap: 256, classes: 15, threads: 1, code: 8, GC: 60, direct: 0, rest: 3 },
    total: 342,
    rss: 51,
    changed: null,
    note: "a fresh JVM. NMT says 342 MB committed, but only 51 MB is actually in RAM: the 256 MB heap is committed and almost untouched, and the OS only hands over a page the first time something writes to it.",
  },
  {
    name: "+500 threads",
    mb: { heap: 256, classes: 15, threads: 41, code: 8, GC: 60, direct: 0, rest: 4 },
    total: 384,
    rss: 103,
    changed: "threads",
    note: "500 platform threads, all parked. each one reserves a 2 MB stack (1 GB of address space in total), but only the pages it touches become real: about 100 KB per idle thread. a thread that recurses deep touches more.",
  },
  {
    name: "+128 MB direct",
    mb: { heap: 256, classes: 15, threads: 41, code: 8, GC: 60, direct: 128, rest: 5 },
    total: 512,
    rss: 234,
    changed: "direct",
    note: "128 direct ByteBuffers of 1 MB each. NMT files them under Other: exactly 128 MB, malloc'd outside the heap. -Xmx has no say in this. the limit is -XX:MaxDirectMemorySize, which defaults to the max heap size.",
  },
  {
    name: "+20,000 classes",
    mb: { heap: 256, classes: 68, threads: 42, code: 8, GC: 60, direct: 128, rest: 21 },
    total: 583,
    rss: 335,
    changed: "classes",
    note: "20,000 tiny classes, kept alive. class space and metaspace go from 15 to 68 MB, and the symbol table, arenas and NMT's own bookkeeping grow with them. none of this is heap either.",
  },
  {
    name: "+150 MB of objects",
    mb: { heap: 256, classes: 68, threads: 42, code: 8, GC: 60, direct: 128, rest: 21 },
    total: 583,
    rss: 486,
    changed: "rss",
    note: "150 MB of plain arrays in the heap. NMT doesn't move at all, since the heap was committed from the start. RSS jumps 151 MB: those pages were finally touched. -Xmx256m, and the process is using 486 MB of RAM.",
  },
];

const MAX = 600;

export function NmtStages() {
  const s = useStepper(STAGES.length, { interval: 2600 });
  const st = STAGES[s.i];
  const prev = s.i > 0 ? STAGES[s.i - 1] : null;
  const total = st.total; // NMT's own total (the categories are rounded to MB, so they can sum 1 MB off)
  const pct = (mb: number) => `${(mb / MAX) * 100}%`;
  const grew = (c: Cat) => !!prev && st.mb[c] > prev.mb[c];

  const bar = (label: string, children: React.ReactNode, value: string) => (
    <div className="grid grid-cols-[8.5ch_minmax(0,1fr)_7ch] items-center gap-2">
      <span className="text-11 text-faint">{label}</span>
      <div className="relative h-7 rounded-[3px] bg-bg shadow-[inset_0_0_0_1px_var(--line)]">{children}</div>
      <span className="text-right text-12 text-hi tabular">{value}</span>
    </div>
  );

  let x = 0;
  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="native memory, one step at a time">
      <div className="flex flex-wrap gap-1" role="group" aria-label="stage">
        {STAGES.map((g, i) => (
          <button key={g.name} className="word" aria-pressed={s.i === i} onClick={() => s.go(i)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="relative grid gap-2">
        {bar(
          "committed",
          CATS.map((c) => {
            const left = x;
            x += st.mb[c];
            if (!st.mb[c]) return null;
            const hot = c === st.changed || grew(c);
            return (
              <span
                key={c}
                title={`${LABEL[c]}: ${st.mb[c]} MB`}
                className="absolute inset-y-[3px] rounded-[2px] transition-[left,width,background] duration-300 ease-jle"
                style={{
                  left: pct(left),
                  width: `calc(${pct(st.mb[c])} - 1px)`,
                  background: hot ? "var(--hot)" : c === "heap" ? "color-mix(in srgb, var(--ink) 55%, transparent)" : "color-mix(in srgb, var(--ink) 28%, transparent)",
                }}
              />
            );
          }),
          `${total} MB`,
        )}
        {bar(
          "in RAM",
          <>
            {prev && st.rss > prev.rss && (
              <span className="absolute inset-y-[3px] rounded-[2px] bg-hot transition-[left,width] duration-300 ease-jle" style={{ left: pct(prev.rss), width: pct(st.rss - prev.rss) }} />
            )}
            <span
              className="absolute inset-y-[3px] left-0 rounded-[2px] transition-[width] duration-300 ease-jle"
              style={{ width: pct(prev && st.rss > prev.rss ? prev.rss : st.rss), background: "color-mix(in srgb, var(--ink) 55%, transparent)" }}
            />
          </>,
          `${st.rss} MB`,
        )}
        {/* the -Xmx line across both bars */}
        <div className="pointer-events-none absolute inset-y-0 grid grid-cols-[8.5ch_minmax(0,1fr)_7ch] gap-2" style={{ left: 0, right: 0 }}>
          <span />
          <div className="relative">
            <span className="absolute inset-y-[-6px] border-l border-dashed border-dead" style={{ left: pct(256) }} />
          </div>
          <span />
        </div>
      </div>
      <div className="grid grid-cols-[8.5ch_minmax(0,1fr)_7ch] gap-2 text-[10px] text-faint">
        <span />
        <div className="relative h-3">
          <span className="absolute -translate-x-1/2 text-dead" style={{ left: pct(256) }}>
            -Xmx256m
          </span>
        </div>
        <span />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-12 sm:grid-cols-4">
        {CATS.map((c) => (
          <div key={c} className="flex justify-between gap-2 border-b border-line py-0.5">
            <span className={c === st.changed || grew(c) ? "text-hot" : "text-mute"}>{LABEL[c]}</span>
            <span className="text-hi tabular">{st.mb[c]}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-b border-line py-0.5">
          <span className={st.changed === "rss" ? "text-hot" : "text-mute"}>RSS</span>
          <span className="text-hi tabular">{st.rss}</span>
        </div>
      </div>
      <Readout minLines={3}>{st.note}</Readout>
      <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
        <Stat k="-Xmx" v="256 MB" />
        <Stat k="NMT committed" v={`${total} MB`} />
        <Stat k="RSS" v={`${st.rss} MB`} tone={st.rss > 256 ? "dead" : undefined} />
      </div>
      <StepControls s={s} />
    </div>
  );
}
