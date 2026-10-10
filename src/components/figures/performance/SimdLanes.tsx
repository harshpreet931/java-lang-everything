"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "../meta/kit";

// c[i] = a[i] * b[i] + c[i] over 18 floats, one element per instruction (scalar) or one
// vector register per instruction (SIMD). species widths are the Vector API's shapes; on
// the apple M4 Pro, FloatVector.SPECIES_PREFERRED printed Species[float, 4, S_128_BIT].

const N = 18;
const A = Array.from({ length: N }, (_, i) => i);
const B = Array.from({ length: N }, () => 2);
const C0 = Array.from({ length: N }, () => 1);

type Mode = "scalar" | "64" | "128" | "256" | "512";
const LANES: Record<Mode, number> = { scalar: 1, "64": 2, "128": 4, "256": 8, "512": 16 };

function plan(lanes: number) {
  // steps: each step covers [from, to). vector steps first, then a scalar tail.
  const steps: { from: number; to: number; tail: boolean }[] = [];
  const bound = lanes === 1 ? 0 : Math.floor(N / lanes) * lanes;
  for (let i = 0; i < bound; i += lanes) steps.push({ from: i, to: i + lanes, tail: false });
  for (let i = bound; i < N; i++) steps.push({ from: i, to: i + 1, tail: lanes > 1 });
  return steps;
}

export function SimdLanes() {
  const [mode, setMode] = useState<Mode>("128");
  const lanes = LANES[mode];
  const steps = plan(lanes);
  const s = useStepper(steps.length + 1, { interval: 700 });
  const { reset } = s;
  useEffect(() => reset(), [mode, reset]);
  const done = s.i; // number of completed steps
  const cur = done < steps.length ? steps[done] : null;
  const doneUpTo = done === 0 ? 0 : steps[done - 1].to;

  const cell = (v: number, i: number, row: "a" | "b" | "c") => {
    const inCur = cur && i >= cur.from && i < cur.to;
    const finished = row === "c" && i < doneUpTo;
    const value = row === "c" ? (finished ? A[i] * B[i] + C0[i] : C0[i]) : v;
    return (
      <span
        key={i}
        className="flex h-7 items-center justify-center rounded-[3px] text-[10px] tabular transition-[background-color,box-shadow,color] duration-150 @[520px]:text-11"
        style={{
          background: inCur ? (cur!.tail ? "color-mix(in srgb, var(--meta) 22%, transparent)" : "color-mix(in srgb, var(--hot) 26%, transparent)") : finished ? "color-mix(in srgb, var(--live) 14%, transparent)" : "var(--well-2)",
          boxShadow: `inset 0 0 0 1px ${inCur ? (cur!.tail ? "var(--meta)" : "var(--hot)") : "var(--line)"}`,
          color: finished ? "var(--live)" : "var(--ink)",
        }}
      >
        {value}
      </span>
    );
  };

  const vectorSteps = steps.filter((x) => !x.tail && lanes > 1).length;
  const tailSteps = steps.filter((x) => x.tail).length;

  return (
    <div {...s.keys} className="@container outline-none">
      <Row k="register =" w="10ch">
        <Words
          options={[
            { v: "scalar", label: "scalar" },
            { v: "64", label: "64-bit" },
            { v: "128", label: "128-bit (this mac)" },
            { v: "256", label: "256-bit" },
            { v: "512", label: "512-bit" },
          ]}
          value={mode}
          onChange={setMode}
          label="vector width"
        />
      </Row>
      <div className="mt-4 flex flex-col gap-1.5">
        {(["a", "b", "c"] as const).map((row) => (
          <div key={row} className="grid grid-cols-[2.5ch_minmax(0,1fr)] items-center gap-2">
            <span className="text-12 text-faint">{row}</span>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
              {(row === "a" ? A : row === "b" ? B : C0).map((v, i) => cell(v, i, row))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-12 tabular">
        <span>
          <span className="text-faint">lanes per instruction </span>
          <span className="text-hi">{lanes}</span>
        </span>
        <span>
          <span className="text-faint">instructions for 18 elements </span>
          <span className="text-hi">{steps.length}</span>
          {lanes > 1 && (
            <span className="text-faint">
              {" "}
              ({vectorSteps} vector{tailSteps ? ` + ${tailSteps} scalar tail` : ""})
            </span>
          )}
        </span>
      </div>
      <p className="mt-3 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {done >= steps.length
          ? `done: c = a × b + c, in ${steps.length} ${steps.length === 1 ? "instruction" : "instructions"} instead of 18.`
          : cur!.tail
            ? "the tail: what's left doesn't fill a whole register, so it's done one element at a time (loopBound in the code below)."
            : lanes === 1
              ? `one multiply-add for element ${cur!.from}.`
              : `one fused multiply-add for elements ${cur!.from} to ${cur!.to - 1}: ${lanes} lanes at once.`}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
