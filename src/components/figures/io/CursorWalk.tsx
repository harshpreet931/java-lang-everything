"use client";

import type { ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, NARR, tint } from "./kit";

// how a ResultSet is read: a cursor that starts BEFORE the first row, moves with next(),
// and getXxx reads columns of whatever row it's on. (what the JDBC spec describes; the
// rows are made up, there's no database in this figure.)

const ROWS = [
  { id: 1, name: "ada", total: 250 },
  { id: 2, name: "linus", total: 120 },
  { id: 3, name: "grace", total: 310 },
];

type S = { code: string; at: number; out?: string; note: ReactNode; read?: "name" | "total" };

const STEPS: S[] = [
  { code: 'ResultSet rs = ps.executeQuery();', at: -1, note: <>the query ran. the cursor sits <em>before</em> the first row, so there&apos;s nothing to read yet. call <code>getString</code> now and you get an SQLException.</> },
  { code: "rs.next()   // true", at: 0, note: <>next() moves to row 1 and returns true: there was a row.</> },
  { code: 'rs.getString("name")   // "ada"', at: 0, read: "name", out: "ada", note: <>columns are read from the current row, by name or by 1-based index.</> },
  { code: 'rs.getInt("total")     // 250', at: 0, read: "total", out: "ada 250", note: <>each getter converts the SQL type to a java one. <code>getObject(col, LocalDate.class)</code> for dates.</> },
  { code: "rs.next()   // true", at: 1, out: "ada 250", note: <>row 2. the driver may fetch rows in batches behind the scenes (the fetch size), but you only ever see one at a time.</> },
  { code: "rs.next()   // true", at: 2, out: "ada 250 · linus 120", note: <>row 3.</> },
  { code: "rs.next()   // false", at: 3, out: "ada 250 · linus 120 · grace 310", note: <>no more rows: next() returns false and the cursor is after the last row. that&apos;s the end of your <code>while (rs.next())</code>.</> },
];

export function CursorWalk() {
  const s = useStepper(STEPS.length, { interval: 1600 });
  const st = STEPS[s.i];
  const cell = (r: number, col: "id" | "name" | "total", v: ReactNode) => {
    const on = st.at === r && st.read === col;
    return (
      <td
        className="px-3 py-1.5 transition-[background-color,color] duration-200"
        style={{ background: on ? tint("hot", 16) : undefined, color: on ? "var(--hot)" : undefined }}
      >
        {v}
      </td>
    );
  };
  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line)]">
        <Java code={st.code} />
      </div>
      <table className="w-full max-w-[440px] border-collapse text-12">
        <thead>
          <tr className="text-11 text-faint">
            <th className="w-[3ch] font-normal" />
            <th className="px-3 py-1.5 text-left font-normal">id</th>
            <th className="px-3 py-1.5 text-left font-normal">name</th>
            <th className="px-3 py-1.5 text-left font-normal">total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-[10px] text-faint">
            <td className="text-center text-12 text-ref">{st.at === -1 ? "▶" : ""}</td>
            <td colSpan={3} className="px-3 py-0.5 italic">before first</td>
          </tr>
          {ROWS.map((r, i) => (
            <tr
              key={r.id}
              className="text-ink transition-[background-color] duration-200"
              style={{ background: st.at === i ? tint("ref", 9) : undefined, boxShadow: `inset 0 1px 0 var(--line)` }}
            >
              <td className="text-center text-12 text-ref">{st.at === i ? "▶" : ""}</td>
              {cell(i, "id", r.id)}
              {cell(i, "name", r.name)}
              {cell(i, "total", r.total)}
            </tr>
          ))}
          <tr className="text-[10px] text-faint" style={{ boxShadow: `inset 0 1px 0 var(--line)` }}>
            <td className="text-center text-12 text-ref">{st.at === 3 ? "▶" : ""}</td>
            <td colSpan={3} className="px-3 py-0.5 italic">after last</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 text-12 text-faint">
        read so far = <span className="text-hi">{st.out ?? "·"}</span>
        <span className="ml-4">
          cursor ={" "}
          <span className="text-ref">{st.at === -1 ? "before first" : st.at === 3 ? "after last" : `row ${st.at + 1}`}</span>
        </span>
      </div>
      <p className={`mt-3 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
