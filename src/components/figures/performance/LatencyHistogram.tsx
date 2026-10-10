"use client";

import { useState } from "react";
import { useWidth } from "../meta/kit";

// rounded so server and client render identical svg attributes (Math.log10 differs in the last digits)
const rnd = (n: number) => Math.round(n * 100) / 100;

// a real latency distribution: 2,000,000 calls of a small HashMap-building "request",
// timed one by one with System.nanoTime() on jdk 25 (apple M4 Pro, -Xmx64m, G1, after
// 300k warm-up calls). buckets are 8 per power of two: bucket k holds 2^(k/8) .. 2^((k+1)/8) ns.

const HIST: [number, number][] = [
  [72, 172], [73, 3919], [74, 22555], [75, 231507], [76, 257859], [77, 653266], [78, 512270], [79, 219642],
  [80, 62802], [81, 22116], [82, 4295], [83, 4069], [84, 2857], [85, 1358], [86, 517], [87, 234], [88, 99],
  [89, 55], [90, 30], [91, 14], [92, 16], [93, 20], [94, 13], [95, 3], [96, 5], [97, 3], [98, 26], [99, 32],
  [100, 10], [101, 7], [102, 2], [103, 3], [104, 1], [105, 2], [108, 2], [110, 1], [113, 1], [115, 2], [116, 2],
  [122, 1], [124, 1], [132, 12], [133, 61], [134, 65], [135, 45], [136, 19], [137, 4], [138, 3], [139, 1], [142, 1],
];

const MARKS = [
  { id: "mean", label: "mean", ns: 855, tone: "hot", note: "the average: 855 ns. it sits right next to the median, looks perfectly healthy, and tells you nothing about the right-hand half of this picture." },
  { id: "p50", label: "p50", ns: 833, tone: "ink", note: "half the requests finished in 833 ns or less. the typical request." },
  { id: "p90", label: "p90", ns: 959, tone: "ink", note: "1 in 10 was slower than 959 ns. still boring." },
  { id: "p99", label: "p99", ns: 1167, tone: "ink", note: "1 in 100 was slower than 1.2 µs. a page that makes 100 calls hits this on almost every load." },
  { id: "p999", label: "p99.9", ns: 1625, tone: "ink", note: "1 in 1,000 was slower than 1.6 µs." },
  { id: "p9999", label: "p99.99", ns: 100584, tone: "dead", note: "1 in 10,000 took over 100 µs: about 118 times the average. that bump on the right is the garbage collector pausing the thread mid-request." },
  { id: "max", label: "max", ns: 225291, tone: "dead", note: "the worst request took 225 µs, 263 times the mean. the mean moved by a fraction of a nanosecond because of it." },
] as const;

const K0 = 70;
const K1 = 144;
const kOf = (ns: number) => Math.log2(ns) * 8;
const maxC = Math.max(...HIST.map((h) => h[1]));

export function LatencyHistogram() {
  const [mark, setMark] = useState<(typeof MARKS)[number]["id"]>("mean");
  const m = MARKS.find((v) => v.id === mark)!;
  const [box, W] = useWidth<HTMLDivElement>(640);
  const H = W < 480 ? 230 : 210;
  const x = (k: number) => rnd(36 + ((k - K0) / (K1 - K0)) * (W - 50));
  const yLog = (c: number) => rnd(H - 30 - (Math.log10(c + 1) / Math.log10(maxC + 1)) * (H - 50));
  const ticks = W < 480 ? [512, 1000, 5000, 20000, 100000] : [512, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];

  return (
    <div className="@container">
      <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="histogram of 2 million request latencies, log scales; most requests take about 800 nanoseconds, a few take over 100 microseconds">
        {[1, 10, 100, 1000, 10000, 100000].map((c) => (
          <g key={c}>
            <line x1={36} x2={W - 14} y1={yLog(c)} y2={yLog(c)} stroke="var(--line)" strokeWidth={1} />
            <text x={32} y={yLog(c) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
              {c >= 1000 ? `${c / 1000}k` : c}
            </text>
          </g>
        ))}
        {HIST.map(([k, c]) => (
          <rect key={k} x={x(k) + 0.5} y={yLog(c)} width={Math.max(1, x(k + 1) - x(k) - 1)} height={H - 30 - yLog(c)} fill={k >= 120 ? "var(--dead)" : "var(--ink)"} opacity={k >= 120 ? 0.85 : 0.55} />
        ))}
        {ticks.map((ns) => (
          <g key={ns}>
            <line x1={x(kOf(ns))} x2={x(kOf(ns))} y1={H - 30} y2={H - 26} stroke="var(--faint)" />
            <text x={x(kOf(ns))} y={H - 15} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
              {ns >= 1000 ? `${ns / 1000}µs` : `${ns}ns`}
            </text>
          </g>
        ))}
        {MARKS.map((v) => {
          const on = v.id === mark;
          const color = v.tone === "ink" ? "var(--ink)" : `var(--${v.tone})`;
          return (
            <line
              key={v.id}
              x1={x(kOf(v.ns))}
              x2={x(kOf(v.ns))}
              y1={14}
              y2={H - 30}
              stroke={on ? color : "var(--line-2)"}
              strokeWidth={on ? 1.5 : 1}
              strokeDasharray={on ? undefined : "3 3"}
            />
          );
        })}
        <text x={x(kOf(m.ns)) + (m.id === "max" ? -4 : 4)} y={12} textAnchor={m.id === "max" ? "end" : "start"} fontSize={11} fill={m.tone === "ink" ? "var(--hi)" : `var(--${m.tone})`} fontFamily="var(--font-code)">
          {m.label}
        </text>
      </svg>
      </div>
      <div className="mt-1 text-11 text-faint">x: latency, log scale. y: how many requests, log scale.</div>

      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="statistic">
        {MARKS.map((v) => (
          <button key={v.id} className="word" aria-pressed={mark === v.id} onClick={() => setMark(v.id)}>
            {v.label}{" "}
            <span className="text-faint">{v.ns >= 10000 ? `${(v.ns / 1000).toFixed(0)}µs` : `${v.ns}ns`}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {m.note}
      </p>
    </div>
  );
}
