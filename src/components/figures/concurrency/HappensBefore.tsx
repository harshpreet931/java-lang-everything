"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

// happens-before, drawn. two threads as columns of actions. grey arrows are program
// order. the amber arrow is the synchronizes-with edge each rule adds. when there's a
// chain from the write of data to the read of data, the read is guaranteed to see it.

type Ev = { lane: 0 | 1; row: number; label: string; sub?: string; role?: "w" | "r" };
type Sc = {
  key: string;
  lanes: [string, string];
  events: Ev[];
  sw?: [number, number, string];
  none?: [number, number];
  chain: number[];
  result: string;
  ok: boolean;
  rule: string;
};

const SCENES: Sc[] = [
  {
    key: "volatile",
    lanes: ["T1", "T2"],
    events: [
      { lane: 0, row: 0, label: "data = 42", role: "w" },
      { lane: 0, row: 1, label: "ready = true", sub: "volatile write" },
      { lane: 1, row: 2, label: "while (!ready)", sub: "volatile read, sees true" },
      { lane: 1, row: 3, label: "r = data", role: "r" },
    ],
    sw: [1, 2, "volatile write → read of it"],
    chain: [0, 1, 2, 3],
    result: "r = 42, guaranteed",
    ok: true,
    rule: "a write to a volatile field happens-before every later read of that field. everything T1 did before the write rides along.",
  },
  {
    key: "lock",
    lanes: ["T1", "T2"],
    events: [
      { lane: 0, row: 0, label: "synchronized (m) {", sub: "lock m" },
      { lane: 0, row: 1, label: "data = 42", role: "w" },
      { lane: 0, row: 2, label: "}", sub: "unlock m" },
      { lane: 1, row: 3, label: "synchronized (m) {", sub: "lock m, after T1" },
      { lane: 1, row: 4, label: "r = data", role: "r" },
    ],
    sw: [2, 3, "unlock → next lock of m"],
    chain: [1, 2, 3, 4],
    result: "r = 42, guaranteed",
    ok: true,
    rule: "unlocking a monitor happens-before every later lock of the same monitor. a different monitor gives you nothing.",
  },
  {
    key: "start",
    lanes: ["main", "t"],
    events: [
      { lane: 0, row: 0, label: "data = 42", role: "w" },
      { lane: 0, row: 1, label: "t.start()" },
      { lane: 1, row: 2, label: "run() begins" },
      { lane: 1, row: 3, label: "r = data", role: "r" },
    ],
    sw: [1, 2, "start() → first action of t"],
    chain: [0, 1, 2, 3],
    result: "r = 42, guaranteed",
    ok: true,
    rule: "calling start() happens-before every action in the started thread. that's why a lambda can read what main set up before starting it.",
  },
  {
    key: "join",
    lanes: ["t", "main"],
    events: [
      { lane: 0, row: 0, label: "data = 42", role: "w" },
      { lane: 0, row: 1, label: "run() ends" },
      { lane: 1, row: 0, label: "t.join()", sub: "waiting..." },
      { lane: 1, row: 2, label: "join() returns" },
      { lane: 1, row: 3, label: "r = data", role: "r" },
    ],
    sw: [1, 3, "last action of t → join() returns"],
    chain: [0, 1, 3, 4],
    result: "r = 42, guaranteed",
    ok: true,
    rule: "everything a thread does happens-before another thread returns from join() on it (or sees isAlive() return false).",
  },
  {
    key: "no edge",
    lanes: ["T1", "T2"],
    events: [
      { lane: 0, row: 0, label: "data = 42", role: "w" },
      { lane: 0, row: 1, label: "ready = true", sub: "plain write" },
      { lane: 1, row: 2, label: "while (!ready)", sub: "plain read" },
      { lane: 1, row: 3, label: "r = data", role: "r" },
    ],
    none: [1, 2],
    chain: [],
    result: "r = 0 or 42. or the loop never ends",
    ok: false,
    rule: "plain fields create no edge between threads. T2 may see ready before data, see neither, or (after the JIT hoists the read) spin forever.",
  },
];

type Path = { d: string; kind: "po" | "sw" | "none"; on: boolean; lx?: number; ly?: number; label?: string };

