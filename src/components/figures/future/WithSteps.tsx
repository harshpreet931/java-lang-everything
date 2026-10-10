"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java } from "@/components/figures/deep-dives/kit";

// derived record creation (JEP 468, a candidate since 2023, last updated april 2024), step by
// step, the way the JEP describes it: deconstruct the record into locals, run the block on
// those locals, call the canonical constructor with them. illustrative: no JDK has it.

type Step = { code: string; locals: Record<string, string>; changed?: string; out?: string; note: string };

const STEPS: Step[] = [
  {
    code: "Point next = loc with { x = 0; };",
    locals: {},
    note: "the whole thing is one expression: start from an existing record, list only what changes. loc is Point[x=3, y=4, z=5].",
  },
  {
    code: "int x = loc.x(); int y = loc.y(); int z = loc.z();",
    locals: { x: "3", y: "4", z: "5" },
    note: "first, the compiler deconstructs loc into one local per component, named after the components, through the accessors.",
  },
  {
    code: "x = 0;",
    locals: { x: "0", y: "4", z: "5" },
    changed: "x",
    note: "then your block runs on those locals. it's ordinary code: assignments, ifs, even calls. here it just sets x.",
  },
  {
    code: "next = new Point(x, y, z);",
    locals: { x: "0", y: "4", z: "5" },
    out: "Point[x=0, y=4, z=5]",
    note: "finally the canonical constructor builds the new record from the locals, so its validation runs exactly as if you'd called new Point(0, 4, 5) yourself. loc is untouched.",
  },
];

export function WithSteps() {
  const s = useStepper(STEPS.length, { interval: 2400 });
  const st = STEPS[s.i];
  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="how a with expression is evaluated">
      <div className="rounded-md bg-bg px-3 py-2.5 text-13 shadow-[inset_0_0_0_1px_var(--line)] [overflow-wrap:anywhere]">
        <span className="mr-2 text-11 text-faint">{s.i === 0 ? "you write" : "the compiler does"}</span>
        <Java code={st.code} />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-12">
        <span className="text-faint">loc</span>
        <span className="text-ink">Point[x=3, y=4, z=5]</span>
        <span className="text-faint">locals</span>
        <span className="flex min-h-[22px] flex-wrap gap-1.5">
          {Object.keys(st.locals).length === 0 && <span className="text-faint">none yet</span>}
          {Object.entries(st.locals).map(([k, v]) => (
            <span
              key={k}
              className="rounded-[3px] px-1.5 tabular transition-colors duration-200"
              style={{
                color: st.changed === k ? "var(--hot)" : "var(--ink)",
                boxShadow: `inset 0 0 0 1px ${st.changed === k ? "var(--hot)" : "var(--line-2)"}`,
              }}
            >
              {k} = {v}
            </span>
          ))}
        </span>
        <span className="text-faint">next</span>
        <span style={{ color: st.out ? "var(--live)" : "var(--faint)" }}>{st.out ?? "not built yet"}</span>
      </div>
      <p className="min-h-[3.3em] font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} />
    </div>
  );
}
