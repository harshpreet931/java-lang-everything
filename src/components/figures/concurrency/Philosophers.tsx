"use client";

import { useId, useRef, useState } from "react";
import { Narrate, Row, Words, rng, useTicker } from "./ui";

// the dining philosophers. five threads (P0..P4), five locks (forks) between them.
// P_i needs fork i (left) and fork (i+1)%5 (right), and takes them one per tick.
//   left then right: every philosopher can end up holding a left fork → deadlock
//   lower fork first: P4 takes fork 0 before fork 4, which breaks the cycle
//   tryLock + back off: can't deadlock; drops its fork and retries later instead
// the red arrows are the wait-for graph: "P_i waits for the holder of the fork it wants".

type Strat = "naive" | "ordered" | "trylock";
type Ph = { st: "think" | "hungry" | "eat" | "back"; t: number; has: number[]; meals: number };
type St = { ph: Ph[]; forks: (number | null)[]; tick: number; dead: number[] | null; note: string };

const N = 5;
const L = (i: number) => i;
const R = (i: number) => (i + 1) % N;

const fresh = (r: () => number): St => ({
  ph: Array.from({ length: N }, () => ({ st: "think", t: 1 + Math.floor(r() * 5), has: [], meals: 0 })),
  forks: Array(N).fill(null),
  tick: 0,
  dead: null,
  note: "five philosophers think, get hungry, grab two forks, eat, and put them down. press run.",
});

function order(i: number, s: Strat) {
  return s === "ordered" ? [Math.min(L(i), R(i)), Math.max(L(i), R(i))] : [L(i), R(i)];
}

// wait-for edges: hungry philosopher → holder of the next fork it wants
function waitFor(st: St, strat: Strat): [number, number][] {
  const out: [number, number][] = [];
  st.ph.forEach((p, i) => {
    if (p.st !== "hungry") return;
    const need = order(i, strat).find((f) => !p.has.includes(f));
    if (need === undefined) return;
    const h = st.forks[need];
    if (h !== null && h !== i) out.push([i, h]);
  });
  return out;
}

function findCycle(edges: [number, number][]): number[] | null {
  const next = new Map(edges.map(([a, b]) => [a, b]));
  for (const [start] of edges) {
    const seen: number[] = [];
    let cur: number | undefined = start;
    while (cur !== undefined && !seen.includes(cur)) {
      seen.push(cur);
      cur = next.get(cur);
    }
    if (cur !== undefined) return seen.slice(seen.indexOf(cur));
  }
  return null;
}

function step(s: St, strat: Strat, r: () => number): St {
  if (s.dead) return s;
  const ph = s.ph.map((p) => ({ ...p, has: [...p.has] }));
  const forks = [...s.forks];
  let note = "";
  const idx = Array.from({ length: N }, (_, i) => i).sort(() => r() - 0.5);
  for (const i of idx) {
    const p = ph[i];
    if (p.st === "think" || p.st === "back") {
      p.t -= 1;
      if (p.t <= 0) p.st = "hungry";
    } else if (p.st === "eat") {
      p.t -= 1;
      if (p.t <= 0) {
        p.has.forEach((f) => (forks[f] = null));
        p.has = [];
        p.meals += 1;
        p.st = "think";
        p.t = 2 + Math.floor(r() * 5);
      }
    } else {
      const [a, b] = order(i, strat);
      if (!p.has.includes(a)) {
        if (forks[a] === null) {
          forks[a] = i;
          p.has.push(a);
        }
      } else if (!p.has.includes(b)) {
        if (forks[b] === null) {
          forks[b] = i;
          p.has.push(b);
          p.st = "eat";
          p.t = 2 + Math.floor(r() * 3);
        } else if (strat === "trylock") {
          forks[a] = null;
          p.has = [];
          p.st = "back";
          p.t = 1 + Math.floor(r() * 4);
          note = `P${i}'s tryLock on fork ${b} fails, so it puts fork ${a} back down and backs off for a random moment instead of waiting while holding it.`;
        }
      }
    }
  }
  const next: St = { ph, forks, tick: s.tick + 1, dead: null, note: note || s.note };
  // tryLock threads are never blocked, so a momentary cycle isn't a deadlock
  const cyc = strat === "trylock" ? null : findCycle(waitFor(next, strat));
  if (cyc) {
    next.dead = cyc;
    next.note = `deadlock. ${cyc.map((c) => `P${c}`).join(" → ")} → P${cyc[0]}: each one holds a fork and waits for the next one's. nobody will ever let go. the threads are all BLOCKED, using no CPU, forever.`;
  } else if (!note && s.tick === 0) {
    next.note = "running. each philosopher takes the first fork, then the second on a later tick.";
  }
  return next;
}

const POS = Array.from({ length: N }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return { x: 150 + 104 * Math.cos(a), y: 150 + 104 * Math.sin(a) };
});
const FORK = Array.from({ length: N }, (_, f) => {
  // fork f sits between P(f-1) and P(f)... P_i's left is fork i, right is fork i+1
  const a = -Math.PI / 2 + ((f - 0.5) * 2 * Math.PI) / N;
  return { x: 150 + 62 * Math.cos(a), y: 150 + 62 * Math.sin(a), a };
});

