"use client";

import { useEffect, useRef, useState } from "react";

// a method warming up, measured. Warmup.java calls digitSum(123_456_789 + i) in
// batches of 100 and times each batch with System.nanoTime(), on jdk 25
// (temurin 25.0.4.1, M4 Pro). this is one representative run of five; across runs
// C1 code arrived after 900-1,100 calls and C2 code after 14,300-15,600.
// the "queued" points come from a run with -XX:+LogCompilation (task_queued count=).

const NS = [
  78.8, 70.8, 131.7, 93.3, 115.8, 99.6, 94.6, 70.4, 21.7, 21.3, 23.3, 20.4, 21.3, 24.2, 22.1, 20.8, 20.8, 20.4, 21.7, 20.8, 21.7, 20.8, 41.7, 26.7, 26.3,
  27.1, 26.3, 25.8, 26.7, 24.2, 23.3, 22.9, 22.1, 22.1, 20.4, 21.3, 20.8, 20.4, 20.0, 20.4, 22.9, 20.4, 20.4, 20.4, 21.7, 23.3, 23.3, 22.9, 22.5, 24.2, 26.7,
  22.5, 23.3, 22.1, 22.9, 23.8, 22.5, 23.3, 22.5, 23.8, 23.8, 22.5, 26.3, 24.2, 24.2, 25.4, 23.3, 22.1, 23.8, 22.5, 25.0, 22.1, 22.1, 22.5, 23.3, 22.5, 23.3,
  23.3, 22.1, 22.9, 22.9, 24.6, 22.5, 22.5, 22.9, 22.9, 25.0, 22.9, 22.5, 22.9, 22.1, 24.6, 23.3, 22.9, 22.9, 24.2, 24.2, 22.5, 22.9, 22.9, 22.1, 24.2, 22.9,
  22.9, 23.8, 22.1, 23.3, 22.5, 22.5, 22.1, 22.5, 23.3, 23.8, 23.8, 22.5, 22.5, 22.5, 23.8, 23.3, 22.9, 22.5, 23.8, 24.2, 22.9, 22.1, 22.5, 22.5, 23.3, 22.5,
  23.3, 22.1, 25.8, 22.9, 22.9, 22.9, 22.9, 22.9, 23.8, 22.5, 22.9, 22.9, 25.4, 22.9, 22.1, 22.5, 22.9, 22.9, 28.8, 16.7, 17.1, 16.7, 16.7, 17.5, 17.1, 16.7,
  17.1, 17.1, 16.7, 17.5, 16.7, 16.3, 17.1, 18.8, 17.1, 17.1, 17.1, 16.7, 17.1, 17.1, 17.1, 17.1, 16.7, 17.9, 16.7, 17.5, 16.7, 16.7, 15.0, 15.4, 15.4, 15.4,
  15.8, 17.9, 17.1, 17.1, 17.1, 16.7, 17.1, 16.7, 17.1, 17.1, 17.1, 18.3, 17.1, 17.1, 16.7, 16.7, 16.7, 17.5, 16.7, 16.3, 17.1, 18.3, 16.7, 17.1, 16.7, 16.7,
  16.7, 17.1, 17.1, 16.7, 16.7, 17.9, 16.7, 16.7, 17.1, 16.7, 17.5, 17.5, 16.7, 16.7, 17.1, 17.1, 17.5, 17.1, 17.1, 16.3, 17.1, 16.7, 16.3, 16.3, 16.7, 17.1,
  17.9, 17.1, 16.7, 17.1, 17.1, 16.3, 17.1, 16.7, 16.7, 16.7, 18.3, 16.7, 16.7, 15.8, 16.7, 16.7, 17.1, 16.7, 17.5, 16.7, 18.3, 16.7, 16.7, 17.1, 17.1, 17.1,
  16.7, 17.1, 17.1, 16.3, 17.9, 17.1, 17.1, 16.7, 16.3, 17.1, 17.5, 16.7, 15.8, 16.7, 18.3, 16.7, 16.7, 17.1, 17.1, 16.7, 17.1, 16.7, 17.1, 17.1, 18.3, 16.7,
  17.1, 16.3, 17.1, 16.3, 16.3, 16.7, 17.1, 16.7, 17.1, 18.3, 16.7, 16.7, 16.7, 16.7, 17.1,
];
const BATCH = 100;
const MAX = NS.length * BATCH; // 30,000 calls
const C1_AT = 900;
const C2_AT = 14_900;
const Q3_AT = 256;
const Q4_AT = 2_276;

const RUNGS = [
  { level: 4, name: "C2", what: "optimized, using the profile" },
  { level: 3, name: "C1", what: "full profiling: types, branches" },
  { level: 2, name: "C1", what: "counters only (C2 queue is long)" },
  { level: 1, name: "C1", what: "no profiling (trivial methods)" },
  { level: 0, name: "interpreter", what: "counts calls and loop back-edges" },
];

function phase(calls: number) {
  if (calls < Q3_AT)
    return { tier: 0, queued: null as number | null, note: "every call runs in the interpreter, which bumps the method's invocation counter (and the back-edge counter on every loop iteration: 9 per call here)." };
  if (calls < C1_AT)
    return { tier: 0, queued: 3, note: "the interpreter only reports to the compile policy every 128 calls. at 256, the count is past Tier3InvocationThreshold (200): queued for C1 at tier 3. the interpreter keeps going while C1 works in the background." };
  if (calls < Q4_AT)
    return { tier: 3, queued: null, note: "C1's code is installed: roughly 80 ns per call becomes about 22. tier 3 code keeps counting, and now also records a profile: which branches go which way, which classes show up." };
  if (calls < C2_AT)
    return { tier: 3, queued: 4, note: "the tier 3 counters pass the tier 4 thresholds (in a logged run the method was queued at 2,276 calls). C2 is much slower to compile, so the method runs in profiled C1 code for thousands more calls." };
  return { tier: 4, queued: null, note: "C2's code is installed: about 17 ns. the tier 3 version is thrown away (PrintCompilation says made not entrant: not used). steady state, until something invalidates C2's assumptions." };
}

