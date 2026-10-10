"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { tint, tv, type Tone, type ToneOrMute } from "./ui";

// the workhorse of part 09: thread lanes over time.
// time flows down. each thread is a column (a lane). each row is one step,
// and the op a thread performs sits in its lane. shared memory sits on the right,
// one column per cell, showing its value after that step.
//
//   export const lost = [
//     { mem: { count: 0 }, note: "both threads are about to run count++." },
//     { ops: ["read count → 0", null], note: "T1 reads 0 into a register." },
//     { ops: [null, "read count → 0"], note: "T2 also reads 0." },
//     { ops: ["write 1", null], mem: { count: 1 } },
//     { ops: [null, { t: "write 1", k: "dead" }], mem: { count: { v: 1, k: "dead" } }, note: "lost update." },
//   ];
//   <Lanes threads={["T1", "T2"]} cells={["count"]} steps={lost} />

export type LaneOp = string | { t: string; k?: ToneOrMute; wait?: boolean };
export type LaneVal = string | number | boolean | null | { v: string | number | boolean | null; k?: Tone };
export type LaneRow = { ops?: (LaneOp | null)[]; mem?: Record<string, LaneVal>; note?: ReactNode; label?: string };

const val = (x: LaneVal | undefined) => (x !== null && typeof x === "object" ? x.v : x);
const tone = (x: LaneVal | undefined) => (x !== null && typeof x === "object" ? x.k : undefined);
const show = (v: unknown) => (v === undefined ? "" : v === null ? "null" : String(v));

