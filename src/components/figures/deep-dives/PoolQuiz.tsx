"use client";

import { useState } from "react";
import { Java } from "./kit";

// every case run on jdk 25 (temurin 25.0.4), compiled with javac 25 and also run with
// the source launcher. same answers both ways. ab is the literal "ab" in every row.

type Case = { setup?: string; expr: string; answer: boolean; why: string };

const CASES: Case[] = [
  { expr: '"a" + "b" == ab', answer: true, why: 'two literals: javac folds them into one constant, "ab". the bytecode is a single ldc of the same pool entry.' },
  { setup: 'String a = "a";', expr: 'a + "b" == ab', answer: false, why: "a is a normal variable, so this concat happens at run time and builds a brand new String." },
  { setup: 'final String a = "a";', expr: 'a + "b" == ab', answer: true, why: "a final String initialized with a constant is a constant variable. javac folds it just like two literals (and doesn't even give a a slot)." },
  { setup: "final String a = getA(); // returns \"a\"", expr: 'a + "b" == ab', answer: false, why: "final isn't enough. the initializer has to be a constant expression, and a method call never is." },
  { setup: 'static final String A = "a";', expr: 'A + "b" == ab', answer: true, why: "a static final constant is a constant variable too. folded at compile time." },
  { setup: 'final var a = "a";', expr: 'a + "b" == ab', answer: true, why: "var infers String, and it's final with a constant initializer, so it's a constant variable. folded." },
  { expr: "\"a\" + 'b' == ab", answer: true, why: "a char literal is a constant expression too. javac folds it to \"ab\"." },
  { expr: 'new String("ab") == ab', answer: false, why: "new always makes a new object. it shares the pooled string's byte[] but it is not the pooled String." },
  { expr: 'new String("ab").intern() == ab', answer: true, why: "intern() looks the content up in the pool and returns the pooled instance: the literal." },
  { setup: 'String a = "a";', expr: '(a + "b").intern() == ab', answer: true, why: "the runtime concat makes a new String, but intern() hands back the one already in the pool." },
  { expr: 'ab.concat("") == ab', answer: true, why: "an implementation detail: concat returns this when the argument is empty. true on jdk 25, but no spec promises it." },
  { expr: '"a" + 1 == "a1"', answer: true, why: "an int literal is a constant too. folded to \"a1\", the same pool entry as the literal on the right." },
];

export function PoolQuiz() {
  const [picks, setPicks] = useState<(boolean | null)[]>(() => CASES.map(() => null));
  const answered = picks.filter((p) => p !== null).length;
  const right = picks.filter((p, i) => p === CASES[i].answer).length;

  return (
    <div className="@container text-13">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-12">
        <span className="text-mute">
          in every row, <Java code={'String ab = "ab";'} />
        </span>
        <span className="tabular" aria-live="polite">
          {answered === 0 ? (
            <span className="text-faint">pick true or false</span>
          ) : (
            <>
              <span className={right === answered ? "text-live" : "text-hi"}>{right}</span>
              <span className="text-faint">
                {" "}
                / {answered} right{answered < CASES.length ? `, ${CASES.length - answered} to go` : ""}
              </span>
            </>
          )}
        </span>
      </div>
      <ol className="grid">
        {CASES.map((c, i) => {
          const p = picks[i];
          const done = p !== null;
          const ok = p === c.answer;
          return (
            <li key={i} className="grid gap-2 border-t border-line py-3 @[620px]:grid-cols-[minmax(0,1fr)_auto] @[620px]:items-center">
              <div className="min-w-0">
                {c.setup && (
                  <div className="truncate text-12">
                    <Java code={c.setup} />
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-11 text-faint tabular">{String(i + 1).padStart(2, "0")}</span>
                  <Java code={c.expr} className="text-13" />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {[true, false].map((v) => {
                  const isAnswer = done && v === c.answer;
                  const wrongPick = done && v === p && !ok;
                  return (
                    <button
                      key={String(v)}
                      className="act !min-h-8 min-w-[7ch] disabled:!pointer-events-none disabled:!opacity-100"
                      disabled={done}
                      onClick={() => setPicks((ps) => ps.map((x, j) => (j === i ? v : x)))}
                      style={
                        isAnswer
                          ? { borderColor: "var(--live)", color: "var(--live)" }
                          : wrongPick
                            ? { borderColor: "var(--dead)", color: "var(--dead)", textDecoration: "line-through" }
                            : done
                              ? { opacity: 0.35 }
                              : undefined
                      }
                    >
                      {String(v)}
                    </button>
                  );
                })}
              </div>
              {done && <p className="text-12 leading-[1.6] text-mute @[620px]:col-span-2">{c.why}</p>}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <button className="act" onClick={() => setPicks(CASES.map((c) => c.answer))}>
          show all answers
        </button>
        <button className="act" onClick={() => setPicks(CASES.map(() => null))} disabled={answered === 0}>
          reset
        </button>
      </div>
    </div>
  );
}
