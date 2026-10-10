"use client";

import { useState } from "react";
import { Java, Narrate, Row, Words, ring, tint } from "../functional/kit";

// six operations on a parameter `xs` declared four ways. all 24 cells were compiled
// with javac 25 (one file per cell); errors are the first line javac prints, plus the
// line that says what CAP#1 is.

type Cell = { ok: true } | { ok: false; err: string; cap?: string };
type Decl = "List<Number>" | "List<? extends Number>" | "List<? super Integer>" | "List<?>";

const OPS = ["Number n = xs.get(0);", "Integer n = xs.get(0);", "Object n = xs.get(0);", "xs.add(1);", "xs.add(1.5);", "xs.add(null);"];

const capExt = "CAP#1 extends Number from capture of ? extends Number";
const capSup = "CAP#1 extends Object super: Integer from capture of ? super Integer";
const capAny = "CAP#1 extends Object from capture of ?";
const OK: Cell = { ok: true };

const GRID: Record<Decl, Cell[]> = {
  "List<Number>": [OK, { ok: false, err: "incompatible types: Number cannot be converted to Integer" }, OK, OK, OK, OK],
  "List<? extends Number>": [
    OK,
    { ok: false, err: "incompatible types: CAP#1 cannot be converted to Integer", cap: capExt },
    OK,
    { ok: false, err: "incompatible types: int cannot be converted to CAP#1", cap: capExt },
    { ok: false, err: "incompatible types: double cannot be converted to CAP#1", cap: capExt },
    OK,
  ],
  "List<? super Integer>": [
    { ok: false, err: "incompatible types: CAP#1 cannot be converted to Number", cap: capSup },
    { ok: false, err: "incompatible types: CAP#1 cannot be converted to Integer", cap: capSup },
    OK,
    OK,
    { ok: false, err: "incompatible types: double cannot be converted to CAP#1", cap: capSup },
    OK,
  ],
  "List<?>": [
    { ok: false, err: "incompatible types: CAP#1 cannot be converted to Number", cap: capAny },
    { ok: false, err: "incompatible types: CAP#1 cannot be converted to Integer", cap: capAny },
    OK,
    { ok: false, err: "incompatible types: int cannot be converted to CAP#1", cap: capAny },
    { ok: false, err: "incompatible types: double cannot be converted to CAP#1", cap: capAny },
    OK,
  ],
};

const SAY: Record<Decl, string> = {
  "List<Number>": "no wildcard: read Numbers, write any Number. but only an actual List<Number> can be passed in, not a List<Integer>.",
  "List<? extends Number>": "a producer. every read is a Number. no writes at all (except null), because javac doesn't know which subtype of Number the list really holds.",
  "List<? super Integer>": "a consumer. Integers go in, always safely. reads come out as Object, because the list might be a List<Object>.",
  "List<?>": "a list of something. you can ask its size, clear it, read Objects out of it. you can't put anything in it but null.",
};

export function WildcardOps() {
  const [d, setD] = useState<Decl>("List<? extends Number>");
  const [op, setOp] = useState(3);
  const cells = GRID[d];
  const c = cells[op];

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="xs is a" w="8ch" last>
          <Words options={Object.keys(GRID) as Decl[]} value={d} onChange={(v) => setD(v)} label="declared type" />
        </Row>
      </div>

      <div className="grid gap-1.5 @[520px]:grid-flow-col @[520px]:grid-cols-2 @[520px]:grid-rows-3">
        {OPS.map((o, i) => {
          const cell = cells[i];
          const sel = i === op;
          return (
            <button
              key={o}
              onClick={() => setOp(i)}
              aria-pressed={sel}
              className="flex items-center justify-between gap-3 rounded-md px-3.5 py-2 text-left text-12 transition-[box-shadow,background-color] duration-200 ease-jle"
              style={{
                boxShadow: sel ? ring(cell.ok ? "live" : "dead", 100) : ring(cell.ok ? "live" : "dead", 40),
                background: tint(cell.ok ? "live" : "dead", sel ? 10 : 4),
              }}
            >
              <span className="whitespace-pre">
                <Java code={o} />
              </span>
              <span style={{ color: cell.ok ? "var(--live)" : "var(--dead)" }}>{cell.ok ? "✓" : "✗"}</span>
            </button>
          );
        })}
      </div>

      <div
        className="min-h-[6.4em] overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]"
        aria-live="polite"
      >
        <div className="text-faint">
          void m({d} xs) {"{"} <Java code={OPS[op]} /> {"}"}
        </div>
        {c.ok ? (
          <div className="text-live">compiles</div>
        ) : (
          <>
            <div className="text-dead">error: {c.err}</div>
            {c.cap && (
              <>
                <div className="text-mute">  where CAP#1 is a fresh type-variable:</div>
                <div className="text-mute">    {c.cap}</div>
              </>
            )}
          </>
        )}
      </div>

      <Narrate>{SAY[d]}</Narrate>
    </div>
  );
}