export function LaneTable({
  threads,
  cells = [],
  rows,
  cur,
  code,
  memLabel = "shared",
  dense,
  maxHeight,
}: {
  threads: string[];
  cells?: string[];
  rows: LaneRow[];
  /** rows after this index are hidden (space reserved so nothing jumps) */
  cur: number;
  /** optional source per lane, shown under the thread name */
  code?: string[];
  memLabel?: string;
  dense?: boolean;
  /** scroll vertically past this height, header stays put, newest row kept in view */
  maxHeight?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && maxHeight) el.scrollTop = el.scrollHeight;
  }, [rows.length, maxHeight]);
  // carry memory values forward so every row has a full snapshot
  const mem = useMemo(() => {
    const out: Record<string, LaneVal>[] = [];
    let last: Record<string, LaneVal> = {};
    for (const r of rows) {
      last = { ...last, ...(r.mem ?? {}) };
      out.push(last);
    }
    return out;
  }, [rows]);

  const cols = `2.6ch repeat(${threads.length}, minmax(0, ${threads.length > 2 ? 200 : 240}px))${cells.length ? ` repeat(${cells.length}, minmax(6ch, auto))` : " minmax(0, 1fr)"}`;
  // 1-based step numbers that skip "setup" rows with no ops
  const nums = useMemo(() => {
    let n = 0;
    return rows.map((r) => (r.ops?.some(Boolean) ? ++n : 0));
  }, [rows]);
  const py = dense ? "py-1" : "py-1.5";

  return (
    <div ref={scroller} className="@container overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
      <div className="grid min-w-[300px] text-12 @max-[520px]:text-11" style={{ gridTemplateColumns: cols }} role="table" aria-label="thread timeline">
        {/* header */}
        <div role="row" className="contents">
          <span role="columnheader" className="sticky top-0 z-[2] border-b border-line-2 bg-well pb-2 text-11 text-faint" aria-label="step" />
          {threads.map((t, i) => (
            <div role="columnheader" key={t} className="sticky top-0 z-[2] min-w-0 border-b border-line-2 bg-well px-1 pb-2 text-center">
              <div className="truncate text-hi">{t}</div>
              {code?.[i] && (
                <pre className="mx-auto mt-1 w-max max-w-full overflow-x-auto text-left text-11 leading-[1.55] whitespace-pre text-mute">{code[i]}</pre>
              )}
            </div>
          ))}
          {cells.map((c, j) => (
            <div
              role="columnheader"
              key={c}
              className={`sticky top-0 z-[2] flex flex-col justify-end border-b border-line-2 bg-well px-2 pb-2 text-center ${j === 0 ? "border-l border-l-line" : ""}`}
            >
              {j === 0 && <span className="text-[10px] leading-3 text-faint">{memLabel}</span>}
              <span className="text-mute">{c}</span>
            </div>
          ))}
          {!cells.length && <span aria-hidden className="sticky top-0 z-[2] border-b border-line-2 bg-well" />}
        </div>

        {rows.map((r, i) => {
          const hidden = i > cur;
          const now = i === cur;
          const prev = i > 0 ? mem[i - 1] : undefined;
          return (
            <div role="row" key={i} className={`contents ${hidden ? "[&_.lane-x]:invisible" : ""}`} aria-hidden={hidden || undefined}>
              <span
                role="cell"
                className={`flex items-center border-b border-line pl-0.5 text-[10px] tabular ${py} ${now ? "text-hot" : "text-faint"}`}
                style={now ? { boxShadow: "inset 2px 0 0 var(--hot)" } : undefined}
              >
                <span className="lane-x pl-1.5">{r.label ?? (nums[i] || "·")}</span>
              </span>
              {threads.map((_, ti) => {
                const op = r.ops?.[ti];
                return (
                  <div
                    role="cell"
                    key={ti}
                    className={`relative flex min-w-0 items-center justify-center border-b border-line px-1 ${py}`}
                    style={now ? { background: tint("hot", 5) } : undefined}
                  >
                    {/* the lane itself */}
                    <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
                    {op && (
                      <span className="lane-x relative z-[1] flex max-w-full justify-center">
                        <OpChip op={op} now={now} />
                      </span>
                    )}
                  </div>
                );
              })}
              {cells.map((c, j) => {
                const v = mem[i][c];
                const changed = prev ? show(val(prev[c])) !== show(val(v)) : false;
                const k = tone(v);
                return (
                  <span
                    role="cell"
                    key={c}
                    className={`flex items-center justify-center border-b border-line px-2 tabular ${py} ${j === 0 ? "border-l border-l-line" : ""}`}
                    style={now ? { background: tint("hot", 5) } : undefined}
                  >
                    <span
                      key={now && changed ? `${i}-${show(val(v))}` : "s"}
                      className={`lane-x px-1 ${now && changed ? "flash" : ""}`}
                      style={{ color: k ? tv(k) : changed ? (now ? "var(--hot)" : "var(--hi)") : "var(--mute)" }}
                    >
                      {show(val(v))}
                    </span>
                  </span>
                );
              })}
              {!cells.length && (
                <span aria-hidden className={`border-b border-line ${py}`} style={now ? { background: tint("hot", 5) } : undefined} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OpChip({ op, now }: { op: LaneOp; now?: boolean }) {
  const o = typeof op === "string" ? { t: op } : op;
  const k = o.k;
  const border = o.wait
    ? `1px dashed ${k && k !== "mute" ? `var(--${k})` : "var(--line-2)"}`
    : undefined;
  return (
    <span
      className="relative z-[1] max-w-full rounded-xs bg-well px-1.5 py-[3px] text-center leading-[1.35] break-words"
      style={{
        border,
        boxShadow: o.wait
          ? undefined
          : `inset 0 0 0 1px ${k && k !== "mute" ? `var(--${k})` : now ? "var(--ink)" : "var(--line-2)"}`,
        background: k && k !== "mute" ? `color-mix(in srgb, var(--${k}) 10%, var(--well))` : undefined,
        color: k ? tv(k) : o.wait ? "var(--mute)" : now ? "var(--hi)" : "var(--ink)",
      }}
    >
      {o.t}
    </span>
  );
}

/** the stepper version: step through a hand-written trace. */
export function Lanes({
  threads,
  cells,
  steps,
  code,
  start = 0,
  interval = 1600,
  memLabel,
  dense,
}: {
  threads: string[];
  cells?: string[];
  steps: LaneRow[];
  code?: string[];
  start?: number;
  interval?: number;
  memLabel?: string;
  dense?: boolean;
}) {
  const s = useStepper(steps.length, { interval, start });
  // a row without a note keeps the previous row's note on screen
  let note: ReactNode = null;
  for (let j = s.i; j >= 0 && note == null; j--) note = steps[j]?.note ?? null;
  return (
    <div {...s.keys} className="outline-none" aria-label="thread timeline step-through">
      <LaneTable threads={threads} cells={cells} rows={steps} cur={s.i} code={code} memLabel={memLabel} dense={dense} />
      <p className="mt-4 min-h-[3.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
