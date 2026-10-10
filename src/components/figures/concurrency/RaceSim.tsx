"use client";

import { useEffect, useRef, useState } from "react";
import { LaneTable, type LaneRow } from "./Lanes";
import { Narrate, Row, Words, rng, useReducedMotion, useTicker } from "./ui";

// two threads, one shared int, count++ split into its three real steps.
// you pick which thread runs next. lost updates are detected the moment they happen:
// a write is "stale" if count changed between this thread's read and its write.

type Th = { pc: 0 | 1 | 2; reg: number | null; read: number | null; done: number };
type Mode = "plain" | "synchronized";
type St = { count: number; th: [Th, Th]; lock: -1 | 0 | 1; lost: number; rows: LaneRow[]; note: string };

const LINES = ["int r = count;", "r = r + 1;", "count = r;"];
const NAMES = ["T1", "T2"] as const;

const fresh = (): St => ({
  count: 0,
  th: [
    { pc: 0, reg: null, read: null, done: 0 },
    { pc: 0, reg: null, read: null, done: 0 },
  ],
  lock: -1,
  lost: 0,
  rows: [{ mem: { count: 0 }, note: "" }],
  note: "two threads, both about to run count++. pick who goes first.",
});

function canStep(s: St, i: 0 | 1, iters: number, mode: Mode) {
  const t = s.th[i];
  if (t.done >= iters) return false;
  if (mode === "synchronized" && s.lock !== -1 && s.lock !== i) return false;
  return true;
}

function step(s: St, i: 0 | 1, mode: Mode): St {
  const me = s.th[i];
  const other = s.th[i === 0 ? 1 : 0];
  const name = NAMES[i];
  const oname = NAMES[i === 0 ? 1 : 0];
  const th: [Th, Th] = [{ ...s.th[0] }, { ...s.th[1] }];
  const t = th[i];
  const ops: LaneRow["ops"] = [null, null];
  let { count, lock, lost } = s;
  let note = "";
  let k: "dead" | undefined;

  if (me.pc === 0) {
    const locking = mode === "synchronized";
    if (locking) lock = i;
    t.reg = count;
    t.read = count;
    t.pc = 1;
    ops[i] = locking ? { t: `lock · read → ${count}`, k: "meta" } : `read count → ${count}`;
    note =
      other.pc !== 0 && !locking
        ? `${name} reads ${count}, but ${oname} is still holding its own copy (${other.reg}). two threads, working off the same old value. trouble.`
        : locking
          ? `${name} takes the lock, then copies count (${count}) into its register. ${oname} can't even start until it's released.`
          : `${name} copies count (${count}) into its own register r. memory doesn't know about r.`;
  } else if (me.pc === 1) {
    t.reg = (t.reg ?? 0) + 1;
    t.pc = 2;
    ops[i] = `add → r = ${t.reg}`;
    note = `${name} adds 1, in its register. count in memory is still ${count}: nobody else can see this yet.`;
  } else {
    const stale = count !== me.read;
    const before = count;
    count = t.reg ?? 0;
    t.pc = 0;
    t.done += 1;
    t.reg = null;
    t.read = null;
    if (stale) {
      lost += 1;
      k = "dead";
      ops[i] = { t: `write ${count} (stale!)`, k: "dead" };
      note = `${name} writes ${count} over the ${before} that ${oname} wrote. ${oname}'s increment is gone. that's a lost update.`;
    } else {
      ops[i] = mode === "synchronized" ? { t: `write ${count} · unlock`, k: "meta" } : `write count = ${count}`;
      note = `${name} writes ${count} back to memory.${mode === "synchronized" ? " then releases the lock." : ""}`;
    }
    if (mode === "synchronized") lock = -1;
  }

  return {
    count,
    th,
    lock,
    lost,
    rows: [...s.rows, { ops, mem: { count: k ? { v: count, k } : count } }],
    note,
  };
}

