"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narrate, ring, tint } from "./kit";

// a parallel stream over 16 elements, split by its spliterator and run on a
// fork/join pool. SIMPLIFIED on purpose: 3 threads and chunks of 4, so it fits.
// what's real: the caller (main) does work too, a split keeps one half and forks
// the other onto the splitting thread's own deque, idle threads steal from the
// other end of someone else's deque, and results are combined back up the tree.

type St = "idle" | "run" | "queued" | "split" | "done";
type Node = { id: string; lo: number; hi: number; level: number };
const NODES: Node[] = [
  { id: "r", lo: 0, hi: 16, level: 0 },
  { id: "a", lo: 0, hi: 8, level: 1 },
  { id: "b", lo: 8, hi: 16, level: 1 },
  { id: "a1", lo: 0, hi: 4, level: 2 },
  { id: "a2", lo: 4, hi: 8, level: 2 },
  { id: "b1", lo: 8, hi: 12, level: 2 },
  { id: "b2", lo: 12, hi: 16, level: 2 },
];
const WORKERS = ["main", "w1", "w2"] as const;
type W = (typeof WORKERS)[number];

type Frame = {
  nodes: Record<string, { st: St; who?: W }>;
  running: Partial<Record<W, string>>;
  deque: Partial<Record<W, string[]>>;
  hot?: string;
  note: string;
};

const rng = (id: string) => {
  const n = NODES.find((x) => x.id === id)!;
  return `[${n.lo}, ${n.hi})`;
};

const F: Frame[] = [
  {
    nodes: { r: { st: "run", who: "main" } },
    running: { main: "r" },
    deque: {},
    hot: "r",
    note: "the terminal operation starts on the calling thread, main, with the whole range as one task. the pool's workers are idle.",
  },
  {
    nodes: { r: { st: "split", who: "main" }, a: { st: "run", who: "main" }, b: { st: "queued", who: "main" } },
    running: { main: "a" },
    deque: { main: ["b"] },
    hot: "b",
    note: "trySplit(): main keeps the left half and forks the right half, which just means pushing it onto main's own deque.",
  },
  {
    nodes: { r: { st: "split", who: "main" }, a: { st: "run", who: "main" }, b: { st: "run", who: "w1" } },
    running: { main: "a", w1: "b" },
    deque: {},
    hot: "b",
    note: "w1 has nothing to do, so it steals: it takes a task from the other end of main's deque. nobody assigned it, it just took it.",
  },
  {
    nodes: {
      r: { st: "split", who: "main" },
      a: { st: "split", who: "main" },
      b: { st: "split", who: "w1" },
      a1: { st: "run", who: "main" },
      a2: { st: "queued", who: "main" },
      b1: { st: "run", who: "w1" },
      b2: { st: "queued", who: "w1" },
    },
    running: { main: "a1", w1: "b1" },
    deque: { main: ["a2"], w1: ["b2"] },
    note: "both split again. each keeps one half and pushes the other onto its own deque.",
  },
  {
    nodes: {
      r: { st: "split", who: "main" },
      a: { st: "split", who: "main" },
      b: { st: "split", who: "w1" },
      a1: { st: "run", who: "main" },
      a2: { st: "run", who: "w2" },
      b1: { st: "run", who: "w1" },
      b2: { st: "queued", who: "w1" },
    },
    running: { main: "a1", w1: "b1", w2: "a2" },
    deque: { w1: ["b2"] },
    hot: "a2",
    note: "w2 wakes up and steals [4, 8) from main. chunks of 4 are small enough now, so nobody splits further: each thread runs its chunk as a plain sequential loop.",
  },
  {
    nodes: {
      r: { st: "split", who: "main" },
      a: { st: "split", who: "main" },
      b: { st: "split", who: "w1" },
      a1: { st: "done", who: "main" },
      a2: { st: "done", who: "w2" },
      b1: { st: "run", who: "w1" },
      b2: { st: "run", who: "main" },
    },
    running: { w1: "b1", main: "b2" },
    deque: {},
    hot: "b2",
    note: "main finished first and its own deque is empty, so it steals [12, 16) from w1. that's work stealing: the fast threads end up doing more.",
  },
  {
    nodes: {
      r: { st: "split", who: "main" },
      a: { st: "done", who: "main" },
      b: { st: "done", who: "w1" },
      a1: { st: "done", who: "main" },
      a2: { st: "done", who: "w2" },
      b1: { st: "done", who: "w1" },
      b2: { st: "done", who: "main" },
    },
    running: {},
    deque: {},
    hot: "a",
    note: "leaves done. results are combined back up the tree: for sum() that's adding, for toList() it's concatenating left then right, which is how order survives.",
  },
  {
    nodes: {
      r: { st: "done", who: "main" },
      a: { st: "done", who: "main" },
      b: { st: "done", who: "w1" },
      a1: { st: "done", who: "main" },
      a2: { st: "done", who: "w2" },
      b1: { st: "done", who: "w1" },
      b2: { st: "done", who: "main" },
    },
    running: {},
    deque: {},
    hot: "r",
    note: "the root has its answer, and main returns it. three threads, seven tasks, two steals, and the caller never sat idle.",
  },
];

