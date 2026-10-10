"use client";

import { useState } from "react";
import { useWidth } from "../meta/kit";

// rounded so server and client render identical svg attributes (Math.log10 differs in the last digits)
const rnd = (n: number) => Math.round(n * 100) / 100;

// the first 60 calls of one benchmark method, timed one call each (JMH single-shot mode,
// -bm ss -wi 0 -i 60 -f 3), in three fresh JVMs. the method groups 5,000 strings by length
// with a stream. jdk 25, apple M4 Pro. steady state from a normal warmed-up run: 41.585 µs/op.

const FORKS: number[][] = [
  [3549.083, 525.917, 489.584, 419.375, 223.0, 108.375, 111.375, 124.959, 114.5, 102.625, 98.125, 98.917, 122.458, 72.5, 66.042, 66.0, 70.166, 71.834, 68.291, 75.0, 77.125, 67.833, 71.334, 51.083, 68.0, 50.333, 65.542, 68.833, 57.917, 67.0, 59.125, 58.042, 63.458, 56.709, 67.292, 59.292, 57.667, 69.666, 48.833, 48.875, 96.167, 66.458, 89.166, 60.667, 85.875, 52.875, 83.708, 63.625, 79.666, 64.708, 68.75, 59.667, 94.459, 63.0, 76.958, 55.125, 67.583, 55.334, 61.083, 48.584],
  [3215.417, 563.792, 471.5, 521.75, 200.209, 109.125, 119.291, 120.875, 123.75, 117.583, 147.625, 113.916, 133.417, 80.416, 65.708, 69.0, 54.458, 62.25, 57.583, 54.958, 71.083, 66.292, 60.291, 55.875, 64.542, 62.25, 60.041, 69.291, 58.708, 58.334, 57.75, 53.791, 60.542, 59.542, 55.583, 47.833, 50.083, 50.458, 62.833, 59.625, 90.916, 48.208, 63.542, 47.5, 86.292, 60.458, 78.584, 61.667, 83.417, 71.625, 85.125, 57.958, 76.125, 58.75, 78.708, 63.708, 93.5, 53.542, 122.667, 53.875],
  [3401.083, 464.333, 436.916, 443.166, 263.959, 144.167, 113.834, 135.041, 115.375, 132.167, 112.875, 116.458, 128.0, 69.458, 71.167, 69.417, 64.583, 62.708, 68.25, 59.167, 72.833, 59.042, 61.875, 59.875, 58.375, 59.583, 59.625, 69.334, 62.209, 64.708, 65.833, 56.042, 68.5, 65.916, 62.375, 49.167, 48.25, 115.458, 66.292, 62.291, 95.417, 61.792, 84.334, 63.292, 76.25, 57.667, 83.416, 68.042, 80.833, 70.75, 80.541, 63.5, 85.25, 62.959, 82.584, 62.042, 84.458, 71.667, 85.292, 55.292],
];
const STEADY = 41.585;

const PHASES = [
  { from: 1, to: 1, label: "call 1", note: "the very first call: about 3.4 ms, 80 times the steady state. the stream classes get loaded and linked, the lambdas get bootstrapped, and the bytecode runs in the interpreter. -XX:+PrintCompilation shows the first C1 compiles (tier 3) starting during this call." },
  { from: 2, to: 5, label: "calls 2-5", note: "200 to 560 µs. the hot methods now run as tier-3 code: compiled by C1, but stuffed with profiling counters for C2's benefit, so not that fast." },
  { from: 6, to: 13, label: "calls 6-13", note: "100 to 150 µs. during call 5, C2 (tier 4) versions of the inner methods landed: HashMap.computeIfAbsent and the grouping lambda. the loop driving them is still slower code." },
  { from: 14, to: 60, label: "calls 14-60", note: "50 to 90 µs, still noisy. around calls 13 to 15 the driving loop, ArrayListSpliterator.forEachRemaining, got compiled too. a properly warmed-up run measures 41.6 µs, so sixty calls in, this method still isn't at full speed." },
];

export function WarmupCurve() {
  const [phase, setPhase] = useState(0);
  const [box, W] = useWidth<HTMLDivElement>(640);
  const H = W < 480 ? 240 : 220;
  const L = 50;
  const x = (i: number) => rnd(L + ((i - 0.5) / 60) * (W - L - 12));
  const lo = Math.log10(30);
  const hi = Math.log10(5000);
  const y = (us: number) => rnd(H - 26 - ((Math.log10(us) - lo) / (hi - lo)) * (H - 40));
  const ph = PHASES[phase];
  const tones = ["var(--ink)", "var(--ref)", "var(--meta)"];

  return (
    <div className="@container">
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="time per call for the first 60 calls in three JVMs, log scale: from about 3.4 milliseconds down to about 60 microseconds">
          <rect x={x(ph.from) - (W - L - 12) / 120} y={8} width={((ph.to - ph.from + 1) / 60) * (W - L - 12)} height={H - 34} fill="color-mix(in srgb, var(--hot) 10%, transparent)" />
          {[50, 100, 500, 1000, 3000].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={L - 5} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
                {v >= 1000 ? `${v / 1000}ms` : `${v}µs`}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - 8} y1={y(STEADY)} y2={y(STEADY)} stroke="var(--live)" strokeDasharray="4 3" />
          <text x={W - 10} y={y(STEADY) + 13} textAnchor="end" fontSize={10} fill="var(--live)" fontFamily="var(--font-code)">
            warmed up: 41.6µs
          </text>
          {FORKS.map((f, fi) => (
            <g key={fi}>
              <polyline points={f.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ")} fill="none" stroke={tones[fi]} strokeWidth={1} opacity={0.35} />
              {f.map((v, i) => (
                <circle key={i} cx={x(i + 1)} cy={y(v)} r={2} fill={tones[fi]} opacity={0.8} />
              ))}
            </g>
          ))}
          {[1, 10, 20, 30, 40, 50, 60].map((i) => (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
              {i}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        <span>x: call number. y: time for that one call, log scale.</span>
        <span>three dot colours = three separate JVMs (forks).</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="phase">
        {PHASES.map((p, i) => (
          <button key={p.label} className="word" aria-pressed={phase === i} onClick={() => setPhase(i)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {ph.note}
      </p>
    </div>
  );
}