export function HappensBefore() {
  const [k, setK] = useState(0);
  const sc = SCENES[k];
  const box = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const id = useId().replace(/:/g, "");
  const rows = Math.max(...sc.events.map((e) => e.row)) + 1;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const rb = el.getBoundingClientRect();
      const r = (i: number) => {
        const n = el.querySelector<HTMLElement>(`[data-ev="${i}"]`);
        const b = n!.getBoundingClientRect();
        return { l: b.left - rb.left, r: b.right - rb.left, t: b.top - rb.top, b: b.bottom - rb.top, cx: b.left - rb.left + b.width / 2, cy: b.top - rb.top + b.height / 2 };
      };
      const out: Path[] = [];
      const inChain = (a: number, b: number) => {
        const ia = sc.chain.indexOf(a);
        return ia >= 0 && sc.chain[ia + 1] === b;
      };
      // program order: consecutive events in each lane
      for (const lane of [0, 1] as const) {
        const ids = sc.events
          .map((e, i) => ({ e, i }))
          .filter((x) => x.e.lane === lane)
          .sort((a, b) => a.e.row - b.e.row)
          .map((x) => x.i);
        for (let j = 0; j + 1 < ids.length; j++) {
          const a = r(ids[j]);
          const b = r(ids[j + 1]);
          out.push({ d: `M ${a.cx} ${a.b + 2} L ${b.cx} ${b.t - 3}`, kind: "po", on: inChain(ids[j], ids[j + 1]) });
        }
      }
      const cross = (pair: [number, number], kind: "sw" | "none", label: string) => {
        const a = r(pair[0]);
        const b = r(pair[1]);
        const x1 = a.r + 2;
        const y1 = a.cy;
        const x2 = b.l - 3;
        const y2 = b.cy;
        const mx = (x1 + x2) / 2;
        out.push({
          d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
          kind,
          on: kind === "sw",
          lx: mx,
          ly: (y1 + y2) / 2,
          label,
        });
      };
      if (sc.sw) cross([sc.sw[0], sc.sw[1]], "sw", sc.sw[2]);
      if (sc.none) cross(sc.none, "none", "no edge");
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sc]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1" role="tablist" aria-label="happens-before rules">
        {SCENES.map((x, j) => (
          <button key={x.key} role="tab" aria-selected={k === j} className="word" onClick={() => setK(j)}>
            {x.key}
          </button>
        ))}
      </div>

      <div ref={box} className="relative">
        <div className="grid grid-cols-2 gap-x-[22%]" style={{ gridTemplateRows: `auto repeat(${rows}, minmax(52px, auto))` }}>
          {sc.lanes.map((l, i) => (
            <div key={l} className="border-b border-line pb-1.5 text-center text-12 text-hi" style={{ gridColumn: i + 1, gridRow: 1 }}>
              {l}
            </div>
          ))}
          {sc.events.map((e, i) => {
            const tone = e.role === "r" ? (sc.ok ? "var(--live)" : "var(--dead)") : e.role === "w" ? "var(--ink)" : undefined;
            return (
              <div key={`${sc.key}-${i}`} className="flex items-center justify-center py-2.5" style={{ gridColumn: e.lane + 1, gridRow: e.row + 2 }}>
                <div
                  data-ev={i}
                  className="obj-in min-w-0 rounded-md bg-well px-2.5 py-1.5 text-center"
                  style={{ boxShadow: `inset 0 0 0 1px ${tone ?? "var(--line-2)"}` }}
                >
                  <div className="text-12 whitespace-nowrap" style={{ color: tone ?? "var(--hi)" }}>
                    {e.label}
                  </div>
                  {e.sub && <div className="text-[10px] leading-3 text-faint">{e.sub}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            {(["po", "on", "sw", "none"] as const).map((m) => (
              <marker key={m} id={`${id}-${m}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path
                  d="M0 0.5 L7.5 4 L0 7.5 z"
                  fill={m === "po" ? "var(--line-2)" : m === "on" ? "var(--live)" : m === "sw" ? "var(--hot)" : "var(--dead)"}
                />
              </marker>
            ))}
          </defs>
          {paths.map((p, i) => {
            const stroke = p.kind === "sw" ? "var(--hot)" : p.kind === "none" ? "var(--dead)" : p.on ? "var(--live)" : "var(--line-2)";
            const m = p.kind === "sw" ? "sw" : p.kind === "none" ? "none" : p.on ? "on" : "po";
            return (
              <g key={`${sc.key}-${i}`} className="arrow-in">
                <path d={p.d} fill="none" stroke={stroke} strokeWidth={p.kind === "po" ? 1.2 : 1.5} strokeDasharray={p.kind === "none" ? "4 4" : undefined} markerEnd={`url(#${id}-${m})`} />
              </g>
            );
          })}
        </svg>
        {paths
          .filter((p) => p.label)
          .map((p) => (
            <span
              key={`${sc.key}-${p.label}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xs bg-well px-1.5 text-center text-[10px] leading-[1.35] text-balance"
              style={{ left: p.lx, top: p.ly, color: p.kind === "sw" ? "var(--hot)" : "var(--dead)", maxWidth: "21%" }}
            >
              {p.label}
            </span>
          ))}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-3 text-13">
        <span className="text-faint">result:</span>
        <span style={{ color: sc.ok ? "var(--live)" : "var(--dead)" }}>{sc.result}</span>
      </div>
      <p className="mt-2 min-h-[3.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {sc.rule}
      </p>
    </div>
  );
}