const tone = (st: St, hot: boolean) => (hot ? "hot" : st === "run" ? "hot" : st === "done" ? "live" : null);

export function WorkStealing() {
  const s = useStepper(F.length, { interval: 1700 });
  const f = F[s.i];

  return (
    <div {...s.keys} className="grid gap-5 outline-none">
      {/* the split tree, as an icicle: each row is a level, each cell a task */}
      <div className="grid gap-1" role="img" aria-label="split tree of the range 0 to 16">
        {[0, 1, 2].map((lvl) => (
          <div key={lvl} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${2 ** lvl}, minmax(0, 1fr))` }}>
            {NODES.filter((n) => n.level === lvl).map((n) => {
              const st = f.nodes[n.id];
              const t = st ? tone(st.st, f.hot === n.id && st.st !== "split") : null;
              return (
                <div
                  key={n.id}
                  className="flex min-h-[44px] flex-col items-center justify-center rounded-md px-1 text-center transition-[box-shadow,background-color,opacity] duration-200 ease-jle"
                  style={{
                    boxShadow: st ? (st.st === "queued" ? `inset 0 0 0 1px var(--line-2)` : ring(t ?? null, t ? 70 : 100)) : ring(null, 100),
                    background: t ? tint(t, 10) : st?.st === "split" ? "transparent" : undefined,
                    opacity: st ? (st.st === "split" ? 0.55 : 1) : 0.25,
                    outline: st?.st === "queued" ? "1px dashed var(--mute)" : undefined,
                    outlineOffset: -1,
                  }}
                >
                  <span className="text-12 tabular" style={{ color: t ? `var(--${t})` : "var(--hi)" }}>
                    {rng(n.id)}
                  </span>
                  <span className="text-11 text-faint">
                    {st ? (st.st === "split" ? "split" : st.st === "queued" ? `in ${st.who}'s deque` : `${st.who}${st.st === "done" ? " ✓" : ""}`) : "·"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* the threads */}
      <div className="grid gap-1.5 text-12">
        <div className="grid grid-cols-[6ch_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-11 text-faint">
          <span>thread</span>
          <span>running</span>
          <span>its deque</span>
        </div>
        {WORKERS.map((w) => (
          <div key={w} className="grid grid-cols-[6ch_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-t border-line pt-1.5">
            <span className="text-hi">{w}</span>
            <span className="tabular" style={{ color: f.running[w] ? "var(--hot)" : "var(--faint)" }}>
              {f.running[w] ? rng(f.running[w]!) : "idle"}
            </span>
            <span className="flex flex-wrap gap-1 tabular">
              {(f.deque[w] ?? []).length === 0 ? (
                <span className="text-faint">empty</span>
              ) : (
                f.deque[w]!.map((id) => (
                  <span key={id} className="rounded-sm px-1.5 text-ink" style={{ outline: "1px dashed var(--mute)", outlineOffset: -1 }}>
                    {rng(id)}
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </div>

      <Narrate>{f.note}</Narrate>
      <StepControls s={s} />
    </div>
  );
}
