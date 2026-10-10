"use client";

import { useMemo, useState } from "react";
import { LaneTable, type LaneRow } from "./Lanes";

// every possible interleaving of two count++ (read, add, write each): C(6,3) = 20.
// each one is drawn as a tiny two-row timeline. click one to see its full trace.

type Seq = (0 | 1)[];
const OPS = ["read", "add", "write"] as const;

function all(): Seq[] {
  const out: Seq[] = [];
  const rec = (s: Seq, a: number, b: number) => {
    if (a === 3 && b === 3) return out.push(s);
    if (a < 3) rec([...s, 0], a + 1, b);
    if (b < 3) rec([...s, 1], a, b + 1);
  };
  rec([], 0, 0);
  return out;
}

function run(seq: Seq) {
  let count = 0;
  const pc = [0, 0];
  const reg = [0, 0];
  const read = [0, 0];
  const rows: LaneRow[] = [{ mem: { count: 0 } }];
  for (const t of seq) {
    const ops: LaneRow["ops"] = [null, null];
    const op = OPS[pc[t]];
    if (op === "read") {
      reg[t] = count;
      read[t] = count;
      ops[t] = `read → ${count}`;
      rows.push({ ops });
    } else if (op === "add") {
      reg[t] += 1;
      ops[t] = `add → ${reg[t]}`;
      rows.push({ ops });
    } else {
      const stale = count !== read[t];
      count = reg[t];
      ops[t] = stale ? { t: `write ${count}`, k: "dead" } : `write ${count}`;
      rows.push({ ops, mem: { count: stale ? { v: count, k: "dead" } : count } });
    }
    pc[t] += 1;
  }
  return { count, rows };
}

export function InterleavingGrid() {
  const list = useMemo(() => all().map((seq) => ({ seq, ...run(seq) })), []);
  const [sel, setSel] = useState(3);
  const good = list.filter((x) => x.count === 2).length;
  const cur = list[sel];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-12">
        <span className="text-mute">
          all 20 orders. <span className="text-live">{good} end at 2</span>,{" "}
          <span className="text-dead">{list.length - good} end at 1</span>.
        </span>
        <span className="flex items-center gap-3 text-faint">
          <Legend kind={0} /> read <Legend kind={1} /> add <Legend kind={2} /> write
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5" role="group" aria-label="interleavings">
        {list.map((x, i) => {
          const ok = x.count === 2;
          const on = i === sel;
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              aria-pressed={on}
              aria-label={`interleaving ${i + 1}: ${x.seq.map((t) => `T${t + 1}`).join(" ")}, ends at ${x.count}`}
              className="flex items-center justify-between gap-2 rounded-md bg-well px-2 py-2 transition-[box-shadow] duration-150"
              style={{ boxShadow: `inset 0 0 0 1px ${on ? "var(--ink)" : "var(--line)"}` }}
            >
              <Mini seq={x.seq} />
              <span className="text-12 tabular" style={{ color: ok ? "var(--live)" : "var(--dead)" }}>
                {x.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 text-12 text-mute">
        order #{sel + 1}: {cur.seq.map((t) => `T${t + 1}`).join(" → ")}
      </div>
      <div className="mt-2">
        <LaneTable threads={["T1", "T2"]} cells={["count"]} rows={cur.rows} cur={cur.rows.length - 1} dense />
      </div>
    </div>
  );
}

function Legend({ kind }: { kind: 0 | 1 | 2 }) {
  return (
    <svg width={10} height={10} aria-hidden className="inline-block">
      <Cell x={0} y={0} kind={kind} />
    </svg>
  );
}

function Cell({ x, y, kind }: { x: number; y: number; kind: 0 | 1 | 2 }) {
  if (kind === 0) return <rect x={x + 0.5} y={y + 0.5} width={9} height={9} rx={1} fill="none" stroke="var(--mute)" />;
  if (kind === 1) return <circle cx={x + 5} cy={y + 5} r={1.8} fill="var(--mute)" />;
  return <rect x={x + 0.5} y={y + 0.5} width={9} height={9} rx={1} fill="var(--ink)" />;
}

function Mini({ seq }: { seq: Seq }) {
  const pc = [0, 0];
  return (
    <svg width={6 * 11} height={23} aria-hidden>
      <line x1={0} y1={5} x2={66} y2={5} stroke="var(--line)" />
      <line x1={0} y1={18} x2={66} y2={18} stroke="var(--line)" />
      {seq.map((t, i) => {
        const kind = pc[t] as 0 | 1 | 2;
        pc[t] += 1;
        return <Cell key={i} x={i * 11} y={t === 0 ? 0 : 13} kind={kind} />;
      })}
    </svg>
  );
}
