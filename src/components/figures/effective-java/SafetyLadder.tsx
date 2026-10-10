"use client";

import { useState } from "react";
import { Narration } from "./kit";

// item 82. the levels of thread safety a class can document, from "nothing to do" to
// "don't". each level says what a caller has to do before sharing an instance.

const LEVELS = [
  {
    k: "immutable",
    eg: "String, Integer, LocalDate, records of immutable parts",
    you: "nothing. share it with every thread, no locks.",
  },
  {
    k: "unconditionally thread-safe",
    eg: "ConcurrentHashMap, AtomicLong, Random",
    you: "nothing for single calls. compound actions (check, then act) still need the class's own atomic methods, like putIfAbsent or merge.",
  },
  {
    k: "conditionally thread-safe",
    eg: "Collections.synchronizedList(...)",
    you: "single calls are safe, but some sequences need a lock the docs name. iterating a synchronized list means synchronized (list) { for (...) }.",
  },
  {
    k: "not thread-safe",
    eg: "ArrayList, HashMap, StringBuilder",
    you: "wrap every use in your own lock, or confine the object to one thread.",
  },
  {
    k: "thread-hostile",
    eg: "a class that mutates a static field without locking",
    you: "can't be used safely from multiple threads at all, even with external locking. it's a bug: fix it or deprecate it.",
  },
];

export function SafetyLadder() {
  const [i, setI] = useState(2);
  return (
    <div className="grid gap-4">
      <ol className="grid gap-1.5" aria-label="levels of thread safety">
        {LEVELS.map((l, j) => {
          const on = i === j;
          return (
            <li key={l.k}>
              <button
                onClick={() => setI(j)}
                aria-pressed={on}
                className="grid w-full grid-cols-[3ch_minmax(0,1fr)] items-baseline gap-2 rounded-md px-3.5 py-2.5 text-left transition-[box-shadow,background-color] duration-150"
                style={{
                  background: on ? "var(--well-2)" : "var(--bg)",
                  boxShadow: `inset 0 0 0 1px ${on ? "var(--mute)" : "var(--line-2)"}`,
                }}
              >
                <span className="text-11 text-faint tabular">{j + 1}</span>
                <span className="min-w-0">
                  <span className="block text-13 text-hi">{l.k}</span>
                  <span className="mt-0.5 block text-11 text-mute">{l.eg}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <Narration>
        <span className="font-mono text-12 text-faint">callers must: </span>
        {LEVELS[i].you}
      </Narration>
    </div>
  );
}
