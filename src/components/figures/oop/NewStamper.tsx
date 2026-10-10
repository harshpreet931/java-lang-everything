"use client";

import { useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/trace";
import { MemoryPane } from "@/components/viz/MemoryStepperClient";

// press `new` and watch it stamp out an object, phase by phase:
//   1. load the class (first time only)  2. allocate, every field zeroed
//   3. run the constructor (a frame with a hidden `this`)  4. hand back the reference
// the stack/heap drawing is the same MemoryPane the steppers use, so arrows and colours match.

const DOGS = [
  { name: "rex", age: 3 },
  { name: "luna", age: 5 },
  { name: "bo", age: 1 },
  { name: "mochi", age: 2 },
] as const;

const PHASES = ["load class", "allocate + zero", "run constructor", "return reference"] as const;

type Dog = { name: string; age: number };
// phase: index into PHASES while a `new` is animating, null when idle
type State = { dogs: Dog[]; making: number | null; phase: number | null; loaded: boolean; poked: string | null };

const START: State = { dogs: [], making: null, phase: null, loaded: false, poked: null };

function snapshot(s: State): Step {
  const locals: Record<string, Step["frames"][number]["locals"][string]> = {};
  const heap: Step["heap"] = {};
  s.dogs.forEach((d, i) => {
    const making = s.making === i;
    // the variable only exists once the reference comes back
    if (!making || s.phase === 3) locals[d.name] = { ref: `d${i}` };
    const zeroed = making && s.phase !== null && s.phase < 2;
    heap[`d${i}`] = {
      type: "Dog",
      fields: { name: zeroed ? null : { ref: `s${i}` }, age: zeroed ? 0 : d.age },
      state: making && s.phase !== 3 ? "new" : undefined,
    };
    heap[`s${i}`] = { type: "String", value: `"${d.name}"` };
  });
  const frames: Step["frames"] = [{ name: "main", locals }];
  if (s.making !== null && s.phase === 2) {
    const d = s.dogs[s.making];
    frames.push({ name: `new Dog("${d.name}", ${d.age})`, locals: { this: { ref: `d${s.making}` }, name: { ref: `s${s.making}` }, age: d.age } });
  }
  if (s.poked) {
    const i = s.dogs.findIndex((d) => d.name === s.poked);
    frames.push({ name: `${s.poked}.birthday()`, locals: { this: { ref: `d${i}` } } });
  }
  return { line: 0, frames, heap };
}

export function NewStamper() {
  const [s, setS] = useState<State>(START);
  const [prevStep, setPrevStep] = useState<Step | undefined>(undefined);
  const cur = useRef<State>(START);
  const timers = useRef<number[]>([]);
  const busy = s.making !== null || s.poked !== null;
  const next = DOGS[s.dogs.length];

  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  // every change remembers the snapshot before it, so the memory pane can flash what changed
  const commit = (fn: (x: State) => State) => {
    const was = cur.current;
    const now = fn(was);
    cur.current = now;
    setPrevStep(snapshot(was));
    setS(now);
  };

  const stamp = () => {
    if (!next || busy) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idx = s.dogs.length;
    const first = !s.loaded;
    if (reduce) {
      commit((x) => ({ ...x, dogs: [...x.dogs, { ...next }], loaded: true }));
      return;
    }
    const seq = first ? [0, 1, 2, 3] : [1, 2, 3];
    commit((x) => ({ ...x, dogs: [...x.dogs, { ...next }], making: idx, phase: seq[0], loaded: x.loaded || seq[0] === 0 }));
    seq.slice(1).forEach((p, k) => {
      timers.current.push(window.setTimeout(() => commit((x) => ({ ...x, phase: p, loaded: true })), (k + 1) * 900));
    });
    timers.current.push(window.setTimeout(() => commit((x) => ({ ...x, making: null, phase: null })), seq.length * 900 + 700));
  };

  const birthday = (name: string) => {
    if (busy) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    commit((x) => ({ ...x, poked: reduce ? null : name, dogs: x.dogs.map((d) => (d.name === name ? { ...d, age: d.age + 1 } : d)) }));
    if (!reduce) timers.current.push(window.setTimeout(() => commit((x) => ({ ...x, poked: null })), 1300));
  };

  const reset = () => {
    clear();
    cur.current = START;
    setPrevStep(undefined);
    setS(START);
  };

  const step = snapshot(s);
  const making = s.making !== null ? s.dogs[s.making] : null;

  const narration = (() => {
    if (making && s.phase !== null) {
      const call = `new Dog("${making.name}", ${making.age})`;
      return [
        `${call}: first use of Dog, so the JVM loads the class. this happens once, ever.`,
        `${call}: room for one Dog is carved out of the heap. every field starts zeroed: null and 0.`,
        `${call}: now the constructor runs, as a normal frame with a hidden this pointing at the new object.`,
        `${call}: the constructor's frame is gone. the expression's value is the reference, stored in ${making.name}.`,
      ][s.phase];
    }
    if (s.poked) return `${s.poked}.birthday(): one copy of the method's code, run with this = ${s.poked}. only that dog ages.`;
    if (!s.dogs.length) return "nothing yet. press new.";
    if (!next) return `${s.dogs.length} objects, ${s.dogs.length} sets of fields, still one class. try birthday() on one of them.`;
    return `${s.dogs.length} object${s.dogs.length > 1 ? "s" : ""} on the heap, each with its own name and age. one class.`;
  })();

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* the blueprint */}
        <div
          className="rounded-md bg-well px-4 py-3 text-12 transition-[box-shadow,opacity] duration-300 ease-jle"
          style={{ boxShadow: `inset 0 0 0 1px ${s.loaded ? "var(--meta)" : "var(--line-2)"}`, opacity: s.loaded ? 1 : 0.55 }}
          aria-label="the Dog class"
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-13 text-hi">class Dog</span>
            <span className={`text-11 ${s.loaded ? "text-meta" : "text-faint"}`}>{s.loaded ? "loaded · one copy" : "not loaded yet"}</span>
          </div>
          <div className="grid grid-cols-[8ch_minmax(0,1fr)] gap-y-1 leading-[1.6]">
            <span className="text-faint">fields</span>
            <span className="text-ink">
              String name, int age <span className="text-faint">· each object gets its own</span>
            </span>
            <span className="text-faint">methods</span>
            <span className="text-ink">
              Dog(..), birthday() <span className="text-faint">· shared by all</span>
            </span>
            <span className="text-faint">objects</span>
            <span className="text-hi tabular">{s.dogs.length}</span>
          </div>
        </div>

        {/* controls */}
        <div className="min-w-0 text-13">
          <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
            <span className="text-faint">stamp =</span>
            <div>
              <button className="act solid" onClick={stamp} disabled={!next || busy}>
                {next ? `new Dog("${next.name}", ${next.age})` : "that's enough dogs"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
            <span className="text-faint">call =</span>
            <div className="flex flex-wrap gap-1">
              {(s.dogs.length === 0 || (s.making === 0)) && <span className="text-12 text-faint">no dogs yet</span>}
              {s.dogs
                .filter((_, i) => s.making === null || i < s.making)
                .map((d) => (
                  <button
                    key={d.name}
                    className="word disabled:opacity-40"
                    onClick={() => birthday(d.name)}
                    disabled={busy}
                    aria-pressed={s.poked === d.name}
                  >
                    {d.name}.birthday()
                  </button>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2 py-2.5">
            <button className="act" onClick={reset} disabled={!s.dogs.length}>
              reset
            </button>
          </div>
        </div>
      </div>

      {/* the four phases of `new` */}
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-11" aria-hidden>
        {PHASES.map((p, i) => {
          const on = s.phase === i;
          const done = s.phase !== null && i < s.phase;
          return (
            <li key={p} className={`transition-colors duration-200 ${on ? "text-hot" : done ? "text-mute" : "text-faint/70"}`}>
              <span className="tabular">{i + 1}</span> {p}
            </li>
          );
        })}
      </ol>

      <div className="min-h-[120px]">
        <MemoryPane step={step} prev={prevStep} />
      </div>

      <p className="min-h-[3.4em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {narration}
      </p>
    </div>
  );
}
