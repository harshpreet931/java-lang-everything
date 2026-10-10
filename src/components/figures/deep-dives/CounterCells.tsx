"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// how ConcurrentHashMap counts. measured on jdk 25 (temurin 25.0.4, 14-core arm mac):
// T platform threads put 800,000 distinct keys between them into one map, then
// baseCount and every CounterCell.value were read with reflection. size() was 800,000
// every time. the cells array grows (doubling) while it's smaller than the cpu count.

const RUNS: Record<number, { base: number; cells: number[] | null }> = {
  1: { base: 800000, cells: null },
  2: { base: 12219, cells: [390791, 396990] },
  4: { base: 218, cells: [200332, 200744, 198667, 200039] },
  8: { base: 393, cells: [97047, 105576, 105918, 109475, 93221, 97230, 96968, 94172] },
  16: {
    base: 307,
    cells: [56463, 52801, 48803, 72624, 56219, 52337, 51791, 50481, 47807, 46723, 48161, 48673, 42315, 38519, 48556, 37420],
  },
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function CounterCells() {
  const [t, setT] = useState(8);
  const run = RUNS[t];
  const max = Math.max(run.base, ...(run.cells ?? [0]));
  const sum = run.base + (run.cells ?? []).reduce((a, b) => a + b, 0);

  return (
    <div className="@container text-13">
      <Row k="threads =" w="10ch" last>
        <Words label="writer threads" value={t} onChange={setT} options={[1, 2, 4, 8, 16].map((v) => ({ v, label: String(v) }))} />
      </Row>

      <div className="grid gap-4 border-t border-line pt-5 @[600px]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div>
          <div className="mb-1.5 text-11 text-faint">baseCount · one volatile long</div>
          <Cell value={run.base} max={max} hot={!run.cells} />
          <p className="mt-2 font-serif text-[0.95rem] leading-[1.5] text-mute">
            {run.cells
              ? "a few early increments landed here before the first CAS on it failed. after that, everyone went to the cells."
              : "one thread never loses a CAS, so the cells array is never even created."}
          </p>
        </div>
        <div>
          <div className="mb-1.5 text-11 text-faint">
            counterCells · {run.cells ? `CounterCell[${run.cells.length}]` : "null"}
          </div>
          {run.cells ? (
            <div className="grid grid-cols-2 gap-1.5 @[420px]:grid-cols-4">
              {run.cells.map((v, i) => (
                <Cell key={`${t}-${i}`} value={v} max={max} label={`[${i}]`} />
              ))}
            </div>
          ) : (
            <div className="flex h-12 items-center rounded-md px-3 text-12 text-faint shadow-[inset_0_0_0_1px_var(--line)]">null</div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-4" aria-live="polite">
        <span className="text-faint">sumCount() =</span>
        <span className="text-hi tabular">
          {fmt(run.base)}
          {run.cells && <span className="text-mute"> + {run.cells.length} cells</span>}
        </span>
        <span className="text-faint">=</span>
        <span className="text-20 font-light text-live tabular">{fmt(sum)}</span>
      </div>
    </div>
  );
}

function Cell({ value, max, label, hot }: { value: number; max: number; label?: string; hot?: boolean }) {
  return (
    <div className="obj-in relative overflow-hidden rounded-md bg-bg px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-jle"
        style={{ width: `${(value / max) * 100}%`, background: `color-mix(in srgb, var(${hot ? "--hot" : "--ink"}) 9%, transparent)` }}
      />
      <div className="relative flex items-baseline justify-between gap-2">
        {label && <span className="text-[10px] text-faint">{label}</span>}
        <span className="ml-auto text-12 text-hi tabular">{fmt(value)}</span>
      </div>
    </div>
  );
}
