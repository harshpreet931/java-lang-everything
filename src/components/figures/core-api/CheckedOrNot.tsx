"use client";

import { useState } from "react";
import { Java } from "./kit";

// three questions that decide what kind of throwable a problem should be.
// the classes are the ones the JDK itself uses for these situations.

type Ans = "yes" | "no";
type Kind = "error" | "unchecked" | "checked";

type Case = {
  id: string;
  label: string;
  answers: Ans[]; // one per question, until a "yes" (or the last one)
  kind: Kind;
  code: string;
  why: string;
};

const QUESTIONS = [
  { q: "is the JVM itself in trouble?" },
  { q: "did the caller break a rule it could have checked first?" },
  { q: "could a correct program still hit this, and do something about it?" },
];

const CASES: Case[] = [
  {
    id: "file",
    label: "the file the user picked is gone",
    answers: ["no", "no", "yes"],
    kind: "checked",
    code: "throw new NoSuchFileException(path.toString());",
    why: "no amount of careful coding stops someone deleting a file. the caller should be forced to decide: ask again, use a default, give up.",
  },
  {
    id: "qty",
    label: "someone passed qty = -3",
    answers: ["no", "yes"],
    kind: "unchecked",
    code: 'throw new IllegalArgumentException("qty must be > 0: " + qty);',
    why: "the caller could have checked. it's a bug in their code, and the fix is to change the code, not to catch it.",
  },
  {
    id: "iter",
    label: "next() on an empty iterator",
    answers: ["no", "yes"],
    kind: "unchecked",
    code: "throw new NoSuchElementException();",
    why: "hasNext() was right there. calling next() anyway is a programming error.",
  },
  {
    id: "state",
    label: "send() on a closed connection",
    answers: ["no", "yes"],
    kind: "unchecked",
    code: 'throw new IllegalStateException("connection closed");',
    why: "the object is in the wrong state for this call. the caller's sequencing is wrong.",
  },
  {
    id: "timeout",
    label: "the payment service timed out",
    answers: ["no", "no", "yes"],
    kind: "checked",
    code: "throw new TimeoutException(\"payment after 5s\");",
    why: "networks fail even when your code is perfect, and the caller has real options: retry, queue it, tell the user.",
  },
  {
    id: "oom",
    label: "the heap is full",
    answers: ["yes"],
    kind: "error",
    code: "// thrown by the JVM: OutOfMemoryError",
    why: "nothing your method can sensibly do. let it go up, crash, and look at a heap dump.",
  },
  {
    id: "linkage",
    label: "a class is on the compile classpath but not at runtime",
    answers: ["yes"],
    kind: "error",
    code: "// thrown by the JVM: NoClassDefFoundError",
    why: "the program is broken as deployed. it's a build problem, not a runtime decision.",
  },
];

const KIND: Record<Kind, { label: string; base: string }> = {
  error: { label: "Error", base: "extends Error" },
  unchecked: { label: "unchecked", base: "extends RuntimeException" },
  checked: { label: "checked", base: "extends Exception" },
};

export function CheckedOrNot() {
  const [id, setId] = useState("qty");
  const c = CASES.find((x) => x.id === id)!;
  const end = c.answers.length - 1;

  return (
    <div className="font-mono @container grid gap-5">
      <div className="flex flex-wrap gap-1" role="group" aria-label="pick a situation">
        {CASES.map((x) => (
          <button key={x.id} className="word !text-12 text-left" aria-pressed={x.id === id} onClick={() => setId(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <ol className="grid gap-2">
        {QUESTIONS.map((q, i) => {
          const a = c.answers[i];
          const reached = i <= end;
          const stops = i === end;
          const lands: Kind | undefined = stops ? c.kind : undefined;
          return (
            <li
              key={i}
              className="grid items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-3 transition-opacity duration-200 @[560px]:grid-cols-[minmax(0,1fr)_auto]"
              style={{
                opacity: reached ? 1 : 0.35,
                boxShadow: `inset 0 0 0 1px ${stops ? "var(--hot)" : "var(--line)"}`,
              }}
            >
              <span className="text-13 text-ink">
                <span className="mr-2 text-faint tabular">{i + 1}.</span>
                {q.q}
              </span>
              <span className="flex items-center gap-2 text-12">
                {reached ? (
                  <>
                    <span className={a === "yes" ? "text-hi" : "text-mute"}>{a}</span>
                    {lands ? (
                      <>
                        <span className="text-faint">→</span>
                        <span className="text-hot">{KIND[lands].label}</span>
                      </>
                    ) : (
                      <span className="text-faint">↓</span>
                    )}
                  </>
                ) : (
                  <span className="text-faint">·</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-2 border-t border-line pt-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-13">
          <span className="text-hot">{KIND[c.kind].label}</span>
          <span className="text-faint">{KIND[c.kind].base}</span>
        </div>
        <div className="overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]">
          <Java code={c.code} />
        </div>
        <p className="font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-mute">{c.why}</p>
      </div>
    </div>
  );
}
