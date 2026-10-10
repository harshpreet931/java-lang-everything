"use client";

import { useState } from "react";

// a run of small multiple-choice rounds with a score. used for "which invoke
// instruction?" and "does this initialize the class?". every answer shown comes
// from a real run (javap or program output), recorded in the case data.

export type GauntletCase = {
  /** faint line(s) above the code: declarations, where we are */
  context?: string;
  /** the code in question */
  code: string;
  /** the question for this round, e.g. "does A get initialized?" */
  ask?: string;
  answer: string;
  /** evidence: real javap line or program output */
  proof: string;
  proofLabel: string;
  why: string;
};

export function Gauntlet({ cases, options, intro }: { cases: GauntletCase[]; options: string[]; intro?: string }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, seen: 0 });
  const c = cases[i];
  const done = picked !== null;
  const right = picked === c.answer;

  const pick = (o: string) => {
    if (done) return;
    setPicked(o);
    setScore((s) => ({ right: s.right + (o === c.answer ? 1 : 0), seen: s.seen + 1 }));
  };
  const next = () => {
    setPicked(null);
    setI((x) => (x + 1) % cases.length);
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-4 text-12 text-faint">
        <span>
          {i + 1} of {cases.length}
        </span>
        <span className="tabular">
          {score.right}/{score.seen} right
        </span>
      </div>
      <div className="rounded-md bg-well px-4 py-3.5 text-13 shadow-[inset_0_0_0_1px_var(--line)]">
        {c.context && <div className="text-12 whitespace-pre-wrap text-faint">{c.context}</div>}
        <div className="mt-1.5 text-15 break-words whitespace-pre-wrap text-hi">{c.code}</div>
      </div>
      {c.ask && <div className="mt-4 font-serif text-18 text-hi">{c.ask}</div>}
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={c.ask ?? "pick one"}>
        {options.map((o) => {
          const isAnswer = done && o === c.answer;
          const isWrong = done && o === picked && !right;
          return (
            <button
              key={o}
              role="radio"
              aria-checked={picked === o}
              onClick={() => pick(o)}
              disabled={done}
              className="act !text-12 disabled:!pointer-events-none disabled:!opacity-100"
              style={
                isAnswer
                  ? { borderColor: "var(--live)", color: "var(--live)" }
                  : isWrong
                    ? { borderColor: "var(--dead)", color: "var(--dead)", textDecoration: "line-through" }
                    : done
                      ? { opacity: 0.4 }
                      : undefined
              }
            >
              {o}
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-[8.5em] border-t border-line pt-4" aria-live="polite">
        {done ? (
          <>
            <div className="text-12" style={{ color: right ? "var(--live)" : "var(--dead)" }}>
              {right ? "yep." : `not quite. the answer is ${c.answer}.`}
            </div>
            <pre className="mt-2 overflow-x-auto rounded-md bg-well px-3 py-2 text-12 leading-[1.7] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
              <span className="text-faint">{c.proofLabel}</span>
              {"\n"}
              {c.proof}
            </pre>
            <p className="mt-3 font-serif text-17 leading-[1.6] text-ink">{c.why}</p>
            <button className="act solid mt-4" onClick={next}>
              {i + 1 < cases.length ? "next →" : "start over"}
            </button>
          </>
        ) : (
          <p className="font-serif text-16 text-mute italic">{intro ?? "pick one."}</p>
        )}
      </div>
    </div>
  );
}
