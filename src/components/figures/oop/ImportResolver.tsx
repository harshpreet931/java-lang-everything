"use client";

import { useState } from "react";

// which Date do you get? toggle import lines and see what javac decides.
// all 64 combinations were compiled (and the survivors run) with javac/java 25, temurin 25.0.4:
//   N = cannot find symbol, u = java.util.Date, s = java.sql.Date,
//   A = reference to Date is ambiguous, D = duplicate single-type import.
// index = the six toggles below read as a binary number, first line = highest bit.
const RESULTS = "NsuAssssuuuuDDDDssssssssuuuuDDDDuuuussssuuuuDDDDAAAAssssuuuuDDDD";

type Kind = "on-demand" | "single-type" | "module";
const LINES: { code: string; kind: Kind }[] = [
  { code: "import java.util.*;", kind: "on-demand" },
  { code: "import java.sql.*;", kind: "on-demand" },
  { code: "import java.util.Date;", kind: "single-type" },
  { code: "import java.sql.Date;", kind: "single-type" },
  { code: "import module java.base;", kind: "module" },
  { code: "import module java.sql;", kind: "module" },
];

const PRESETS: { label: string; on: boolean[] }[] = [
  { label: "the classic clash", on: [true, true, false, false, false, false] },
  { label: "fix it", on: [true, true, true, false, false, false] },
  { label: "two modules", on: [false, false, false, false, true, true] },
  { label: "on-demand beats module", on: [true, false, false, false, false, true] },
];

function why(on: boolean[], r: string): string {
  const single = on[2] || on[3];
  const demand = on[0] || on[1];
  const mods = on[4] || on[5];
  if (r === "D") return "two single-type imports for the same simple name. javac rejects the second import line itself.";
  if (r === "N") return "nothing imports a Date, and java.lang doesn't have one.";
  if (single) return "a single-type import names exactly one class. it beats every on-demand and module import.";
  if (r === "A") return demand ? "two on-demand imports both supply a Date, and neither is more specific. so it's ambiguous, but only because the code actually uses Date." : "two module imports both supply a Date. ambiguous.";
  if (demand) return mods ? "an on-demand import found it. on-demand imports shadow module imports, so the module import never gets a say." : "found by the on-demand import.";
  return "found through the module import: every package the module exports.";
}

export function ImportResolver() {
  const [on, setOn] = useState<boolean[]>(PRESETS[0].on);
  const idx = on.reduce((a, b, i) => a | ((b ? 1 : 0) << (LINES.length - 1 - i)), 0);
  const r = RESULTS[idx];
  const ok = r === "u" || r === "s";
  const fqn = r === "u" ? "java.util.Date" : "java.sql.Date";
  const error =
    r === "A"
      ? "error: reference to Date is ambiguous"
      : r === "D"
        ? "error: a type with the same simple name is already defined by the single-type-import of Date"
        : "error: cannot find symbol\n  symbol:   class Date";

  return (
    <div className="grid gap-5 text-13">
      <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-start border-b border-line py-2">
        <span className="pt-1.5 text-faint">try =</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.label} className="word" aria-pressed={p.on.every((v, i) => v === on[i])} onClick={() => setOn(p.on)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex h-8 items-center justify-between border-b border-line px-3.5 text-12">
          <span className="text-ink">Main.java</span>
          <span className="text-11 text-faint">click a line to toggle it</span>
        </div>
        <div className="overflow-x-auto py-2 text-12 leading-[1.75]">
          {LINES.map((l, i) => (
            <button
              key={l.code}
              onClick={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={on[i]}
              className="grid w-full grid-cols-[3ch_minmax(0,1fr)_auto] items-baseline gap-x-3 border-l-2 pr-3.5 text-left transition-colors duration-150 hover:bg-well-2"
              style={{ borderColor: on[i] ? "var(--hot)" : "transparent" }}
            >
              <span className="text-right text-faint/60 tabular">{i + 1}</span>
              <span className={`truncate whitespace-pre ${on[i] ? "text-hi" : "text-faint line-through decoration-line-2"}`}>{l.code}</span>
              <span className={`text-11 ${on[i] ? "text-mute" : "text-faint/60"}`}>{l.kind}</span>
            </button>
          ))}
          <div className="mt-1 grid grid-cols-[3ch_minmax(0,1fr)] gap-x-3 border-l-2 border-transparent pr-3.5">
            {["", "public class Main {", "    public static void main(String[] args) {", "        Date d = new Date(0);", "    }", "}"].map((s, k) => (
              <div key={k} className="contents">
                <span className="text-right text-faint/60 tabular">{7 + k}</span>
                <span
                  className="whitespace-pre"
                  style={{ color: k === 3 ? (ok ? "var(--live)" : r === "D" ? "var(--ink)" : "var(--dead)") : "var(--ink)" }}
                >
                  {s || " "}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5" aria-live="polite">
        <div className={`text-14 ${ok ? "text-live" : "text-dead"} whitespace-pre-wrap`}>
          {ok ? (
            <>
              Date <span className="text-faint">→</span> {fqn}
            </>
          ) : (
            error
          )}
        </div>
        <p className="font-serif text-15 leading-[1.6] text-mute">{why(on, r)}</p>
      </div>
    </div>
  );
}
