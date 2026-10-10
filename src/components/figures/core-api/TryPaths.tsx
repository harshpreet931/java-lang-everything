"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Words } from "./kit";

// which lines of a try/catch/finally actually run, for each way risky() can end.
// the order follows the JLS (14.20.2) and matches what javac emits: the finally body is
// copied onto every exit path (normal, each catch, and an "any" handler that rethrows).

const CODE = `try {
    open();
    risky();
    save();
} catch (IOException e) {
    recover(e);
} finally {
    close();
}
next();`;

type Scenario = { id: string; label: string; path: { line: number; note: string }[]; exit: string; escapes?: boolean };

const SCENARIOS: Scenario[] = [
  {
    id: "ok",
    label: "risky() returns",
    path: [
      { line: 2, note: "open() runs." },
      { line: 3, note: "risky() returns normally." },
      { line: 4, note: "so save() runs too." },
      { line: 8, note: "the try block is done. finally runs, like it always does." },
      { line: 10, note: "and on to the next statement. the catch was never touched." },
    ],
    exit: "falls through to next()",
  },
  {
    id: "io",
    label: "throws IOException",
    path: [
      { line: 2, note: "open() runs." },
      { line: 3, note: "risky() throws an IOException. the rest of the try block is abandoned." },
      { line: 6, note: "the JVM checks the catch clauses in order. IOException matches, so recover(e) runs." },
      { line: 8, note: "the catch finished normally. finally runs." },
      { line: 10, note: "the exception was handled, so execution carries on after the whole statement." },
    ],
    exit: "handled, carries on with next()",
  },
  {
    id: "ise",
    label: "throws IllegalStateException",
    path: [
      { line: 2, note: "open() runs." },
      { line: 3, note: "risky() throws an IllegalStateException. save() is skipped." },
      { line: 8, note: "no catch matches (it isn't an IOException). finally runs anyway, on the way out." },
      { line: 8, note: "when finally completes, the same exception carries on to whoever called this method. next() never runs." },
    ],
    exit: "escapes to the caller, still an IllegalStateException",
    escapes: true,
  },
  {
    id: "catch",
    label: "the catch throws too",
    path: [
      { line: 2, note: "open() runs." },
      { line: 3, note: "risky() throws an IOException." },
      { line: 6, note: "recover(e) runs... and throws a new exception itself." },
      { line: 8, note: "finally still runs. it doesn't care where the exception came from." },
      { line: 8, note: "the new exception from recover() leaves the method. next() never runs." },
    ],
    exit: "recover()'s exception escapes to the caller",
    escapes: true,
  },
];

export function TryPaths() {
  const [id, setId] = useState("io");
  const sc = SCENARIOS.find((s) => s.id === id)!;
  const s = useStepper(sc.path.length, { interval: 1200 });
  useEffect(() => {
    s.go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const i = Math.min(s.i, sc.path.length - 1);
  const cur = sc.path[i];
  const all = new Set(sc.path.map((p) => p.line));
  const atEnd = i === sc.path.length - 1;
  const codeLines = [2, 3, 4, 6, 8, 10];
  const dim = atEnd ? codeLines.filter((l) => !all.has(l)) : [];

  return (
    <div {...s.keys} className="font-mono @container grid gap-4 outline-none">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-13">
        <span className="text-faint">risky() =</span>
        <Words label="how risky() ends" options={SCENARIOS.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} />
      </div>
      <div className="grid gap-4 @[620px]:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <CodePanel
          file="Job.java"
          code={CODE}
          hot={[cur.line]}
          dim={dim}
          right={<span className="text-11 text-faint">{atEnd ? "done" : "running"}</span>}
        />
        <div className="flex flex-col gap-3">
          <ol className="grid gap-1 text-12">
            {sc.path.map((p, k) => (
              <li key={k} className={`flex gap-2 ${k === i ? "text-hot" : k < i ? "text-mute" : "text-faint/60"}`}>
                <span className="tabular">{k + 1}.</span>
                <span>line {p.line}</span>
                {k > 0 && sc.path[k - 1].line === p.line && <span className="text-faint">(leaving)</span>}
              </li>
            ))}
          </ol>
          <div
            className="mt-auto rounded-md px-3 py-2 text-12"
            style={{
              boxShadow: `inset 0 0 0 1px ${atEnd ? (sc.escapes ? "var(--dead)" : "var(--live)") : "var(--line)"}`,
              color: atEnd ? (sc.escapes ? "var(--dead)" : "var(--live)") : "var(--faint)",
            }}
          >
            {atEnd ? sc.exit : "…"}
          </div>
        </div>
      </div>
      <p className="min-h-[3.4em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-ink" aria-live="polite">
        {cur.note}
      </p>
      <StepControls s={s} />
    </div>
  );
}
