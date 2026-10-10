"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// the InstrumentedHashSet double count (effective java item 18), one call at a time.
// left pane: your class. right pane: the code you inherited or wrapped.
// on jdk 25, HashSet still inherits addAll from AbstractCollection, which loops calling add(e):
// the real program prints 6 for three elements (see the chapter). the wrapper version prints 3.

type Mode = "extends" | "wraps";
type Step = { mine?: number; theirs?: number; stack: string[]; count: number; note: string };

const MINE: Record<Mode, string[]> = {
  extends: [
    "class InstrumentedHashSet<E> extends HashSet<E> {",
    "    int addCount = 0;",
    "",
    "    @Override public boolean add(E e) {",
    "        addCount++;",
    "        return super.add(e);",
    "    }",
    "",
    "    @Override public boolean addAll(Collection<? extends E> c) {",
    "        addCount += c.size();",
    "        return super.addAll(c);",
    "    }",
    "}",
  ],
  wraps: [
    "class InstrumentedSet<E> extends ForwardingSet<E> {",
    "    int addCount = 0;",
    "    InstrumentedSet(Set<E> s) { super(s); }",
    "",
    "    @Override public boolean add(E e) {",
    "        addCount++;",
    "        return super.add(e);      // → s.add(e)",
    "    }",
    "",
    "    @Override public boolean addAll(Collection<? extends E> c) {",
    "        addCount += c.size();",
    "        return super.addAll(c);   // → s.addAll(c)",
    "    }",
    "}",
  ],
};

const THEIRS: Record<Mode, { title: string; lines: string[] }> = {
  extends: {
    title: "AbstractCollection.addAll · inherited by HashSet",
    lines: [
      "public boolean addAll(Collection<? extends E> c) {",
      "    boolean modified = false;",
      "    for (E e : c)",
      "        if (add(e))        // virtual: whose add?",
      "            modified = true;",
      "    return modified;",
      "}",
    ],
  },
  wraps: {
    title: "ForwardingSet · then the HashSet inside it",
    lines: [
      "// ForwardingSet.addAll: just forwards",
      "return s.addAll(c);       // s is the wrapped HashSet",
      "",
      "// inside s (AbstractCollection.addAll)",
      "for (E e : c)",
      "    if (add(e))            // this = s, a plain HashSet",
      "        modified = true;",
    ],
  },
};

const STEPS: Record<Mode, Step[]> = {
  extends: [
    { mine: 9, stack: ["main", "InstrumentedHashSet.addAll"], count: 0, note: 's.addAll(List.of("snap", "crackle", "pop")) lands in your override.' },
    { mine: 10, stack: ["main", "InstrumentedHashSet.addAll"], count: 3, note: "addCount += c.size(). three elements, count is 3. so far, so right." },
    { mine: 11, theirs: 1, stack: ["main", "InstrumentedHashSet.addAll", "AbstractCollection.addAll"], count: 3, note: "super.addAll(c). HashSet doesn't write its own addAll, so this is the one it inherits from AbstractCollection." },
    { theirs: 4, stack: ["main", "InstrumentedHashSet.addAll", "AbstractCollection.addAll"], count: 3, note: 'it loops, calling add(e) for "snap". add is a virtual call, and this object is an InstrumentedHashSet...' },
    { mine: 5, theirs: 4, stack: ["main", "…addAll", "AbstractCollection.addAll", "InstrumentedHashSet.add"], count: 4, note: "...so it lands back in YOUR add(). addCount++ → 4. snap has now been counted twice." },
    { mine: 6, stack: ["main", "…addAll", "AbstractCollection.addAll", "InstrumentedHashSet.add", "HashSet.add"], count: 4, note: "super.add(e) finally stores it. back to the loop." },
    { mine: 5, theirs: 4, stack: ["main", "…addAll", "AbstractCollection.addAll", "InstrumentedHashSet.add"], count: 5, note: '"crackle": same round trip through your add(). 5.' },
    { mine: 5, theirs: 4, stack: ["main", "…addAll", "AbstractCollection.addAll", "InstrumentedHashSet.add"], count: 6, note: '"pop": 6.' },
    { mine: 11, theirs: 6, stack: ["main", "InstrumentedHashSet.addAll"], count: 6, note: "three elements, addCount says 6. nothing in your code is wrong on its own. it depends on how HashSet happens to implement addAll, a detail you never chose." },
  ],
  wraps: [
    { mine: 10, stack: ["main", "InstrumentedSet.addAll"], count: 0, note: "same call, on the wrapper this time." },
    { mine: 11, stack: ["main", "InstrumentedSet.addAll"], count: 3, note: "addCount += c.size(): 3." },
    { mine: 12, theirs: 2, stack: ["main", "InstrumentedSet.addAll", "ForwardingSet.addAll"], count: 3, note: "ForwardingSet hands the call to the HashSet it holds. it doesn't inherit from it, it has one." },
    { theirs: 6, stack: ["main", "InstrumentedSet.addAll", "ForwardingSet.addAll", "AbstractCollection.addAll"], count: 3, note: "the HashSet's addAll still loops calling add(e) on itself. but itself is a plain HashSet now, so your add() never runs. the self-call stays inside." },
    { mine: 12, stack: ["main", "InstrumentedSet.addAll"], count: 3, note: "three elements, addCount 3. and it works with any Set: TreeSet, LinkedHashSet, whatever you pass in." },
  ],
};

