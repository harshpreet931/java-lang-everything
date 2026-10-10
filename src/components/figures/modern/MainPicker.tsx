"use client";

import { useState } from "react";
import { CodePanel, Narrate, Verdict } from "../functional/kit";

// which main does `java` call? all 15 non-empty combinations of these four methods
// were compiled with javac 25 and launched with java 25; the results are in RESULT,
// indexed by bitmask (bit 0 = static main(String[]), 1 = static main(),
// 2 = main(String[]), 3 = main()).

const MAINS = [
  { label: "static void main(String[] args)", src: '    static void main(String[] args) { IO.println("A"); }' },
  { label: "static void main()", src: '    static void main() { IO.println("B"); }' },
  { label: "void main(String[] args)", src: '    void main(String[] args) { IO.println("C"); }' },
  { label: "void main()", src: '    void main() { IO.println("D"); }' },
];

// the method that runs, or "clash" when javac rejects a static and an instance main with
// the same signature (it reports one error per instance duplicate, at that method's line).
type R = { runs: number } | "clash";
const RESULT: Record<number, R> = {
  1: { runs: 0 },
  2: { runs: 1 },
  3: { runs: 0 },
  4: { runs: 2 },
  5: "clash",
  6: { runs: 2 },
  7: "clash",
  8: { runs: 3 },
  9: { runs: 0 },
  10: "clash",
  11: "clash",
  12: { runs: 2 },
  13: "clash",
  14: "clash",
  15: "clash",
};
const SIG = ["main(String[])", "main()"];

export function MainPicker() {
  const [mask, setMask] = useState(6);
  const on = MAINS.map((_, i) => (mask >> i) & 1);
  const listed = MAINS.map((m, i) => ({ ...m, i })).filter((m) => on[m.i]);
  const r = mask ? RESULT[mask] : null;
  const code = ["class Main {", ...listed.map((m) => m.src), "}"].join("\n");
  const runs = r && r !== "clash" ? r.runs : -1;
  const runLine = runs >= 0 ? listed.findIndex((m) => m.i === runs) + 2 : 0;
  // an instance main (bit 2 or 3) clashes when its static twin (bit 0 or 1) is also there
  const clashes = r === "clash" ? listed.map((m, k) => ({ m, line: k + 2 })).filter(({ m }) => m.i >= 2 && on[m.i - 2]) : [];

  let note = "pick at least one main.";
  if (runs >= 0) {
    const m = MAINS[runs];
    const why =
      runs === 0 || runs === 2
        ? "a main that takes String[] always wins, static or not."
        : listed.length > 1
          ? "no main takes String[], so the no-argument one runs."
          : "the only main there is.";
    note = `${why} ${runs >= 2 ? "it's an instance method, so the launcher first calls the no-argument constructor, then " + m.label.replace("void ", "") + " on that new object." : "it's static, so the launcher just calls it."}`;
  } else if (r) {
    note = "a static and an instance method with the same signature can't live in one class, launcher or not. javac stops before the launcher ever gets a say.";
  }

  return (
    <div className="@container grid gap-4">
      <div className="flex flex-wrap gap-1" role="group" aria-label="main methods">
        {MAINS.map((m, i) => (
          <button key={m.label} className="word" aria-pressed={!!on[i]} onClick={() => setMask((x) => x ^ (1 << i))}>
            {m.label}
          </button>
        ))}
      </div>
      <CodePanel
        file="Main.java"
        code={code}
        live={runLine ? [runLine] : []}
        dead={clashes.map((c) => c.line)}
        notes={runLine ? { [runLine]: { text: "← java runs this one", tone: "live" } } : undefined}
      />
      <Verdict ok={runs >= 0} label={!r ? "nothing to run" : runs >= 0 ? `$ java Main.java  →  ${"ABCD"[runs]}` : "compile error"}>
        {clashes.length ? (
          <span className="text-dead">
            {clashes.map((c) => `Main.java:${c.line}: error: method ${SIG[c.m.i - 2]} is already defined in class Main`).join("\n")}
          </span>
        ) : null}
      </Verdict>
      <Narrate minH="3.4em">{note}</Narrate>
    </div>
  );
}
