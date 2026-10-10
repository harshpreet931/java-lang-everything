"use client";

import { useState } from "react";
import { Java, Row, Words } from "@/components/figures/basics/kit";

// nested loops, one jump at (i = 1, j = 2), four different jumps. the output lines are the
// real ones from running each variant on jdk 25.

type Act = "break" | "continue" | "break outer" | "continue outer";

const OUT: Record<Act, string> = {
  break: "00 01 02 03 | 10 11 | 20 21 22 23 | 30 31 32 33 | done",
  continue: "00 01 02 03 | 10 11 13 | 20 21 22 23 | 30 31 32 33 | done",
  "break outer": "00 01 02 03 | 10 11 done",
  "continue outer": "00 01 02 03 | 10 11 20 21 22 23 | 30 31 32 33 | done",
};

const NOTE: Record<Act, string> = {
  break: "break leaves the innermost loop only. row 1 stops early, but its \"|\" still prints and the outer loop carries on with row 2.",
  continue: "continue skips the rest of this one iteration of the inner loop. only cell 12 is missing, j moves on to 3.",
  "break outer": "break outer leaves the loop labelled outer, from inside the inner one. everything stops; the next thing to run is the line after both loops.",
  "continue outer": "continue outer jumps straight to the next iteration of the outer loop (i++). the rest of row 1 is skipped, and so is its \"|\".",
};

/** simulate the program, cell by cell */
function run(act: Act) {
  const cells = new Map<string, "ran" | "skip" | "jump">();
  const rowEnd = new Set<number>();
  let stopped = false;
  outer: for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (i === 1 && j === 2) {
        cells.set(`${i}${j}`, "jump");
        if (act === "break") break;
        if (act === "continue") continue;
        if (act === "break outer") {
          stopped = true;
          break outer;
        }
        continue outer;
      }
      cells.set(`${i}${j}`, "ran");
    }
    rowEnd.add(i);
  }
  return { cells, rowEnd, stopped };
}

export function LabeledLoops() {
  const [act, setAct] = useState<Act>("break");
  const { cells, rowEnd } = run(act);
  const tokens = OUT[act].split(" ");

  return (
    <div className="font-mono text-13">
      <Row k="when i == 1 && j == 2 =" w="24ch" last>
        <Words
          options={(["break", "continue", "break outer", "continue outer"] as Act[]).map((a) => ({ v: a, label: a }))}
          value={act}
          onChange={setAct}
          label="what to do"
        />
      </Row>

      <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.85] shadow-[inset_0_0_0_1px_var(--line)]">
          {[
            "outer:",
            "for (int i = 0; i < 4; i++) {",
            "    for (int j = 0; j < 4; j++) {",
            `        if (i == 1 && j == 2) ${act};`,
            '        IO.print(i + "" + j + " ");',
            "    }",
            '    IO.print("| ");',
            "}",
            'IO.println("done");',
          ].map((l, k) => (
            <div
              key={k}
              className={k === 3 ? "-mx-4 border-l-2 border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)] px-[14px]" : ""}
            >
              <Java code={l} />
            </div>
          ))}
        </pre>

        <div>
          <div className="mb-2 flex justify-between text-11 text-faint">
            <span>i ↓ · j →</span>
            <span>|</span>
          </div>
          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="contents">
                {[0, 1, 2, 3].map((j) => {
                  const c = cells.get(`${i}${j}`);
                  return (
                    <span
                      key={j}
                      className="flex h-8 items-center justify-center rounded-sm text-12 tabular transition-[background-color,color,box-shadow,opacity] duration-200"
                      style={{
                        color: c === "ran" ? "var(--live)" : c === "jump" ? "var(--hot)" : "var(--faint)",
                        background: c === "ran" ? "color-mix(in srgb, var(--live) 12%, transparent)" : undefined,
                        boxShadow: `inset 0 0 0 1px ${c === "jump" ? "var(--hot)" : c === "ran" ? "color-mix(in srgb, var(--live) 45%, transparent)" : "var(--line)"}`,
                        opacity: c ? 1 : 0.6,
                      }}
                    >
                      {c === "jump" ? act.split(" ")[0] : `${i}${j}`}
                    </span>
                  );
                })}
                <span className={`flex h-8 w-5 items-center justify-center text-13 ${rowEnd.has(i) ? "text-live" : "text-faint opacity-40"}`}>|</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 text-11 text-faint">
            <span className="text-live">■ ran</span>
            <span>□ skipped</span>
            <span className="text-hot">□ the jump</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">stdout </span>
        {tokens.map((t, k) => (
          <span key={k} className={t === "|" ? "text-mute" : t === "done" ? "text-hi" : "text-ink"}>
            {t}{" "}
          </span>
        ))}
      </div>
      <p className="mt-3 font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {NOTE[act]}
      </p>
    </div>
  );
}
