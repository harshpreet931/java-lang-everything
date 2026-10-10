"use client";

import { useMemo, useState } from "react";
import { RUNS } from "./data/pauses";
import { Legend, Row, Stat, Words, useWidth } from "./kit";

// every GC of a real run, parsed out of the log: heap used before/after each collection on
// top, every stop-the-world pause underneath (log scale). same program, five collectors.

const NAMES = ["G1", "Parallel", "Serial", "Shenandoah", "ZGC"] as const;
type Name = (typeof NAMES)[number];

export function PauseChart() {
  const [name, setName] = useState<Name>("G1");
  const [hover, setHover] = useState<number | null>(null);
  const [ref, w] = useWidth();
  const run = RUNS[name];
  const W = Math.max(300, w);
  const padL = 40;
  const padR = 8;
  const hH = 120;
  const pH = 110;
  const gap = 26;
  const H = hH + gap + pH + 22;
  const end = Math.max(...run.pauses.map((p) => p[0]), ...run.heap.map((h) => h[0])) * 1.02;
  // rounded, so server and browser agree on every coordinate (Math.log10 can differ in the last bit)
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const xs = (t: number) => r2(padL + (t / end) * (W - padL - padR));
  const hy = (mb: number) => r2(18 + (1 - mb / 256) * (hH - 18));
  const LOG_MIN = -3; // 0.001 ms
  const LOG_MAX = 2; // 100 ms
  const py = (ms: number) => {
    const v = Math.min(LOG_MAX, Math.max(LOG_MIN, Math.log10(ms)));
    return r2(hH + gap + (1 - (v - LOG_MIN) / (LOG_MAX - LOG_MIN)) * pH);
  };

  const heapPath = useMemo(() => {
    let d = "";
    let prevAfter: number | null = null;
    for (const [t, before, after] of run.heap) {
      const x = xs(t).toFixed(1);
      d += prevAfter === null ? `M ${x} ${hy(before).toFixed(1)} ` : `L ${x} ${hy(before).toFixed(1)} `;
      d += `L ${x} ${hy(after).toFixed(1)} `;
      prevAfter = after;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, W]);

  const total = run.pauses.reduce((a, p) => a + p[1], 0);
  const max = Math.max(...run.pauses.map((p) => p[1]));
  const hp = hover !== null ? run.pauses[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - r.left - padL) / (W - padL - padR)) * end;
    let best = -1;
    let bd = Infinity;
    run.pauses.forEach((p, i) => {
      const d = Math.abs(p[0] - t) - p[1] / 1000; // prefer the bigger pause when close
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best >= 0 ? best : null);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Row k="collector" last>
        <Words
          options={NAMES}
          value={name}
          onChange={(n) => {
            setName(n);
            setHover(null);
          }}
          label="collector"
        />
      </Row>
      <div ref={ref} className="min-w-0">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none"
          style={{ fontFamily: "var(--font-code)" }}
          role="img"
          aria-label={`${name}: ${run.pauses.length} pauses, longest ${max} ms, total ${total.toFixed(1)} ms`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* heap chart */}
          <text x={0} y={10} fontSize={10} fill="var(--faint)">
            heap MB
          </text>
          {[0, 128, 256].map((mb) => (
            <g key={mb}>
              <line x1={padL} x2={W - padR} y1={hy(mb)} y2={hy(mb)} stroke="var(--line)" />
              <text x={padL - 6} y={hy(mb) + 3} textAnchor="end" fontSize={9} fill="var(--faint)" className="tabular">
                {mb}
              </text>
            </g>
          ))}
          <path d={heapPath} fill="none" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" opacity={0.75} />

          {/* pause chart */}
          <text x={0} y={hH + gap - 8} fontSize={10} fill="var(--faint)">
            pause ms
          </text>
          {[0.01, 1, 100].map((ms) => (
            <g key={ms}>
              <line x1={padL} x2={W - padR} y1={py(ms)} y2={py(ms)} stroke="var(--line)" />
              <text x={padL - 6} y={py(ms) + 3} textAnchor="end" fontSize={9} fill="var(--faint)" className="tabular">
                {ms}
              </text>
            </g>
          ))}
          {run.pauses.map(([t, ms, k], i) => (
            <line
              key={i}
              x1={xs(t)}
              x2={xs(t)}
              y1={hH + gap + pH}
              y2={py(ms)}
              stroke={k === "f" ? "var(--dead)" : "var(--hot)"}
              strokeWidth={hover === i ? 2.4 : 1.2}
              opacity={hover === null || hover === i ? 0.9 : 0.35}
            />
          ))}
          {/* time axis */}
          {[0, 0.5, 1, 1.5, 2].filter((s) => s <= end).map((s) => (
            <text key={s} x={xs(s)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--faint)" className="tabular">
              {s}s
            </text>
          ))}
          {hp && <line x1={xs(hp[0])} x2={xs(hp[0])} y1={4} y2={hH + gap + pH} stroke="var(--hi)" strokeDasharray="2 3" opacity={0.5} />}
        </svg>
      </div>
      <div className="min-h-[1.6em] text-12 text-mute" aria-live="polite">
        {hp ? (
          <>
            at <span className="text-hi tabular">{hp[0].toFixed(3)}s</span>: a{" "}
            <span style={{ color: hp[2] === "f" ? "var(--dead)" : "var(--hot)" }}>
              {hp[2] === "f" ? "full GC" : hp[2] === "m" ? "mixed GC" : hp[2] === "y" ? "young GC" : "pause"}
            </span>{" "}
            of <span className="text-hi tabular">{hp[1]} ms</span>
          </>
        ) : (
          <span className="text-faint">hover the chart to inspect a pause.</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
        <Stat k="pauses" v={run.pauses.length} />
        <Stat k="longest" v={`${max} ms`} tone="hot" />
        <Stat k="all pauses" v={`${total.toFixed(total < 10 ? 1 : 0)} ms`} />
        <Stat k="full GCs" v={run.pauses.filter((p) => p[2] === "f").length} tone={run.pauses.some((p) => p[2] === "f") ? "dead" : undefined} />
      </div>
      <Legend
        items={[
          ["mute", "heap used (before → after each GC)"],
          ["hot", "a stop-the-world pause"],
          ["dead", "a full GC"],
        ]}
      />
    </div>
  );
}
