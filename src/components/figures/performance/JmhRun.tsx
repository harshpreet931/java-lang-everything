"use client";

import { useState } from "react";

// one real JMH run, cell by cell: Warm.groupByLength with -f 3 -wi 8 -w 100ms -i 5 -r 100ms
// on jdk 25 (apple M4 Pro). every number is from the run log. JMH's result line was
// "Warm.groupByLength  avgt  15  41.585 ± 0.735  us/op".

const RUN = [
  { warm: [45.36, 43.967, 41.942, 42.677, 41.57, 41.637, 41.067, 41.378], meas: [42.059, 41.649, 41.011, 41.347, 41.067] },
  { warm: [45.827, 39.297, 41.394, 40.974, 42.65, 41.053, 41.491, 41.273], meas: [40.363, 43.254, 42.072, 41.69, 42.307] },
  { warm: [44.034, 40.333, 42.931, 44.901, 43.952, 42.686, 41.641, 41.157], meas: [41.702, 41.138, 40.988, 41.318, 41.814] },
];

type Sel = { f: number; kind: "warm" | "meas"; i: number } | null;

export function JmhRun() {
  const [sel, setSel] = useState<Sel>(null);
  const v = sel ? RUN[sel.f][sel.kind][sel.i] : null;

  const note = !sel
    ? "click any iteration. JMH started three separate JVMs (forks). in each one it ran the method nonstop for 100 ms, eight times, and threw those numbers away, then did it five more times for real."
    : sel.kind === "warm"
      ? `fork ${sel.f + 1}, warmup iteration ${sel.i + 1}: ${v!.toFixed(3)} µs/op. warmup results are printed and then ignored. their job is to let class loading, the JIT and the caches settle before anything counts.`
      : `fork ${sel.f + 1}, measurement iteration ${sel.i + 1}: ${v!.toFixed(3)} µs/op. one of the 15 numbers (3 forks × 5) that make up the score. each is an average over 100 ms of back-to-back calls.`;

  return (
    <div className="@container">
      <div className="flex flex-col gap-2">
        {RUN.map((f, fi) => (
          <div key={fi} className="rounded-md bg-well px-3 py-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="mb-1.5 flex items-baseline justify-between text-11">
              <span className="text-meta">fork {fi + 1}: a fresh JVM</span>
              <span className="text-faint">java -cp … (forked by JMH)</span>
            </div>
            <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[3px]">
              {f.warm.map((x, i) => {
                const on = sel?.f === fi && sel.kind === "warm" && sel.i === i;
                return (
                  <button
                    key={`w${i}`}
                    onClick={() => setSel({ f: fi, kind: "warm", i })}
                    aria-label={`fork ${fi + 1} warmup ${i + 1}: ${x} microseconds`}
                    className="h-7 rounded-[3px] text-[9px] text-faint transition-[box-shadow] duration-150 @[520px]:text-[10px]"
                    style={{ background: "var(--well-2)", boxShadow: on ? "inset 0 0 0 1.5px var(--hot)" : "inset 0 0 0 1px var(--line-2)" }}
                  >
                    <span className="hidden @[620px]:inline">{x.toFixed(1)}</span>
                  </button>
                );
              })}
              {f.meas.map((x, i) => {
                const on = sel?.f === fi && sel.kind === "meas" && sel.i === i;
                return (
                  <button
                    key={`m${i}`}
                    onClick={() => setSel({ f: fi, kind: "meas", i })}
                    aria-label={`fork ${fi + 1} measurement ${i + 1}: ${x} microseconds`}
                    className="h-7 rounded-[3px] text-[9px] transition-[box-shadow] duration-150 @[520px]:text-[10px]"
                    style={{ background: "var(--ink)", color: "var(--bg)", boxShadow: on ? "0 0 0 1.5px var(--hot)" : undefined }}
                  >
                    <span className="hidden @[620px]:inline">{x.toFixed(1)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-mute">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-well-2 shadow-[inset_0_0_0_1px_var(--line-2)]" /> warmup (-wi 8, thrown away)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-ink" /> measurement (-i 5, counted)
        </span>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-well px-3 py-2 text-12 leading-[1.6] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">Benchmark            Mode  Cnt   Score   Error  Units{"\n"}</span>
        Warm.groupByLength   avgt   15  <span className="text-live">41.585</span> ± 0.735  us/op
      </pre>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
