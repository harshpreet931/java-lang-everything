"use client";

import { useState } from "react";

// a jcstress-style results table: every outcome, how often it was seen, and what the
// test author said about it. pass several tests to get tabs.
//   ACCEPTABLE              live  (fine)
//   ACCEPTABLE_INTERESTING  hot   (legal, but look at it)
//   FORBIDDEN               dead  (must never happen; the test fails if it does)

type Expect = "ACCEPTABLE" | "ACCEPTABLE_INTERESTING" | "FORBIDDEN";
type OutRow = { id: string; samples: number; expect: Expect; desc?: string };
type Test = { name: string; rows: OutRow[]; note?: string };

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
const LABEL: Record<Expect, string> = { ACCEPTABLE: "acceptable", ACCEPTABLE_INTERESTING: "interesting", FORBIDDEN: "forbidden" };

const TONE: Record<Expect, string> = {
  ACCEPTABLE: "var(--live)",
  ACCEPTABLE_INTERESTING: "var(--hot)",
  FORBIDDEN: "var(--dead)",
};

export function Outcomes({ tests, head = "r1, r2" }: { tests: Test[]; head?: string }) {
  const [i, setI] = useState(0);
  const t = tests[i];
  const total = t.rows.reduce((a, r) => a + r.samples, 0);

  return (
    <div>
      {tests.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1" role="tablist">
          {tests.map((x, j) => (
            <button key={x.name} role="tab" aria-selected={i === j} className="word" onClick={() => setI(j)}>
              {x.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[300px] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 text-12 sm:gap-x-4">
          <span className="border-b border-line-2 pb-2 text-11 text-faint">{head}</span>
          <span className="border-b border-line-2 pb-2 text-11 text-faint">frequency</span>
          <span className="border-b border-line-2 pb-2 text-right text-11 text-faint">samples</span>
          <span className="border-b border-line-2 pb-2 text-11 text-faint">expect</span>
          {t.rows.map((r) => {
            const f = total ? r.samples / total : 0;
            const pct = f * 100;
            return (
              <div key={r.id} className="contents">
                <span className="border-b border-line py-2 text-13 text-hi tabular">{r.id}</span>
                <span className="flex items-center gap-2 border-b border-line py-2">
                  <span className="relative h-[10px] min-w-0 flex-1 bg-well-2">
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-jle"
                      style={{ width: `${r.samples ? Math.max(0.6, pct) : 0}%`, background: TONE[r.expect] }}
                    />
                  </span>
                  <span className="w-[6ch] text-right text-11 text-mute tabular">
                    {r.samples === 0 ? "0%" : pct < 0.01 ? "<0.01%" : `${pct.toFixed(2)}%`}
                  </span>
                </span>
                <span className="border-b border-line py-2 text-right text-mute tabular" title={r.samples.toLocaleString("en-US")}>
                  <span className="hidden sm:inline">{r.samples.toLocaleString("en-US")}</span>
                  <span className="sm:hidden">{compact(r.samples)}</span>
                </span>
                <span className="border-b border-line py-2 text-11" style={{ color: TONE[r.expect] }}>
                  {LABEL[r.expect]}
                  {r.desc && <span className="ml-2 hidden text-faint md:inline">{r.desc}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {t.note && <p className="mt-3 text-12 text-mute">{t.note}</p>}
    </div>
  );
}
