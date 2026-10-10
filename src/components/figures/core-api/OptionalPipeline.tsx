"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Narr } from "./kit";

// raw.map(String::strip).filter(s -> !s.isEmpty()).map(String::toUpperCase).orElse("ANONYMOUS")
// outputs checked on jdk 25: "  ada  " → ADA, "   " → ANONYMOUS, empty → ANONYMOUS.

type Input = "ada" | "blank" | "empty";

type Stage = { code: string; value: string | null; called: boolean | null; final?: boolean; note: string };

const SOURCE: Record<Input, { code: string; v: string | null }> = {
  ada: { code: 'Optional.of("  ada  ")', v: "  ada  " },
  blank: { code: 'Optional.of("   ")', v: "   " },
  empty: { code: "Optional.empty()", v: null },
};

function run(input: Input): Stage[] {
  const out: Stage[] = [];
  let v = SOURCE[input].v;
  out.push({
    code: SOURCE[input].code,
    value: v,
    called: null,
    note: v === null ? "an empty box. there is no value, and no null either: just the absence, as an object." : "a box with a string inside. the pipeline will work on what's inside without taking it out.",
  });
  // map(strip)
  if (v !== null) {
    v = v.trim();
    out.push({ code: ".map(String::strip)", value: v, called: true, note: `strip runs on the value. map puts the result back in a box: "${v}".` });
  } else out.push({ code: ".map(String::strip)", value: null, called: false, note: "the box is empty, so map doesn't call strip at all. empty in, empty out." });
  // filter
  if (v !== null) {
    if (v.length > 0) out.push({ code: ".filter(s -> !s.isEmpty())", value: v, called: true, note: "the predicate says yes, so the box passes through unchanged." });
    else {
      out.push({ code: ".filter(s -> !s.isEmpty())", value: null, called: true, note: "the predicate says no. filter turns a full box into an empty one." });
      v = null;
    }
  } else out.push({ code: ".filter(s -> !s.isEmpty())", value: null, called: false, note: "still empty. the predicate is skipped." });
  // map(upper)
  if (v !== null) {
    v = v.toUpperCase();
    out.push({ code: ".map(String::toUpperCase)", value: v, called: true, note: "toUpperCase runs. still in a box." });
  } else out.push({ code: ".map(String::toUpperCase)", value: null, called: false, note: "empty, so toUpperCase never runs. no NPE possible, because nothing ever touched a null." });
  // orElse
  out.push({
    code: '.orElse("ANONYMOUS")',
    value: v ?? "ANONYMOUS",
    called: null,
    final: true,
    note: v !== null ? "orElse opens the box and hands you the value. the fallback is ignored." : "orElse opens an empty box and hands you the fallback instead.",
  });
  return out;
}

const INPUTS: { v: Input; label: string }[] = [
  { v: "ada", label: '"  ada  "' },
  { v: "blank", label: '"   "' },
  { v: "empty", label: "empty" },
];

export function OptionalPipeline() {
  const [input, setInput] = useState<Input>("ada");
  const stages = run(input);
  const s = useStepper(stages.length, { interval: 1100 });
  useEffect(() => {
    s.go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);
  const i = Math.min(s.i, stages.length - 1);

  return (
    <div {...s.keys} className="@container grid gap-4 font-mono outline-none">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-13">
        <span className="text-faint">raw =</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="input">
          {INPUTS.map((x) => (
            <button key={x.v} className="word" aria-pressed={x.v === input} onClick={() => setInput(x.v)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="grid gap-1.5">
        {stages.map((st, k) => {
          const on = k === i;
          const seen = k <= i;
          return (
            <li
              key={`${input}-${k}`}
              className="grid items-center gap-x-4 gap-y-1.5 rounded-md px-3 py-2 transition-[opacity,box-shadow] duration-200 @[560px]:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
              style={{ opacity: seen ? 1 : 0.3, boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line)"}` }}
            >
              <div className="min-w-0 overflow-x-auto text-13 whitespace-pre">
                <Java code={st.code} />
                {st.called === false && seen && <span className="ml-2 text-11 text-faint">not called</span>}
                {st.called === true && seen && <span className="ml-2 text-11 text-hot">called</span>}
              </div>
              <div className="flex min-w-0 items-center gap-2 text-12">
                {seen ? (
                  st.final ? (
                    <>
                      <span className="text-faint">String</span>
                      <span className="text-hot">&quot;{st.value}&quot;</span>
                    </>
                  ) : st.value !== null ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
                      <span className="text-faint">Optional</span>
                      <span className="rounded-sm bg-well-2 px-1.5 text-hi whitespace-pre">&quot;{st.value}&quot;</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-faint" style={{ outline: "1px dashed var(--line-2)", outlineOffset: -1 }}>
                      Optional.empty
                    </span>
                  )
                ) : (
                  <span className="text-faint">·</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Narr className="min-h-[3.2em]">{stages[i].note}</Narr>
      <StepControls s={s} />
    </div>
  );
}
