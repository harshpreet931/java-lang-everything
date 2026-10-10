"use client";

import { useEffect, useRef, useState } from "react";
import { LaneTable, type LaneRow } from "./Lanes";
import { Narrate, Row, Words, rng, useReducedMotion, useTicker } from "./ui";

// two threads incrementing an AtomicInteger with an explicit CAS loop.
// same three steps as the racy count++, except the write is compareAndSet:
// it only succeeds if the value is still what this thread read. otherwise: retry.

type Th = { pc: 0 | 1 | 2; seen: number | null; next: number | null; done: number; retries: number };
type St = { value: number; th: [Th, Th]; rows: LaneRow[]; note: string };

const LINES = ["int v = count.get();", "int next = v + 1;", "count.compareAndSet(v, next)"];
const N = ["T1", "T2"] as const;

const fresh = (): St => ({
  value: 0,
  th: [
    { pc: 0, seen: null, next: null, done: 0, retries: 0 },
    { pc: 0, seen: null, next: null, done: 0, retries: 0 },
  ],
  rows: [{ mem: { count: 0 } }],
  note: "same race as before: read, add, write. except the write is a compare-and-swap. try to lose an update.",
});

function step(s: St, i: 0 | 1): St {
  const th: [Th, Th] = [{ ...s.th[0] }, { ...s.th[1] }];
  const t = th[i];
  const o = N[i === 0 ? 1 : 0];
  const ops: LaneRow["ops"] = [null, null];
  let value = s.value;
  let note = "";
  let mem: LaneRow["mem"] = undefined;
  if (t.pc === 0) {
    t.seen = value;
    t.pc = 1;
    ops[i] = `get() → ${value}`;
    note = `${N[i]} reads ${value}. plain read, nothing special yet.`;
  } else if (t.pc === 1) {
    t.next = (t.seen ?? 0) + 1;
    t.pc = 2;
    ops[i] = `next = ${t.next}`;
    note = `${N[i]} computes ${t.next} in its register.`;
  } else {
    if (value === t.seen) {
      value = t.next ?? 0;
      t.done += 1;
      ops[i] = { t: `CAS ${t.seen} → ${t.next}: ok`, k: "live" };
      mem = { count: value };
      note = `${N[i]}: "if count is still ${t.seen}, make it ${t.next}". it is, so the swap happens, atomically, in one hardware instruction.`;
    } else {
      t.retries += 1;
      ops[i] = { t: `CAS ${t.seen} → ${t.next}: fails`, k: "hot" };
      note = `${N[i]}: "if count is still ${t.seen}, make it ${t.next}". it isn't (${o} changed it to ${value}), so nothing is written. instead of clobbering ${o}'s work, ${N[i]} loops and tries again.`;
    }
    t.pc = 0;
    t.seen = null;
    t.next = null;
  }
  return { value, th, rows: [...s.rows, { ops, mem }], note };
}

export function CasSim() {
  const [iters, setIters] = useState(1);
  const [s, setS] = useState<St>(fresh);
  const [auto, setAuto] = useState(false);
  const seed = useRef(11);
  const rand = useRef(rng(seed.current));
  const reduce = useReducedMotion();

  const finished = s.th.every((t) => t.done >= iters);
  const can = (cur: St, i: 0 | 1) => cur.th[i].done < iters;

  const one = (cur: St): St => {
    const ok = ([0, 1] as const).filter((i) => can(cur, i));
    if (!ok.length) return cur;
    return step(cur, ok.length === 1 ? ok[0] : rand.current() < 0.5 ? ok[0] : ok[1]);
  };

  const ref = useTicker(auto, 260, () =>
    setS((cur) => {
      const n = one(cur);
      if (n === cur) setAuto(false);
      return n;
    }),
  );

  useEffect(() => {
    if (finished) setAuto(false);
  }, [finished]);


  const shuffle = () => {
    seed.current += 1;
    rand.current = rng(seed.current * 2246822519);
    const start = finished ? fresh() : s;
    if (reduce) {
      let cur = start;
      for (let k = 0; k < 80; k++) cur = one(cur);
      setS(cur);
    } else {
      setS(start);
      setAuto(true);
    }
  };

  const retries = s.th[0].retries + s.th[1].retries;

  return (
    <div ref={ref}>
      <div className="mb-5 text-13">
        <Row k="increments each =" w="17ch">
          <Words options={[1, 2, 3]} value={iters} onChange={(v) => (setIters(v), setAuto(false), setS(fresh()))} label="increments per thread" />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5">
        {([0, 1] as const).map((i) => {
          const t = s.th[i];
          const done = t.done >= iters;
          return (
            <div
              key={i}
              className={`min-w-0 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)] ${i === 0 ? "order-2 sm:order-1" : "order-3"}`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-12">
                <span className="text-hi">{N[i]}</span>
                <span className="text-11 text-faint tabular">{done ? "done" : `${t.done}/${iters} · ${t.retries} retr${t.retries === 1 ? "y" : "ies"}`}</span>
              </div>
              <ol className="text-12 leading-[1.75]">
                {LINES.map((l, j) => (
                  <li
                    key={j}
                    className="truncate border-l-2 pl-2"
                    title={l}
                    style={{
                      borderColor: !done && t.pc === j ? "var(--hot)" : "transparent",
                      color: !done && t.pc === j ? "var(--hi)" : "var(--mute)",
                      background: !done && t.pc === j ? "color-mix(in srgb, var(--hot) 8%, transparent)" : undefined,
                    }}
                  >
                    {l}
                  </li>
                ))}
              </ol>
              <div className="mt-1.5 grid grid-cols-2 border-t border-line pt-1.5 text-12">
                <span className="text-faint">
                  v = <span className="text-hi tabular">{t.seen ?? "·"}</span>
                </span>
                <span className="text-right text-faint">
                  next = <span className="text-hi tabular">{t.next ?? "·"}</span>
                </span>
              </div>
              <button className={`act mt-2.5 w-full ${done ? "" : "solid"}`} onClick={() => setS((c) => (can(c, i) ? step(c, i) : c))} disabled={done || auto} aria-label={`step ${N[i]}`}>
                {done ? "done" : `step ${N[i]}`}
              </button>
            </div>
          );
        })}
        <div className="order-1 col-span-2 flex flex-col items-center justify-center sm:order-2 sm:col-span-1">
          <div className="text-11 text-faint">AtomicInteger</div>
          <div
            className="mt-1.5 flex min-w-[96px] flex-col items-center rounded-md bg-well px-5 py-3"
            style={{ boxShadow: `inset 0 0 0 1px ${finished ? "var(--live)" : "var(--line-2)"}` }}
          >
            <span className="text-12 text-mute">count</span>
            <span key={s.value} className="flash mt-0.5 text-28 leading-none font-light text-hi tabular">
              {s.value}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className="act" onClick={shuffle} disabled={auto}>
          {finished ? "shuffle again" : "shuffle to the end"}
        </button>
        <button className="act" onClick={() => (setAuto(false), setS(fresh()))} disabled={s.rows.length === 1}>
          reset
        </button>
        {finished && (
          <span className="ml-1 text-13 text-live">
            count = {s.value}, expected {2 * iters}. {retries} retr{retries === 1 ? "y" : "ies"}, nothing lost.
          </span>
        )}
      </div>

      <Narrate min="5.1em">{s.note}</Narrate>

      <div className="mt-3">
        <LaneTable threads={["T1", "T2"]} cells={["count"]} rows={s.rows} cur={s.rows.length - 1} dense maxHeight={320} />
      </div>
    </div>
  );
}