export function TierMeter() {
  const [calls, setCalls] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCalls(MAX);
      setPlaying(false);
      return;
    }
    const start = performance.now();
    const from = calls >= MAX ? 0 : calls;
    const tick = (t: number) => {
      // slow at first so the interpreter phase is visible, then faster
      const p = Math.min(1, (t - start) / 7000);
      const next = Math.round(from + (MAX - from) * (p * p * 0.85 + p * 0.15));
      setCalls(Math.round(next / BATCH) * BATCH);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const ph = phase(calls);
  const idx = Math.min(NS.length - 1, Math.max(0, Math.floor(calls / BATCH) - 1));
  const cost = calls === 0 ? null : NS[idx];

  // chart geometry (viewBox units)
  const W = 600;
  const H = 180;
  const yMax = 100;
  const x = (c: number) => (c / MAX) * W;
  const y = (v: number) => H - (Math.min(v, yMax) / yMax) * H;
  const pts = NS.map((v, i) => `${x((i + 1) * BATCH).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const shown = NS.slice(0, Math.max(0, Math.floor(calls / BATCH)))
    .map((v, i) => `${x((i + 1) * BATCH).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

  return (
    <div className="@container">
      <div className="grid gap-6 @[620px]:grid-cols-[230px_minmax(0,1fr)]">
        {/* the ladder */}
        <div className="flex flex-col gap-1.5" aria-label={`digitSum is at tier ${ph.tier}`}>
          <div className="mb-1 text-11 text-faint">digitSum(int) · tier</div>
          {RUNGS.map((r) => {
            const here = ph.tier === r.level;
            const next = ph.queued === r.level;
            const passed = r.level < ph.tier && (r.level === 0 || r.level === 3);
            const skipped = r.level === 1 || r.level === 2;
            return (
              <div
                key={r.level}
                className="grid grid-cols-[2ch_minmax(0,1fr)] items-center gap-2 rounded-md px-2.5 py-1.5 transition-[box-shadow,background-color] duration-200"
                style={{
                  boxShadow: `inset 0 0 0 1px ${here ? "var(--hot)" : next ? "var(--line-2)" : "var(--line)"}`,
                  background: here ? "color-mix(in srgb, var(--hot) 12%, transparent)" : "transparent",
                  opacity: skipped && !here ? 0.5 : 1,
                }}
              >
                <span className={`text-15 tabular ${here ? "text-hot" : passed ? "text-mute" : "text-faint"}`}>{r.level}</span>
                <span className="min-w-0">
                  <span className={`block text-12 ${here ? "text-hi" : "text-ink"}`}>
                    {r.name}
                    {next && <span className="ml-2 text-11 text-hot">queued ↑</span>}
                  </span>
                  <span className="block text-11 leading-snug text-faint">{r.what}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* the measured curve */}
        <div className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between text-11 text-faint">
            <span>ns per call, measured</span>
            <span className="tabular">
              {cost === null ? "·" : <span className="text-hi">{cost.toFixed(1)} ns</span>}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label="nanoseconds per call over the first 30,000 calls: about 80 interpreted, about 22 after C1, about 17 after C2">
            <rect x={0} y={0} width={x(C1_AT)} height={H} fill="var(--well-2)" />
            <rect x={x(C2_AT)} y={0} width={W - x(C2_AT)} height={H} fill="var(--well-2)" />
            {[25, 50, 75].map((g) => (
              <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <polyline points={pts} fill="none" stroke="var(--line-2)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
            {shown && <polyline points={shown} fill="none" stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
            <line x1={x(calls)} x2={x(calls)} y1={0} y2={H} stroke="var(--hot)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="relative mt-1 h-4 text-[10px] text-faint">
            <span className="absolute left-0">0</span>
            <span className="absolute" style={{ left: `${(C1_AT / MAX) * 100}%` }}>
              ↑C1
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: `${(C2_AT / MAX) * 100}%` }}>
              ↑C2
            </span>
            <span className="absolute right-0">30,000 calls</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-mute">
            <span>interpreted ~80 ns</span>
            <span>C1, tier 3 ~22 ns</span>
            <span>C2, tier 4 ~17 ns</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-3 border-y border-line py-2.5 text-13">
        <span className="text-faint">calls =</span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={0}
            max={MAX}
            step={BATCH}
            value={calls}
            onChange={(e) => (setPlaying(false), setCalls(Number(e.target.value)))}
            aria-label="number of calls so far"
          />
          <span className="w-[7ch] text-right text-hi tabular">{calls.toLocaleString("en-US")}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 py-3">
        <button className="act solid" onClick={() => setPlaying(true)} disabled={playing}>
          {calls >= MAX ? "replay" : "warm it up"}
        </button>
        <button className="act" onClick={() => (setPlaying(false), setCalls(0))}>
          reset
        </button>
        <span className="ml-auto text-12 text-faint tabular">
          i = {calls.toLocaleString("en-US")} · b ≈ {(calls * 9).toLocaleString("en-US")}
        </span>
      </div>
      <p className="min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {ph.note}
      </p>
    </div>
  );
}
