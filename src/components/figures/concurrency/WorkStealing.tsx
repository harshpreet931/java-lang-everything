"use client";

import { useRef, useState } from "react";
import { Narrate, Row, Words, rng, useTicker } from "./ui";

// a ForkJoinPool with 4 workers, one tick at a time. every worker owns a deque:
//   the owner pushes and pops at the TOP (LIFO: newest, smallest work, still hot in cache)
//   thieves take from the BASE (FIFO: oldest, biggest chunks, so one steal = lots of work)
// a task bigger than the threshold forks its left half (push) and keeps the right half.
// a leaf takes 2 ticks. joins aren't drawn: this is about who does the work.

type Task = { lo: number; hi: number };
type Wk = { cur: Task | null; left: number; deque: Task[]; leaves: number; steals: number; flash: "" | "steal" | "pop" | "fork" };
type St = { w: Wk[]; tick: number; done: number; steals: number; note: string };

const N = 64;
const W = 4;
const LEAF_TICKS = 2;

const fresh = (): St => ({
  w: Array.from({ length: W }, (_, i) => ({ cur: i === 0 ? { lo: 0, hi: N } : null, left: 0, deque: [], leaves: 0, steals: 0, flash: "" })),
  tick: 0,
  done: 0,
  steals: 0,
  note: "one task, the whole range 0..64, handed to worker 0. the other three have nothing yet.",
});

const label = (t: Task) => `${t.lo}..${t.hi}`;

function tick(s: St, th: number, rand: () => number): St {
  const w = s.w.map((x) => ({ ...x, deque: [...x.deque], flash: "" as Wk["flash"] }));
  let done = s.done;
  let steals = s.steals;
  const notes: string[] = [];
  // order workers randomly each tick so no one is always first to steal
  const order = Array.from({ length: W }, (_, i) => i).sort(() => rand() - 0.5);
  for (const i of order) {
    const me = w[i];
    if (me.cur) {
      const size = me.cur.hi - me.cur.lo;
      if (size > th) {
        const mid = (me.cur.lo + me.cur.hi) >> 1;
        const left = { lo: me.cur.lo, hi: mid };
        me.deque.push(left); // fork: push onto the top
        me.cur = { lo: mid, hi: me.cur.hi };
        me.flash = "fork";
        if (notes.length < 1) notes.push(`worker ${i} forks ${label(left)} onto the top of its deque and keeps ${label(me.cur)} for itself.`);
      } else {
        me.left = me.left ? me.left - 1 : LEAF_TICKS - 1;
        if (me.left === 0) {
          me.cur = null;
          me.leaves += 1;
          done += 1;
        }
      }
      continue;
    }
    if (me.deque.length) {
      me.cur = me.deque.pop()!; // owner pops the top: newest first
      me.left = 0;
      me.flash = "pop";
      continue;
    }
    // steal from the base of a random non-empty deque
    const victims = w.map((x, j) => (j !== i && x.deque.length ? j : -1)).filter((j) => j >= 0);
    if (victims.length) {
      const v = victims[Math.floor(rand() * victims.length)];
      const t = w[v].deque.shift()!; // thieves take the base: oldest, biggest
      me.cur = t;
      me.left = 0;
      me.steals += 1;
      me.flash = "steal";
      steals += 1;
      notes.unshift(`worker ${i} is idle, so it steals ${label(t)} from the base of worker ${v}'s deque. the oldest task there, so the biggest one.`);
    }
  }
  const total = N / Math.min(th, N);
  const finished = done >= total;
  return {
    w,
    tick: s.tick + 1,
    done,
    steals,
    note: finished
      ? `all ${total} leaves done in ${s.tick + 1} ticks, with only ${steals} steals. thieves took big chunks, so they rarely needed to come back.`
      : (notes[0] ?? s.note),
  };
}

export function WorkStealing() {
  const [th, setTh] = useState(4);
  const [s, setS] = useState<St>(fresh);
  const [running, setRunning] = useState(false);
  const rand = useRef(rng(5));
  const total = N / th;
  const finished = s.done >= total;

  const ref = useTicker(running && !finished, 650, () => setS((cur) => tick(cur, th, rand.current)));
  const reset = (t = th) => {
    setRunning(false);
    rand.current = rng(5);
    setS(fresh());
    setTh(t);
  };

  return (
    <div ref={ref}>
      <div className="mb-4 text-13">
        <Row k="threshold =" w="12ch">
          <Words options={[2, 4, 8, 16]} value={th} onChange={(v) => reset(v)} label="threshold" />
          <span className="basis-full text-11 text-faint sm:ml-2 sm:basis-auto">range size that's summed directly</span>
        </Row>
      </div>

      <div className="grid gap-2">
        {s.w.map((wk, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-md bg-well px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--line)] sm:grid-cols-[9ch_12ch_minmax(0,1fr)]">
            <div className="text-12 text-hi">
              worker {i}
              <div className="text-[10px] text-faint tabular">
                {wk.leaves} leaves · {wk.steals} stolen
              </div>
            </div>
            <div>
              <span
                key={wk.cur ? label(wk.cur) + wk.flash : "idle"}
                className={`inline-flex h-7 min-w-[9ch] items-center justify-center rounded-xs px-1.5 text-12 tabular ${wk.flash === "steal" ? "flash" : ""}`}
                style={{
                  color: wk.cur ? (wk.flash === "steal" ? "var(--hot)" : "var(--live)") : "var(--faint)",
                  boxShadow: `inset 0 0 0 1px ${wk.cur ? (wk.flash === "steal" ? "var(--hot)" : "var(--live)") : "var(--line-2)"}`,
                }}
              >
                {wk.cur ? label(wk.cur) : wk.deque.length ? "pops next" : "idle"}
              </span>
            </div>
            <div className="col-span-2 flex min-w-0 items-center gap-1 sm:col-span-1">
              <span className="text-[10px] text-faint">base</span>
              <div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-xs px-1 py-0.5" style={{ border: "1px dashed var(--line-2)" }}>
                {wk.deque.map((t, j) => (
                  <span
                    key={label(t)}
                    className={`obj-in rounded-xs px-1.5 text-11 text-ink tabular shadow-[inset_0_0_0_1px_var(--line-2)] ${j === wk.deque.length - 1 && wk.flash === "fork" ? "flash" : ""}`}
                  >
                    {label(t)}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-faint">top</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-x-6 text-12">
        <Stat k="tick" v={String(s.tick)} />
        <Stat k="leaves" v={`${s.done}/${total}`} tone={finished ? "live" : undefined} />
        <Stat k="steals" v={String(s.steals)} tone={s.steals ? "hot" : undefined} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="act solid" onClick={() => setRunning((r) => !r)} disabled={finished}>
          {running ? "pause" : "run"}
        </button>
        <button className="act" onClick={() => setS((cur) => tick(cur, th, rand.current))} disabled={running || finished}>
          one tick
        </button>
        <button className="act" onClick={() => reset()}>
          reset
        </button>
      </div>
      <Narrate min="5.1em">{s.note}</Narrate>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "live" | "hot" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
}
