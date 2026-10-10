"use client";

import { useMemo } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { timSteps } from "./javaSort";

// TimSort, scaled down: find natural runs, reverse descending ones, extend short ones with
// binary insertion, push them on a stack, merge whenever the stack's balance rules break.
// the run-finding and the mergeCollapse rules are java's (TimSort.java, jdk 25); minRun is 4
// instead of 16..32 so a 24-element array actually merges.

const INPUT = [3, 8, 12, 15, 21, 9, 7, 4, 2, 5, 6, 30, 1, 11, 14, 17, 25, 28, 20, 18, 13, 10, 16, 24];

export function TimSortRuns() {
  const steps = useMemo(() => timSteps(INPUT, 4), []);
  const s = useStepper(steps.length, { interval: 1600 });
  const st = steps[s.i];
  const max = Math.max(...INPUT);
  const n = INPUT.length;
  const W = 600;
  const H = 150;
  const bw = W / n;
  const inHot = (i: number) => st.hot !== null && i >= st.hot[0] && i < st.hot[1];
  const runOf = (i: number) => st.stack.findIndex((r) => i >= r.base && i < r.base + r.len);
  const kindTone = st.kind === "merge" || st.kind === "done" ? "var(--live)" : "var(--hot)";

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-5 outline-none" aria-label="timsort, step by step">
      <svg viewBox={`0 0 ${W} ${H + 46}`} fontFamily="var(--font-code)" className="block w-full" role="img" aria-label={`the array: ${st.a.join(" ")}`}>
        {st.a.map((v, i) => {
          const h = (v / max) * H;
          const hot = inHot(i);
          return (
            <g key={i}>
              <rect
                x={i * bw + 2}
                y={H - h}
                width={bw - 4}
                height={h}
                rx={2}
                fill={hot ? kindTone : runOf(i) >= 0 ? "var(--mute)" : "var(--line-2)"}
                style={{ transition: "y 260ms var(--ease), height 260ms var(--ease), fill 200ms var(--ease)" }}
              />
              <text x={i * bw + bw / 2} y={H + 13} textAnchor="middle" fontSize={9} fill={hot ? kindTone : "var(--faint)"}>
                {v}
              </text>
            </g>
          );
        })}
        {/* runs on the stack, bracketed under the bars */}
        {st.stack.map((r, k) => (
          <g key={`${r.base}-${r.len}`}>
            <path
              d={`M${r.base * bw + 3} ${H + 21} V ${H + 27} H ${(r.base + r.len) * bw - 3} V ${H + 21}`}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1}
            />
            <text x={(r.base + r.len / 2) * bw} y={H + 41} textAnchor="middle" fontSize={10} fill="var(--ink)">
              run {k} · {r.len}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-12 text-mute">
        <span>
          run stack <span className="text-faint">(bottom → top)</span>:{" "}
          <span className="text-hi tabular">{st.stack.length ? st.stack.map((r) => r.len).join(" · ") : "empty"}</span>
        </span>
        <span className="text-faint">
          rules: each run longer than the one above it, and longer than the two above it combined
        </span>
      </div>

      <div className="grid gap-3">
        <p className="min-h-[3.4em] font-serif text-16 leading-[1.55] text-ink" aria-live="polite">
          <span className="mr-2 font-mono text-11" style={{ color: kindTone }}>
            {st.kind === "start" ? "" : st.kind}
          </span>
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
