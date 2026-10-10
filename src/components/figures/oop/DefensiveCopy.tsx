"use client";

import { useState } from "react";
import type { Step } from "@/lib/trace";
import { MemoryPane } from "@/components/viz/MemoryStepperClient";

// a "final" Period holding two java.util.Dates, and two ways to break it from outside:
//   attack 1: keep the Date you passed in, then mutate it        (end.setTime(0))
//   attack 2: mutate the Date a getter handed you                 (p.start().setTime(5e12))
// toggle defensive copies on the way in and on the way out and watch the arrows.
// both versions are runnable in the chapter (Period.java, Safe.java), outputs checked on jdk 25.
// dates are the UTC days for 1e12, 2e12, 0 and 5e12 ms.

const D = { start: "2001-09-09", end: "2033-05-18", zero: "1970-01-01", far: "2128-06-11" };

export function DefensiveCopy() {
  const [copyIn, setCopyIn] = useState(false);
  const [copyOut, setCopyOut] = useState(false);
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);

  // which Date objects does the Period point at?
  const fieldStart = copyIn ? "cS" : "dS";
  const fieldEnd = copyIn ? "cE" : "dE";

  const val: Record<string, string> = {
    dS: D.start,
    dE: a1 ? D.zero : D.end,
    cS: D.start,
    cE: D.end,
    gS: D.far,
  };
  // attack 2 mutates whatever the getter returned
  if (a2 && !copyOut) val[fieldStart] = D.far;

  const pStart = val[fieldStart];
  const pEnd = val[fieldEnd];
  const broken = pStart > pEnd;

  const heap: Step["heap"] = {
    per: {
      type: "Period",
      fields: { start: { ref: fieldStart }, end: { ref: fieldEnd } },
      state: broken ? "dead" : undefined,
      tag: broken ? "broken: start after end" : "final fields",
    },
  };
  const date = (id: string, changed: boolean) =>
    ({ type: "Date", value: val[id], state: changed ? "new" : undefined, tag: changed ? "mutated" : undefined }) as Step["heap"][string];
  heap.dS = date("dS", false);
  heap.dE = date("dE", a1);
  if (copyIn) {
    heap.cS = date("cS", a2 && !copyOut);
    heap.cE = date("cE", false);
  } else if (a2 && !copyOut) {
    heap.dS = date("dS", true);
  }
  if (a2 && copyOut) heap.gS = { ...date("gS", true), tag: "a copy. mutate away" };

  const locals: Step["frames"][number]["locals"] = { start: { ref: "dS" }, end: { ref: "dE" }, p: { ref: "per" } };
  if (a2) locals.got = { ref: copyOut ? "gS" : fieldStart };

  const reset = () => (setA1(false), setA2(false));

  const verdict = !a1 && !a2
    ? "the Period is fine, for now. try the attacks."
    : broken
      ? `broken: the Period now says it starts on ${pStart} and ends on ${pEnd}. its fields are final and private, and it still changed, because it never owned its Dates.`
      : "still valid: every attack hit a Date the Period doesn't hold. that's what defensive copies buy you.";

  return (
    <div className="grid gap-5 text-13">
      <div>
        <div className="grid grid-cols-[15ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">constructor =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={!copyIn} onClick={() => (setCopyIn(false), reset())}>
              this.end = end
            </button>
            <button className="word" aria-pressed={copyIn} onClick={() => (setCopyIn(true), reset())}>
              new Date(end.getTime())
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[15ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">getter =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={!copyOut} onClick={() => (setCopyOut(false), reset())}>
              return start
            </button>
            <button className="word" aria-pressed={copyOut} onClick={() => (setCopyOut(true), reset())}>
              return new Date(start.getTime())
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-3">
          <button className="act solid" onClick={() => setA1(true)} disabled={a1}>
            attack 1: end.setTime(0)
          </button>
          <button className="act solid" onClick={() => setA2(true)} disabled={a2}>
            attack 2: p.start().setTime(…)
          </button>
          <button className="act" onClick={reset} disabled={!a1 && !a2}>
            reset
          </button>
        </div>
      </div>

      <MemoryPane step={{ line: 0, frames: [{ name: "main", locals }], heap }} />

      <p className={`min-h-[3.4em] font-serif text-15 leading-[1.6] ${broken ? "text-dead" : "text-ink"}`} aria-live="polite">
        {verdict}
      </p>
    </div>
  );
}