export function RaceSim() {
  const [iters, setIters] = useState(1);
  const [mode, setMode] = useState<Mode>("plain");
  const [s, setS] = useState<St>(fresh);
  const [auto, setAuto] = useState(false);
  const seed = useRef(7);
  const rand = useRef(rng(seed.current));
  const reduce = useReducedMotion();

  const total = 2 * iters;
  const finished = s.th[0].done >= iters && s.th[1].done >= iters;

  const reset = (m = mode, it = iters) => {
    setAuto(false);
    setS(fresh());
    if (m !== mode) setMode(m);
    if (it !== iters) setIters(it);
  };

  const go = (i: 0 | 1) => setS((cur) => (canStep(cur, i, iters, mode) ? step(cur, i, mode) : cur));

  const shuffleOne = (cur: St): St => {
    const can = ([0, 1] as const).filter((i) => canStep(cur, i, iters, mode));
    if (!can.length) return cur;
    const pick = can.length === 1 ? can[0] : rand.current() < 0.5 ? can[0] : can[1];
    return step(cur, pick, mode);
  };

  const ref = useTicker(auto, 260, () => {
    setS((cur) => {
      const n = shuffleOne(cur);
      if (n === cur) setAuto(false);
      return n;
    });
  });

  useEffect(() => {
    if (finished) setAuto(false);
  }, [finished]);

  const shuffle = () => {
    seed.current += 1;
    rand.current = rng(seed.current * 2654435761);
    const start = finished ? fresh() : s;
    if (reduce) {
      let cur = start;
      for (let k = 0; k < 40; k++) cur = shuffleOne(cur);
      setS(cur);
    } else {
      setS(start);
      setAuto(true);
    }
  };


  const verdict = finished
    ? s.count === total
      ? { k: "live", text: `count = ${s.count}. expected ${total}. correct, this time.` }
      : { k: "dead", text: `count = ${s.count}. expected ${total}. ${s.lost} update${s.lost > 1 ? "s" : ""} lost.` }
    : null;

  return (
    <div ref={ref}>
      <div className="mb-5 text-13">
        <Row k="count++ each =" w="15ch">
          <Words options={[1, 2, 3]} value={iters} onChange={(v) => reset(mode, v)} label="increments per thread" />
        </Row>
        <Row k="guarded by =" w="15ch">
          <Words
            options={[
              { v: "plain", label: "nothing" },
              { v: "synchronized", label: "synchronized" },
            ]}
            value={mode}
            onChange={(v) => reset(v as Mode, iters)}
            label="guard"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5">
        <ThreadPanel i={0} s={s} iters={iters} mode={mode} onStep={() => go(0)} className="order-2 sm:order-1" />
        <div className="order-1 col-span-2 flex flex-col items-center justify-center sm:order-2 sm:col-span-1">
          <div className="text-11 text-faint">shared · heap</div>
          <div
            className="mt-1.5 flex min-w-[96px] flex-col items-center rounded-md bg-well px-5 py-3"
            style={{
              boxShadow: `inset 0 0 0 1px ${verdict?.k === "dead" || s.lost ? "var(--dead)" : verdict ? "var(--live)" : "var(--line-2)"}`,
            }}
          >
            <span className="text-12 text-mute">count</span>
            <span
              key={s.count + ":" + s.lost}
              className="flash mt-0.5 text-28 leading-none font-light text-hi tabular"
              style={{ color: s.lost ? "var(--dead)" : undefined }}
            >
              {s.count}
            </span>
          </div>
          {mode === "synchronized" && (
            <div className="mt-2 text-11" style={{ color: s.lock === -1 ? "var(--faint)" : "var(--meta)" }}>
              lock: {s.lock === -1 ? "free" : `held by ${NAMES[s.lock]}`}
            </div>
          )}
        </div>
        <ThreadPanel i={1} s={s} iters={iters} mode={mode} onStep={() => go(1)} className="order-3" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className="act" onClick={shuffle} disabled={auto}>
          {finished ? "shuffle again" : "shuffle to the end"}
        </button>
        <button className="act" onClick={() => reset()} disabled={s.rows.length === 1}>
          reset
        </button>
        {verdict && (
          <span className="ml-1 text-13" style={{ color: `var(--${verdict.k})` }}>
            {verdict.text}
          </span>
        )}
      </div>

      <Narrate>{s.note}</Narrate>

      <div className="mt-3">
        <LaneTable threads={["T1", "T2"]} cells={["count"]} rows={s.rows} cur={s.rows.length - 1} dense maxHeight={320} />
      </div>
    </div>
  );
}

function ThreadPanel({
  i,
  s,
  iters,
  mode,
  onStep,
  className = "",
}: {
  i: 0 | 1;
  s: St;
  iters: number;
  mode: Mode;
  onStep: () => void;
  className?: string;
}) {
  const t = s.th[i];
  const done = t.done >= iters;
  const blocked = !done && mode === "synchronized" && s.lock !== -1 && s.lock !== i;
  return (
    <div className={`min-w-0 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-12">
        <span className="text-hi">{NAMES[i]}</span>
        <span className="text-11 text-faint tabular">
          {done ? "done" : `count++ ${t.done + 1}/${iters}`}
        </span>
      </div>
      <ol className="text-12 leading-[1.75]">
        {LINES.map((l, j) => {
          const cur = !done && t.pc === j;
          return (
            <li
              key={j}
              className="truncate border-l-2 pl-2"
              style={{
                borderColor: cur ? (blocked ? "var(--meta)" : "var(--hot)") : "transparent",
                color: cur ? "var(--hi)" : "var(--mute)",
                background: cur ? "color-mix(in srgb, var(--hot) 8%, transparent)" : undefined,
              }}
            >
              {l}
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-1.5 text-12">
        <span className="text-faint">r =</span>
        <span className="text-hi tabular">{t.reg ?? "·"}</span>
      </div>
      <button className={`act mt-2.5 w-full ${done || blocked ? "" : "solid"}`} onClick={onStep} disabled={done || blocked} aria-label={`step ${NAMES[i]}`}>
        {done ? "done" : blocked ? "blocked" : `step ${NAMES[i]}`}
      </button>
    </div>
  );
}
