"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Readout, Stat, useWidth } from "./kit";

// throughput, latency, footprint: drag a point inside the triangle, get a collector.
// the stats under each pick are measured: the toy service from serial-and-parallel.mdx,
// -Xmx256m, default settings, jdk 25, 14-core arm mac (busy), median of three runs.
// GC memory: NMT "GC" category, idle program, -Xms256m -Xmx256m.

type Pick = "Parallel" | "ZGC" | "Serial" | "G1";
const INFO: Record<Pick, { flag: string; why: string; pause: string; total: string; wall: string; mem: string }> = {
  Parallel: {
    flag: "-XX:+UseParallelGC",
    why: "you care about total work done, not individual pauses: batch jobs, ETL, builds, offline analytics. lowest GC overhead on many cores.",
    pause: "21.7 ms",
    total: "521 ms",
    wall: "1.19 s",
    mem: "37.9 MB",
  },
  ZGC: {
    flag: "-XX:+UseZGC",
    why: "every request has a latency budget and the heap is big, or you just never want to think about pauses again. give it headroom and spare cores. Shenandoah is the other option here.",
    pause: "0.039 ms",
    total: "1.7 ms",
    wall: "1.11 s",
    mem: "1.4 MB",
  },
  Serial: {
    flag: "-XX:+UseSerialGC",
    why: "a small heap, one or two cores, every megabyte counts: tiny containers, CLI tools, short jobs. pauses stay short because the heap is small.",
    pause: "26.6 ms",
    total: "1,413 ms",
    wall: "2.08 s",
    mem: "0.8 MB",
  },
  G1: {
    flag: "(nothing: it's the default) or -XX:+UseG1GC",
    why: "a bit of everything, which is most services. predictable pauses around a goal, decent throughput, sane footprint. start here and only move if a GC log tells you to.",
    pause: "8.3 ms",
    total: "515 ms",
    wall: "1.30 s",
    mem: "59.6 MB",
  },
};

// corners: latency (top), throughput (bottom left), footprint (bottom right)
type P = { x: number; y: number };