export function SelfUseTrace() {
  const [mode, setMode] = useState<Mode>("extends");
  const steps = STEPS[mode];
  const s = useStepper(steps.length, { interval: 1600 });
  const st = steps[Math.min(s.i, steps.length - 1)];
  const bad = mode === "extends" && st.count > 3;

  return (
    <div {...s.keys} className="grid gap-5 text-13 outline-none">
      <div className="grid grid-cols-[7ch_minmax(0,1fr)] items-center border-b border-line py-2">
        <span className="text-faint">set =</span>
        <div className="flex flex-wrap gap-1">
          <button className="word" aria-pressed={mode === "extends"} onClick={() => (setMode("extends"), s.reset())}>
            extends HashSet
          </button>
          <button className="word" aria-pressed={mode === "wraps"} onClick={() => (setMode("wraps"), s.reset())}>
            wraps a Set
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Pane title={mode === "extends" ? "yours" : "yours (composition)"} lines={MINE[mode]} at={st.mine} />
        <Pane title={THEIRS[mode].title} lines={THEIRS[mode].lines} at={st.theirs} />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">call stack (top = running now)</div>
          <div className="flex flex-col-reverse gap-1">
            {st.stack.map((f, i) => (
              <div
                key={`${i}-${f}`}
                className="truncate rounded-md bg-well px-2.5 py-1 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]"
                style={{
                  color: i === st.stack.length - 1 ? "var(--hi)" : "var(--mute)",
                  boxShadow: `inset 0 0 0 1px ${i === st.stack.length - 1 ? (f === "InstrumentedHashSet.add" && mode === "extends" ? "var(--dead)" : "var(--hot)") : "var(--line-2)"}`,
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md bg-well px-5 py-3 text-center shadow-[inset_0_0_0_1px_var(--line-2)]" aria-live="polite">
          <div className="text-11 text-faint">addCount</div>
          <div key={st.count} className={`flash text-[2.25rem] leading-tight tabular ${bad ? "text-dead" : st.count === 3 ? "text-live" : "text-hi"}`}>
            {st.count}
          </div>
          <div className="text-11 text-faint">of 3 elements</div>
        </div>
      </div>

      <p className="min-h-[3.4em] font-serif text-15 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} />
    </div>
  );
}

function Pane({ title, lines, at }: { title: string; lines: string[]; at?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-8 items-center border-b border-line px-3.5 text-11 text-mute">{title}</div>
      <pre className="overflow-x-auto py-2 text-11 leading-[1.75]">
        {lines.map((l, i) => {
          const on = at === i + 1;
          return (
            <div
              key={i}
              className="grid grid-cols-[2.5ch_1fr] gap-x-2.5 border-l-2 pr-3 transition-colors duration-200"
              style={{ borderColor: on ? "var(--hot)" : "transparent", background: on ? "color-mix(in srgb, var(--hot) 12%, transparent)" : undefined }}
            >
              <span className="text-right text-faint/60 tabular">{i + 1}</span>
              <span className="whitespace-pre" style={{ color: on ? "var(--hi)" : "var(--ink)" }}>
                {l || " "}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