export function Philosophers() {
  const [strat, setStrat] = useState<Strat>("naive");
  const rand = useRef(rng(23));
  const [s, setS] = useState<St>(() => fresh(rng(23)));
  const [running, setRunning] = useState(false);
  const id = useId().replace(/:/g, "");

  const ref = useTicker(running && !s.dead, 420, () => setS((cur) => step(cur, strat, rand.current)));
  const reset = (st = strat) => {
    setRunning(false);
    rand.current = rng(23);
    setS(fresh(rng(23)));
    setStrat(st);
  };
  const force = () => {
    setS((cur) => ({
      ...cur,
      ph: cur.ph.map((p) => ({ ...p, st: "hungry", t: 0, has: [] })),
      forks: Array(N).fill(null),
      dead: null,
      note: "everyone puts their forks down and gets hungry at exactly the same moment. the worst case, on purpose.",
    }));
    setRunning(true);
  };

  const edges = waitFor(s, strat);
  const cyc = new Set(s.dead ?? []);

  return (
    <div ref={ref}>
      <div className="mb-4 text-13">
        <Row k="each one takes =" w="17ch">
          <Words
            options={[
              { v: "naive", label: "left, then right" },
              { v: "ordered", label: "lower fork first" },
              { v: "trylock", label: "tryLock, back off" },
            ]}
            value={strat}
            onChange={(v) => reset(v as Strat)}
            label="strategy"
          />
        </Row>
      </div>

      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <svg viewBox="0 0 300 300" className="mx-auto block w-full max-w-[320px]" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="five philosophers around a table, forks between them">
          <defs>
            {["dead", "mute"].map((c) => (
              <marker key={c} id={`${id}-${c}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={`var(--${c})`} />
              </marker>
            ))}
          </defs>
          <circle cx={150} cy={150} r={52} fill="var(--well-2)" stroke="var(--line-2)" />
          {/* forks */}
          {FORK.map((f, k) => {
            const h = s.forks[k];
            const p = h !== null ? POS[h] : null;
            const x = p ? f.x + (p.x - f.x) * 0.35 : f.x;
            const y = p ? f.y + (p.y - f.y) * 0.35 : f.y;
            const ang = (Math.atan2(y - 150, x - 150) * 180) / Math.PI;
            return (
              <g key={k} transform={`translate(${x} ${y}) rotate(${ang})`} style={{ transition: "transform 240ms var(--ease)" }}>
                <rect x={-11} y={-2.5} width={22} height={5} rx={2} fill={h !== null ? "var(--meta)" : "var(--line-2)"} />
              </g>
            );
          })}
          {FORK.map((f, k) => (
            <text key={`l${k}`} x={150 + 36 * Math.cos(f.a)} y={150 + 36 * Math.sin(f.a) + 3} textAnchor="middle" fontSize={9} fill="var(--faint)">
              {k}
            </text>
          ))}
          {/* wait-for edges */}
          {edges.map(([a, b]) => {
            const pa = POS[a];
            const pb = POS[b];
            const inCyc = cyc.has(a) && cyc.has(b);
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const len = Math.hypot(dx, dy);
            const ux = dx / len;
            const uy = dy / len;
            const x1 = pa.x + ux * 25;
            const y1 = pa.y + uy * 25;
            const x2 = pb.x - ux * 27;
            const y2 = pb.y - uy * 27;
            // bow the arrow outward a little
            const mx = (x1 + x2) / 2 + (((x1 + x2) / 2 - 150) * 0.35);
            const my = (y1 + y2) / 2 + (((y1 + y2) / 2 - 150) * 0.35);
            return (
              <path
                key={`${a}-${b}`}
                d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke={inCyc ? "var(--dead)" : "var(--mute)"}
                strokeWidth={inCyc ? 1.6 : 1}
                strokeDasharray={inCyc ? undefined : "3 3"}
                markerEnd={`url(#${id}-${inCyc ? "dead" : "mute"})`}
              />
            );
          })}
          {/* philosophers */}
          {POS.map((p, i) => {
            const ph = s.ph[i];
            const tone = cyc.has(i) ? "var(--dead)" : ph.st === "eat" ? "var(--live)" : ph.st === "hungry" ? "var(--hot)" : "var(--line-2)";
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={22} fill="var(--well)" stroke={tone} strokeWidth={ph.st === "think" || ph.st === "back" ? 1 : 1.6} />
                <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={12} fill="var(--hi)">
                  P{i}
                </text>
                <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize={8} fill={tone === "var(--line-2)" ? "var(--faint)" : tone}>
                  {cyc.has(i) ? "stuck" : ph.st === "back" ? "back off" : ph.st === "think" ? "think" : ph.st === "eat" ? "eat" : "hungry"}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="min-w-0">
          <div className="grid gap-1 text-12">
            {s.ph.map((p, i) => (
              <div key={i} className="grid grid-cols-[3ch_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-line py-1">
                <span className="text-hi">P{i}</span>
                <span className="truncate text-faint">
                  holds {p.has.length ? p.has.map((f) => `fork ${f}`).join(", ") : "nothing"}
                </span>
                <span className="text-mute tabular">{p.meals} meals</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="act solid" onClick={() => setRunning((x) => !x)} disabled={!!s.dead}>
              {running && !s.dead ? "pause" : "run"}
            </button>
            <button className="act" onClick={force}>
              everyone hungry at once
            </button>
            <button className="act" onClick={() => reset()}>
              reset
            </button>
          </div>
          <div className="mt-2 text-11 text-faint tabular">tick {s.tick}</div>
        </div>
      </div>
      <Narrate min="5.1em">{s.dead ? <span className="text-dead">{s.note}</span> : s.note}</Narrate>
    </div>
  );
}
