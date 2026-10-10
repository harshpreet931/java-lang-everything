"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { ring, tint } from "../functional/kit";

// a piece of code changing shape, one step at a time. each step is a full snapshot;
// `marks` are the lines that changed (1-based), drawn with the hot bar. an optional
// verdict says what javac (or the launcher) makes of this step.

export type MorphStep = {
  title: string;
  note: string;
  marks?: number[];
  /** lines to fade: things that are implied, not written */
  faint?: number[];
  verdict?: { ok: boolean; text: string };
  /** a file name for this step, if it differs from the figure's */
  file?: string;
};

export function MorphClient({ steps, lines, file }: { steps: MorphStep[]; lines: string[][]; file: string }) {
  const s = useStepper(steps.length, { interval: 2800 });
  const st = steps[s.i];
  const code = lines[s.i];
  return (
    <div {...s.keys} className="@container outline-none">
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="steps">
        {steps.map((x, i) => (
          <button key={i} role="tab" aria-selected={s.i === i} className="word" onClick={() => s.go(i)}>
            {i + 1}. {x.title}
          </button>
        ))}
      </div>
      <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
          <span className="text-ink">{st.file ?? file}</span>
          <span className="flex items-center gap-2 text-11 text-faint">
            <span className="inline-block h-2.5 w-[2px] bg-hot" /> changed
          </span>
        </div>
        <div className="overflow-x-auto py-2.5">
          <ol className="min-w-max text-12 leading-[1.8] @[560px]:text-13">
            {code.map((html, i) => {
              const hot = st.marks?.includes(i + 1);
              const faint = st.faint?.includes(i + 1);
              return (
                <li
                  key={`${s.i}-${i}`}
                  className={`obj-in grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 ${
                    hot ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent"
                  }`}
                  style={{ opacity: faint ? 0.45 : 1 }}
                >
                  <span className={`text-right tabular ${hot ? "text-hot" : "text-faint/60"}`}>{i + 1}</span>
                  <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html || " " }} />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {st.verdict && (
        <div
          className="mt-3 overflow-x-auto rounded-md px-4 py-2.5 text-12 leading-[1.7] whitespace-pre"
          style={{ boxShadow: ring(st.verdict.ok ? "live" : "dead", 55), background: tint(st.verdict.ok ? "live" : "dead", 6), color: st.verdict.ok ? "var(--live)" : "var(--dead)" }}
          aria-live="polite"
        >
          {st.verdict.text}
        </div>
      )}
      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
