"use client";

import { useState } from "react";
import { Row, Words, useWidth } from "../meta/kit";

// safepoint bias, as a model (not a measurement). one thread spends 20% of its time in
// parse(), 50% in sum() (a compiled loop with no safepoint poll inside, like a counted
// loop with polls removed, or an intrinsic stub), and 30% in format() (lots of calls,
// lots of polls). a sampler fires every 5% of the time. a safepoint-biased sampler can only
// take the stack at the next poll; an unbiased one records where the thread really was.

const rnd = (n: number) => Math.round(n * 100) / 100;

const SEGS = [
  { name: "parse()", from: 0, to: 20, polls: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], tone: "var(--ink)" },
  { name: "sum()", from: 20, to: 70, polls: [70], tone: "var(--ref)" },
  { name: "format()", from: 70, to: 100, polls: [72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100], tone: "var(--meta)" },
];
const ALL_POLLS = SEGS.flatMap((s) => s.polls);
const TICKS = Array.from({ length: 20 }, (_, i) => 2.5 + i * 5);

const segAt = (t: number) => SEGS.find((s) => t >= s.from && t < s.to) ?? SEGS[SEGS.length - 1];
// a poll at the very end of a segment belongs to the code that runs next (the return lands in the caller)
const recordedAt = (t: number) => {
  const p = ALL_POLLS.find((q) => q >= t) ?? 100;
  return p === 70 ? 70.01 : p;
};

export function SafepointBias() {
  const [mode, setMode] = useState<"anywhere" | "safepoint">("safepoint");
  const [box, W] = useWidth<HTMLDivElement>(640);
  const L = 10;
  const span = W - 20;
  const x = (t: number) => rnd(L + (t / 100) * span);

  const counts = SEGS.map((s) => ({
    name: s.name,
    tone: s.tone,
    truth: s.to - s.from,
    got: TICKS.filter((t) => segAt(mode === "anywhere" ? t : recordedAt(t)).name === s.name).length * 5,
  }));

  return (
    <div className="@container">
      <Row k="sampler =" w="10ch">
        <Words
          options={[
            { v: "safepoint", label: "waits for a safepoint" },
            { v: "anywhere", label: "samples anywhere" },
          ]}
          value={mode}
          onChange={setMode}
          label="sampler"
        />
      </Row>
      <div ref={box} className="mt-4">
        <svg viewBox={`0 0 ${W} 120`} width={W} height={120} className="block max-w-full" role="img" aria-label="one thread over time, with sampler ticks and where each sample is recorded">
          {SEGS.map((s) => (
            <g key={s.name}>
              <rect x={x(s.from)} y={50} width={rnd(x(s.to) - x(s.from) - 1)} height={22} rx={3} fill={s.tone} opacity={0.18} />
              <text x={rnd((x(s.from) + x(s.to)) / 2)} y={65} textAnchor="middle" fontSize={11} fill={s.tone} fontFamily="var(--font-code)">
                {s.name}
              </text>
              {s.polls.map((p) => (
                <line key={p} x1={x(p)} x2={x(p)} y1={72} y2={80} stroke="var(--mute)" strokeWidth={1} />
              ))}
            </g>
          ))}
          {TICKS.map((t, i) => {
            const r = mode === "anywhere" ? t : recordedAt(t);
            return (
              <g key={i}>
                <line x1={x(t)} x2={x(t)} y1={18} y2={46} stroke="var(--hot)" strokeWidth={1} />
                {mode === "safepoint" && Math.abs(r - t) > 0.6 && (
                  <path d={`M ${x(t)} 46 Q ${x(t)} 40 ${rnd((x(t) + x(r)) / 2)} 38 Q ${x(r)} 36 ${x(r)} 46`} fill="none" stroke="var(--dead)" strokeWidth={1} opacity={0.6} />
                )}
                <circle cx={x(r)} cy={46} r={2.5} fill={mode === "safepoint" && Math.abs(r - t) > 0.6 ? "var(--dead)" : "var(--hot)"} />
              </g>
            );
          })}
          <text x={L} y={12} fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            sampler ticks (every 5% of the time)
          </text>
          <text x={L} y={96} fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            ticks below the bar: safepoint polls
          </text>
          <text x={W - 10} y={112} textAnchor="end" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            time →
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-12">
        {counts.map((c) => (
          <div key={c.name} className="grid grid-cols-[9ch_minmax(0,1fr)_11ch] items-center gap-3">
            <span style={{ color: c.tone }}>{c.name}</span>
            <div className="relative h-[12px] rounded-[2px] bg-well-2">
              <div className="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-300 ease-jle" style={{ width: `${c.got}%`, background: c.tone, opacity: 0.75 }} />
              <div className="absolute inset-y-[-3px] w-[2px] bg-live" style={{ left: `${c.truth}%` }} title="true share" />
            </div>
            <span className="text-right text-mute tabular">
              {c.got}% <span className="text-faint">/ {c.truth}%</span>
            </span>
          </div>
        ))}
        <div className="text-11 text-faint">
          bar: what the profile reports. <span className="text-live">green mark</span>: the true share of time.
        </div>
      </div>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {mode === "safepoint"
          ? "sum() has no poll inside, so every sample that lands in it has to wait until the loop ends, and gets recorded in format(). the profile says sum() costs nothing and format() is the problem. you'd optimize the wrong method."
          : "an unbiased sampler records the instruction the thread was actually on. ten samples land in sum(), and the profile matches reality to within the sampling noise."}
      </p>
    </div>
  );
}
