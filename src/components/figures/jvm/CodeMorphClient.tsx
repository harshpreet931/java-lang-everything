"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";

// a piece of code changing shape, one optimization at a time. each step is a full
// snapshot; `marks` are the lines that changed (1-based), drawn with the hot bar.
// the code is "the java equivalent of what the compiler did", not real compiler output.

export type MorphStep = {
  title: string;
  note: string;
  marks?: number[];
  stats?: { label: string; value: string; tone?: "live" | "dead" | "hot" }[];
};

export function CodeMorphClient({ steps, lines, file }: { steps: MorphStep[]; lines: string[][]; file: string }) {
  const s = useStepper(steps.length, { interval: 2600 });
  const st = steps[s.i];
  const code = lines[s.i];
  return (
    <div {...s.keys} className="@container outline-none">
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="optimization steps">
        {steps.map((x, i) => (
          <button key={i} role="tab" aria-selected={s.i === i} className="word" onClick={() => s.go(i)}>
            {i}. {x.title}
          </button>
        ))}
      </div>
      <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1fr)_200px]">
        <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
            <span className="text-ink">{file}</span>
            <span className="flex items-center gap-2 text-11 text-faint">
              <span className="inline-block h-2.5 w-[2px] bg-hot" /> changed
            </span>
          </div>
          <div className="overflow-x-auto py-2.5">
            <ol className="min-w-max text-12 leading-[1.8]">
              {code.map((html, i) => {
                const hot = st.marks?.includes(i + 1);
                return (
                  <li
                    key={`${s.i}-${i}`}
                    className={`obj-in grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 ${
                      hot ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent"
                    }`}
                  >
                    <span className={`text-right tabular ${hot ? "text-hot" : "text-faint/60"}`}>{i + 1}</span>
                    <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html || " " }} />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        {st.stats && (
          <div className="grid grid-cols-3 gap-1.5 self-start @[640px]:grid-cols-1">
            <div className="col-span-3 mb-0.5 text-11 text-faint @[640px]:col-span-1">per call</div>
            {st.stats.map((x) => (
              <div key={x.label} className="flex flex-col gap-0.5 rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)] @[640px]:flex-row @[640px]:items-baseline @[640px]:justify-between @[640px]:gap-3">
                <span className="text-mute">{x.label}</span>
                <span className="tabular" style={{ color: x.tone ? `var(--${x.tone})` : "var(--hi)" }}>
                  {x.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
