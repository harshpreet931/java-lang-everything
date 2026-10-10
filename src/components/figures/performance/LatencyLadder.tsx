"use client";

import { useState } from "react";
import { useWidth } from "../meta/kit";

// pointer chasing over a random cycle through an int[] of the given size: every load depends on
// the one before, so the time per step is the latency of wherever the data lives. measured on an
// apple M4 Pro (jdk 25, 20M steps after a warm-up pass). cache sizes from `sysctl hw.perflevel0`:
// 128 KB L1 data per performance core, 16 MB L2 shared by each cluster of 5 performance cores.

const DATA: [number, number][] = [
  [4, 1.54], [8, 1.74], [16, 1.56], [32, 1.56], [64, 1.57], [96, 1.55], [128, 1.49], [192, 3.59], [256, 4.51],
  [512, 5.82], [1024, 6.44], [2048, 6.4], [4096, 8.24], [8192, 10.43], [12288, 12.85], [16384, 17.82], [24576, 29.73],
  [32768, 47.15], [49152, 68.22], [65536, 84.5], [131072, 108.07], [262144, 120.23], [524288, 124.05], [1048576, 124.14],
];

const ZONES = [
  { from: 4, to: 128, label: "L1", note: "up to 128 KB, everything is in the core's own L1 data cache: about 1.5 ns per step, and that includes the loop itself and the array bounds check." },
  { from: 128, to: 16384, label: "L2", note: "past 128 KB the data spills into the 16 MB L2 shared by the cluster: 3.6 ns, creeping up to 18 ns as the working set grows and the address translation cache (the TLB) starts missing too." },
  { from: 16384, to: 1048576, label: "beyond L2", note: "past the L2, loads go to the system-level cache and then to DRAM: up to 124 ns per step. about 80 times slower than L1, for the exact same line of java." },
];

const sizeLabel = (kb: number) => (kb >= 1048576 ? `${kb / 1048576}GB` : kb >= 1024 ? `${kb / 1024}MB` : `${kb}KB`);
const rnd = (n: number) => Math.round(n * 100) / 100;

export function LatencyLadder() {
  const [zone, setZone] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth<HTMLDivElement>(640);
  const H = W < 480 ? 240 : 220;
  const L = 44;
  const lx = (kb: number) => rnd(L + ((Math.log2(kb) - 2) / 18) * (W - L - 14));
  const ly = (ns: number) => rnd(H - 28 - ((Math.log10(ns) - Math.log10(1)) / (Math.log10(200) - Math.log10(1))) * (H - 44));
  const z = ZONES[zone];
  const hv = hover !== null ? DATA[hover] : null;

  return (
    <div className="@container">
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="nanoseconds per dependent load against working set size: flat at 1.5 ns until 128 KB, then up to 124 ns past 128 MB">
          <rect x={lx(z.from)} y={10} width={rnd(lx(z.to) - lx(z.from))} height={H - 38} fill="color-mix(in srgb, var(--hot) 10%, transparent)" />
          {ZONES.map((zz) => (
            <g key={zz.label}>
              <line x1={lx(zz.to)} x2={lx(zz.to)} y1={10} y2={H - 28} stroke="var(--line-2)" strokeDasharray="3 3" />
              <text x={rnd((lx(zz.from) + lx(zz.to)) / 2)} y={22} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
                {zz.label}
              </text>
            </g>
          ))}
          {[1, 2, 5, 10, 20, 50, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - 10} y1={ly(v)} y2={ly(v)} stroke="var(--line)" />
              <text x={L - 5} y={ly(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
                {v}ns
              </text>
            </g>
          ))}
          <polyline points={DATA.map(([kb, ns]) => `${lx(kb)},${ly(ns)}`).join(" ")} fill="none" stroke="var(--ink)" strokeWidth={1.4} />
          {DATA.map(([kb, ns], i) => (
            <circle
              key={kb}
              cx={lx(kb)}
              cy={ly(ns)}
              r={hover === i ? 5 : 3}
              fill={hover === i ? "var(--hot)" : "var(--ink)"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          ))}
          {[4, 64, 1024, 16384, 262144, 1048576].map((kb) => (
            <text key={kb} x={lx(kb)} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
              {sizeLabel(kb)}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-11 text-faint">
        <span>x: working set (log). y: ns per dependent load (log).</span>
        <span className="text-hi tabular">{hv ? `${sizeLabel(hv[0])}: ${hv[1]} ns per step` : "hover a point"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="cache level">
        {ZONES.map((zz, i) => (
          <button key={zz.label} className="word" aria-pressed={zone === i} onClick={() => setZone(i)}>
            {zz.label}
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {z.note}
      </p>
    </div>
  );
}
