"use client";

import { useState } from "react";
import { CodePanel, Narrate, Verdict } from "../functional/kit";

// exhaustiveness with nested record patterns, as a 2x2 grid. Pair(Shape a, Shape b)
// over sealed Shape permits Circle, Square. all 63 non-empty combinations of the six
// case labels below were compiled with javac 25: a combination compiles exactly when
// every cell of the grid is covered (no dominance errors in any of them), which is
// what this figure computes.

type S = "C" | "S";
const LABELS: { src: string; cells: [S, S][] }[] = [
  { src: "Pair(Circle _, Circle _)", cells: [["C", "C"]] },
  { src: "Pair(Circle _, Square _)", cells: [["C", "S"]] },
  { src: "Pair(Square _, Circle _)", cells: [["S", "C"]] },
  { src: "Pair(Square _, Square _)", cells: [["S", "S"]] },
  { src: "Pair(Circle _, var b)", cells: [["C", "C"], ["C", "S"]] },
  { src: "Pair(Square _, Shape _)", cells: [["S", "C"], ["S", "S"]] },
];
const NAME: Record<S, string> = { C: "Circle", S: "Square" };

export function PairCoverage() {
  const [on, setOn] = useState<boolean[]>([true, true, true, false, false, false]);
  const active = LABELS.map((l, i) => ({ ...l, i })).filter((l) => on[l.i]);
  const coveredBy = (a: S, b: S) => active.find((l) => l.cells.some(([x, y]) => x === a && y === b));
  const missing = (["C", "S"] as S[]).flatMap((a) => (["C", "S"] as S[]).filter((b) => !coveredBy(a, b)).map((b) => [a, b] as [S, S]));
  const ok = active.length > 0 && missing.length === 0;

  const code = ["String both(Pair p) {", "    return switch (p) {", ...active.map((l) => `        case ${l.src} -> "...";`), "    };", "}"].join("\n");

  return (
    <div className="@container grid gap-4">
      <div className="flex flex-wrap gap-1" role="group" aria-label="case labels">
        {LABELS.map((l, i) => (
          <button key={l.src} className="word" aria-pressed={on[i]} onClick={() => setOn((o) => o.map((v, j) => (j === i ? !v : v)))}>
            {l.src}
          </button>
        ))}
      </div>

      <div className="grid gap-3 @[640px]:grid-cols-[minmax(0,1fr)_auto]">
        <CodePanel file="Main.java" code={code} dead={ok ? [] : [2]} />
        <div className="grid content-start gap-1.5 text-12">
          <div className="grid grid-cols-[8ch_1fr_1fr] gap-1.5">
            <span className="text-11 text-faint">a ↓ b →</span>
            <span className="text-center text-11 text-faint">Circle</span>
            <span className="text-center text-11 text-faint">Square</span>
            {(["C", "S"] as S[]).map((a) => [
              <span key={a} className="self-center text-11 text-faint">
                {NAME[a]}
              </span>,
              ...(["C", "S"] as S[]).map((b) => {
                const by = coveredBy(a, b);
                return (
                  <div
                    key={a + b}
                    className="grid min-h-[3.2rem] min-w-[6.5rem] place-items-center rounded-md px-2 text-center text-11 leading-[1.4] transition-[box-shadow,background-color] duration-200 ease-jle"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${by ? "color-mix(in srgb, var(--live) 55%, transparent)" : "var(--dead)"}`,
                      background: by ? "color-mix(in srgb, var(--live) 8%, transparent)" : "color-mix(in srgb, var(--dead) 8%, transparent)",
                      color: by ? "var(--live)" : "var(--dead)",
                    }}
                  >
                    {by ? `case ${active.indexOf(by) + 1}` : "nothing"}
                  </div>
                );
              }),
            ])}
          </div>
        </div>
      </div>

      <Verdict ok={ok}>
        {ok ? null : <span className="text-dead">{active.length ? "Main.java:2: error: the switch expression does not cover all possible input values" : "Main.java:2: error: switch expression does not have any case clauses"}</span>}
      </Verdict>

      <Narrate minH="3.4em">
        {!active.length
          ? "turn some cases on."
          : ok
            ? "every combination of (a, b) lands in some case, so javac accepts it with no default. the grid is the exact check it does."
            : `no case handles ${missing.map(([a, b]) => `Pair(${NAME[a]}, ${NAME[b]})`).join(" or ")}, and javac knows, because both components are sealed.`}
      </Narrate>
    </div>
  );
}
