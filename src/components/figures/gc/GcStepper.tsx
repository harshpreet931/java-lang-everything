"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import type { Frame } from "./heap";
import { HeapStrip, type StripLayout } from "./HeapStrip";
import { Legend, Readout, useWidth, type Tone } from "./kit";

// plays a list of heap.ts frames: one or two heap strips, the mark stack, a note, controls.

export function GcStepper({
  frames,
  layout,
  id,
  legend,
  interval = 1700,
}: {
  frames: Frame[];
  layout: StripLayout;
  id: string;
  legend?: [Tone | "mute", string][];
  interval?: number;
}) {
  const s = useStepper(frames.length, { interval });
  const [ref, w] = useWidth();
  const f = frames[Math.min(s.i, frames.length - 1)];
  const showStack = frames.some((x) => x.stack !== undefined);

  return (
    <div {...s.keys} className="outline-none" aria-label="garbage collector step-through">
      <div ref={ref} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        {f.views.map((v, i) => (
          <HeapStrip key={i} view={v} layout={layout} width={w} id={`${id}-${i}`} />
        ))}
      </div>

      {showStack && (
        <div className="mt-2 flex min-h-7 flex-wrap items-center gap-1.5 text-11">
          <span className="mr-1 text-faint">mark stack</span>
          {f.stack && f.stack.length ? (
            f.stack.map((x, i) => (
              <span
                key={`${x}-${i}`}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-xs px-1.5 text-12 text-hot"
                style={{ boxShadow: "inset 0 0 0 1px var(--hot)" }}
              >
                {x}
              </span>
            ))
          ) : (
            <span className="text-faint">empty</span>
          )}
          {f.stack && f.stack.length > 1 && <span className="text-faint">← top</span>}
        </div>
      )}

      <Readout className="mt-3" minLines={3}>
        {f.note}
      </Readout>
      {legend && <Legend items={legend} className="mt-2" />}
      <StepControls s={s} className="mt-4" />
    </div>
  );
}