export function GcPicker() {
  const [ref, w] = useWidth();
  const W = Math.max(280, Math.min(w, 520));
  const H = Math.round(W * 0.78);
  const pad = 28;
  const A: P = { x: W / 2, y: pad }; // latency
  const B: P = { x: pad, y: H - pad }; // throughput
  const C: P = { x: W - pad, y: H - pad }; // footprint
  // the point, stored as barycentric weights so it survives resizes
  const [wts, setWts] = useState<[number, number, number]>([1 / 3, 1 / 3, 1 / 3]); // [latency, throughput, footprint]
  const drag = useRef(false);

  const pt = { x: wts[0] * A.x + wts[1] * B.x + wts[2] * C.x, y: wts[0] * A.y + wts[1] * B.y + wts[2] * C.y };

  const toBary = (p: P): [number, number, number] => {
    const d = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    let a = ((B.y - C.y) * (p.x - C.x) + (C.x - B.x) * (p.y - C.y)) / d;
    let b = ((C.y - A.y) * (p.x - C.x) + (A.x - C.x) * (p.y - C.y)) / d;
    a = Math.max(0, a);
    b = Math.max(0, b);
    let c = Math.max(0, 1 - a - b);
    const s = a + b + c;
    return [a / s, b / s, (c = c / s)];
  };

  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setWts(toBary({ x: e.clientX - r.left, y: e.clientY - r.top }));
  };

  const nudge = (k: string) => {
    const step = 0.06;
    const [l, t, f] = wts;
    const map: Record<string, [number, number, number]> = {
      ArrowUp: [l + step, t - step / 2, f - step / 2],
      ArrowDown: [l - step, t + step / 2, f + step / 2],
      ArrowLeft: [l, t + step, f - step],
      ArrowRight: [l, t - step, f + step],
    };
    const n = map[k];
    if (!n) return false;
    const c = n.map((v) => Math.max(0, v)) as [number, number, number];
    const s = c[0] + c[1] + c[2];
    setWts([c[0] / s, c[1] / s, c[2] / s]);
    return true;
  };

  const [l, t, f] = wts;
  const top = Math.max(l, t, f);
  const pick: Pick = top < 0.5 ? "G1" : top === l ? "ZGC" : top === t ? "Parallel" : "Serial";
  const info = INFO[pick];
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div ref={ref} className="flex min-w-0 justify-center">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block cursor-crosshair touch-none outline-none"
          style={{ fontFamily: "var(--font-code)" }}
          tabIndex={0}
          role="slider"
          aria-label="what you care about: latency, throughput, footprint. use arrow keys to move the point"
          aria-valuetext={`latency ${pct(l)}, throughput ${pct(t)}, footprint ${pct(f)}: ${pick}`}
          onPointerDown={(e) => {
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => drag.current && move(e)}
          onPointerUp={() => (drag.current = false)}
          onKeyDown={(e) => {
            if (nudge(e.key)) e.preventDefault();
          }}
        >
          <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} fill="var(--bg)" stroke="var(--line-2)" />
          {/* the G1 zone: no single goal above 50% */}
          <polygon
            points={[
              [0.5, 0.5, 0],
              [0.5, 0, 0.5],
              [0, 0.5, 0.5],
            ]
              .map(([a, b, c]) => `${a * A.x + b * B.x + c * C.x},${a * A.y + b * B.y + c * C.y}`)
              .join(" ")}
            fill="var(--well-2)"
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <text x={W / 2} y={H * 0.62} textAnchor="middle" fontSize={11} fill={pick === "G1" ? "var(--hi)" : "var(--faint)"}>
            G1
          </text>
          <text x={A.x} y={A.y + 42} textAnchor="middle" fontSize={11} fill={pick === "ZGC" ? "var(--hi)" : "var(--faint)"}>
            ZGC
          </text>
          <text x={B.x + 36} y={B.y - 10} textAnchor="middle" fontSize={11} fill={pick === "Parallel" ? "var(--hi)" : "var(--faint)"}>
            Parallel
          </text>
          <text x={C.x - 30} y={C.y - 10} textAnchor="middle" fontSize={11} fill={pick === "Serial" ? "var(--hi)" : "var(--faint)"}>
            Serial
          </text>
          <text x={A.x} y={A.y - 10} textAnchor="middle" fontSize={11} fill="var(--ink)">
            low latency
          </text>
          <text x={B.x - 4} y={B.y + 18} fontSize={11} fill="var(--ink)">
            throughput
          </text>
          <text x={C.x + 4} y={C.y + 18} textAnchor="end" fontSize={11} fill="var(--ink)">
            small footprint
          </text>
          <circle cx={pt.x} cy={pt.y} r={9} fill="color-mix(in srgb, var(--hot) 25%, transparent)" stroke="var(--hot)" strokeWidth={1.6} />
          <circle cx={pt.x} cy={pt.y} r={2.5} fill="var(--hot)" />
        </svg>
      </div>

      <div className="rounded-md bg-bg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-16 text-hi">{pick}</span>
          <span className="font-mono text-12 text-hot">{info.flag}</span>
        </div>
        <Readout className="mt-1" minLines={2}>
          {info.why}
        </Readout>
        <div className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-2 sm:grid-cols-4">
          <Stat k="longest pause" v={info.pause} />
          <Stat k="all pauses" v={info.total} />
          <Stat k="wall clock" v={info.wall} />
          <Stat k="GC's own memory" v={info.mem} />
        </div>
      </div>
      <div className="text-11 text-faint">
        weights: latency {pct(l)} · throughput {pct(t)} · footprint {pct(f)}. drag the point, or focus the triangle and use the arrow keys.
      </div>
    </div>
  );
}
