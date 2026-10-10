"use client";

import { useState } from "react";

// false sharing on an apple M4 Pro, jdk 25. two threads each do 50 million get+set on their
// own slot of one AtomicLongArray. sweeping a pair of adjacent slots across 16 positions,
// only the 2 positions where the pair straddled a 64-byte boundary ran fast: 89-125 ms,
// vs 289-346 ms everywhere else. so the unit of sharing here is 64 bytes, 8 longs.

const A = 5;

export function FalseSharingLine() {
  const [b, setB] = useState(6);
  const same = Math.floor(b / 8) === Math.floor(A / 8);
  const gap = Math.abs(b - A) * 8;

  return (
    <div className="@container">
      <div className="mb-2 text-11 text-faint">two cache lines, 8 longs each. thread 1 owns the amber slot. click a slot for thread 2.</div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((line) => (
          <div key={line} className="rounded-md p-1.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="mb-1 flex justify-between text-[10px] text-faint">
              <span>cache line {line}</span>
              <span>64 bytes</span>
            </div>
            <div className="grid grid-cols-8 gap-[3px]">
              {Array.from({ length: 8 }, (_, k) => {
                const slot = line * 8 + k;
                const isA = slot === A;
                const isB = slot === b;
                return (
                  <button
                    key={slot}
                    disabled={isA}
                    onClick={() => setB(slot)}
                    aria-label={isA ? "thread 1's counter" : `put thread 2's counter in slot ${slot}`}
                    aria-pressed={isB}
                    className="flex h-9 items-center justify-center rounded-[3px] text-11 transition-[background-color,box-shadow] duration-150 disabled:cursor-default"
                    style={{
                      background: isA ? "var(--hot)" : isB ? (same ? "var(--dead)" : "var(--live)") : "var(--well-2)",
                      color: isA || isB ? "var(--bg)" : "var(--faint)",
                      boxShadow: "inset 0 0 0 1px var(--line)",
                    }}
                  >
                    {isA ? "T1" : isB ? "T2" : slot}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-12">
        <span className="text-faint">distance</span>
        <span className="text-hi tabular">{gap} bytes</span>
        <span className="text-faint">same line?</span>
        <span style={{ color: same ? "var(--dead)" : "var(--live)" }}>{same ? "yes: false sharing" : "no"}</span>
        <span className="text-faint">measured</span>
        <span className="tabular" style={{ color: same ? "var(--dead)" : "var(--live)" }}>
          {same ? "289 to 346 ms" : "89 to 125 ms"} <span className="text-faint">for 50M increments per thread</span>
        </span>
      </div>
      <p className="mt-3 min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {same
          ? "the two counters are different variables, but the cores don't track variables, they track 64-byte lines. every write by one thread invalidates the other core's copy of the whole line, so the line ping-pongs between them on every increment. about 3 times slower, with zero shared data."
          : "different lines: each core keeps its own line in its own cache, and nobody invalidates anybody. same code, same threads, 3 times faster. distance in bytes doesn't decide it; which side of a 64-byte boundary each counter lands on does."}
      </p>
    </div>
  );
}
