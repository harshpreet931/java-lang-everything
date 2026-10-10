"use client";

import { useRef, useState } from "react";
import { Row, Slider, Words, rng, useTicker } from "./ui";

// a toy model of contention. every tick, every thread tries one CAS on its target cell.
// if several threads hit the same cell in the same tick, one wins and the rest fail
// and retry. AtomicLong: one cell, everybody fights over it. LongAdder: start on base,
// and once base is contended, spread threads over a cells array (rehash on collision,
// double the array while it's smaller than the core count, here capped at 8).
// it's a model of the idea, not a benchmark: real numbers are in the chapter.

type Mode = "AtomicLong" | "LongAdder";
type St = {
  base: number;
  cells: number[] | null;
  probe: number[];
  collide: boolean[];
  tick: number;
  ok: number;
  fail: number;
  lastHit: Record<string, number>;
  lastFail: Record<string, number>;
};

const MAXC = 8;
const fresh = (n: number, seed = 3): St => {
  const r = rng(seed);
  return {
    base: 0,
    cells: null,
    probe: Array.from({ length: 8 }, () => Math.floor(r() * 1_000_000)),
    collide: Array(8).fill(false),
    tick: 0,
    ok: 0,
    fail: 0,
    lastHit: {},
    lastFail: {},
  };
};

function tick(s: St, n: number, mode: Mode, rand: () => number): St {
  const out: St = {
    ...s,
    cells: s.cells ? [...s.cells] : null,
    probe: [...s.probe],
    collide: [...s.collide],
    tick: s.tick + 1,
    lastHit: {},
    lastFail: {},
  };
  // who targets what this tick
  const targets: Record<string, number[]> = {};
  for (let t = 0; t < n; t++) {
    const key = mode === "AtomicLong" || !out.cells ? "base" : String(out.probe[t] & (out.cells.length - 1));
    (targets[key] ??= []).push(t);
  }
  let grow = false;
  for (const [key, ts] of Object.entries(targets)) {
    const winner = ts[Math.floor(rand() * ts.length)];
    if (key === "base") out.base += 1;
    else out.cells![Number(key)] += 1;
    out.ok += 1;
    out.lastHit[key] = winner;
    if (ts.length > 1) {
      out.fail += ts.length - 1;
      out.lastFail[key] = ts.length - 1;
      if (mode === "LongAdder") {
        if (key === "base" && !out.cells) {
          out.cells = [0, 0]; // contention on base: create the striped cells
        } else if (key !== "base") {
          for (const t of ts) {
            if (t === winner) continue;
            if (out.collide[t] && out.cells!.length < Math.min(MAXC, n > 1 ? 1 << Math.ceil(Math.log2(n)) : 1)) grow = true;
            out.collide[t] = true;
            out.probe[t] = Math.floor(rand() * 1_000_000); // rehash and try another cell
          }
        }
      }
    } else if (key !== "base") {
      for (const t of ts) out.collide[t] = false;
    }
  }
  if (grow && out.cells) out.cells = [...out.cells, ...Array(out.cells.length).fill(0)];
  return out;
}

export function LongAdderCells() {
  const [n, setN] = useState(4);
  const [mode, setMode] = useState<Mode>("LongAdder");
  const [s, setS] = useState<St>(() => fresh(4));
  const [running, setRunning] = useState(false);
  const rand = useRef(rng(97));

  const reset = (nn = n, m = mode) => {
    setRunning(false);
    rand.current = rng(97);
    setS(fresh(nn));
    if (nn !== n) setN(nn);
    if (m !== mode) setMode(m);
  };

  const ref = useTicker(running, 220, () => setS((cur) => tick(cur, n, mode, rand.current)));

  const sum = s.base + (s.cells?.reduce((a, b) => a + b, 0) ?? 0);
  const attempts = s.ok + s.fail;
  const wasted = attempts ? Math.round((s.fail / attempts) * 100) : 0;
  const perTick = s.tick ? (s.ok / s.tick).toFixed(1) : "0";

  const owners = (key: string) =>
    Array.from({ length: n }, (_, t) => t).filter((t) =>
      mode === "AtomicLong" || !s.cells ? key === "base" : String(s.probe[t] & (s.cells.length - 1)) === key,
    );

  const Cell = ({ k, label, value }: { k: string; label: string; value: number }) => {
    const hit = s.lastHit[k] !== undefined;
    const lost = s.lastFail[k];
    return (
      <div className="flex min-w-[64px] flex-1 flex-col items-center gap-1">
        <span className="text-[10px] text-faint">{label}</span>
        <div
          className="flex w-full flex-col items-center rounded-md bg-well px-2 py-2"
          style={{ boxShadow: `inset 0 0 0 1px ${hit ? "var(--hot)" : "var(--line-2)"}` }}
        >
          <span className="text-15 text-hi tabular">{value}</span>
          <span className="h-3.5 text-[10px] leading-3.5 tabular" style={{ color: lost ? "var(--dead)" : "var(--faint)" }}>
            {lost ? `${lost} failed` : ""}
          </span>
        </div>
        <span className="min-h-4 text-center text-[10px] leading-4 text-mute">
          {owners(k)
            .map((t) => `T${t + 1}`)
            .join(" ")}
        </span>
      </div>
    );
  };

  return (
    <div ref={ref}>
      <div className="mb-5 text-13">
        <Row k="counter =" w="10ch">
          <Words options={["AtomicLong", "LongAdder"] as const} value={mode} onChange={(v) => reset(n, v)} label="counter type" />
        </Row>
        <Row k="threads =" w="10ch">
          <Slider value={n} min={1} max={8} onChange={(v) => reset(v, mode)} label="threads" />
        </Row>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <Cell k="base" label={mode === "AtomicLong" ? "value" : "base"} value={s.base} />
        {mode === "LongAdder" && (
          <>
            <span className="self-center px-1 text-faint">+</span>
            {s.cells ? (
              s.cells.map((v, j) => <Cell key={j} k={String(j)} label={`cells[${j}]`} value={v} />)
            ) : (
              <div className="flex min-h-[86px] flex-1 items-center justify-center rounded-xs px-3 text-11 text-faint" style={{ border: "1px dashed var(--line-2)" }}>
                cells = null (created on first contention)
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-12 sm:grid-cols-4">
        <Stat k="sum()" v={sum.toLocaleString("en-US")} />
        <Stat k="per tick" v={`${perTick} / ${n}`} />
        <Stat k="failed CAS" v={s.fail.toLocaleString("en-US")} tone={s.fail ? "dead" : undefined} />
        <Stat k="wasted" v={`${wasted}%`} tone={wasted > 20 ? "dead" : undefined} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="act solid" onClick={() => setRunning((r) => !r)}>
          {running ? "pause" : s.tick ? "keep going" : "run"}
        </button>
        <button className="act" onClick={() => setS((cur) => tick(cur, n, mode, rand.current))} disabled={running}>
          one tick
        </button>
        <button className="act" onClick={() => reset()}>
          reset
        </button>
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "dead" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
}
