"use client";

import { useState } from "react";
import { CodePanel, Row, Words } from "@/components/figures/basics/kit";

// a switch EXPRESSION must produce a value for every input, so javac checks that the cases
// cover everything. a plain switch STATEMENT (old-style, no patterns) doesn't have to.
// the error text is the real one from javac 25.

type Form = "expression" | "statement";
const ALL = ["S", "M", "L"] as const;

export function SwitchExhaustive() {
  const [form, setForm] = useState<Form>("expression");
  const [cases, setCases] = useState<Set<string>>(() => new Set(["S", "M"]));
  const [dflt, setDflt] = useState(false);

  const toggle = (c: string) =>
    setCases((s) => {
      const x = new Set(s);
      if (x.has(c)) x.delete(c);
      else x.add(c);
      return x;
    });

  const present = ALL.filter((c) => cases.has(c));
  const missing = ALL.filter((c) => !cases.has(c));
  const covered = dflt || missing.length === 0;
  const words: Record<string, string> = { S: "small", M: "medium", L: "large" };

  const lines =
    form === "expression"
      ? [
          "String label = switch (size) {",
          ...present.map((c) => `    case ${c} -> "${words[c]}";`),
          ...(dflt ? ['    default -> "other";'] : []),
          "};",
        ]
      : [
          "switch (size) {",
          ...present.map((c) => `    case ${c} -> IO.println("${words[c]}");`),
          ...(dflt ? ['    default -> IO.println("other");'] : []),
          "}",
        ];

  const ok = form === "statement" || covered;

  return (
    <div className="font-mono text-13">
      <Row k="as a =" w="10ch">
        <Words
          options={[
            { v: "expression", label: "switch expression" },
            { v: "statement", label: "switch statement" },
          ]}
          value={form}
          onChange={setForm}
          label="switch form"
        />
      </Row>
      <Row k="cases =" w="10ch" last>
        <div className="flex flex-wrap gap-1">
          {ALL.map((c) => (
            <button key={c} className="word" aria-pressed={cases.has(c)} onClick={() => toggle(c)}>
              {c}
            </button>
          ))}
          <button className="word" aria-pressed={dflt} onClick={() => setDflt((d) => !d)}>
            default
          </button>
        </div>
      </Row>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CodePanel file="Main.java" code={`enum Size { S, M, L }\n\n${lines.join("\n")}`} dead={ok ? [] : [3]} />
        <div className="grid content-start gap-2 text-12 leading-[1.7]" aria-live="polite">
          <div className="text-11 text-faint">$ javac Main.java</div>
          {ok ? (
            <div className="text-live">compiles.</div>
          ) : present.length === 0 ? (
            <div className="text-dead">error: switch expression does not have any case clauses</div>
          ) : (
            <div className="text-dead">error: the switch expression does not cover all possible input values</div>
          )}
          <p className="font-serif text-16 leading-[1.6] text-ink">
            {form === "expression"
              ? covered
                ? missing.length === 0 && !dflt
                  ? "every constant has a case, so no default is needed. add a new constant to Size later and this stops compiling until you handle it. that's a feature."
                  : "the default catches whatever the cases don't, so every input has an answer."
                : `an expression has to produce a value for every Size. ${missing.join(" and ")} would have none, so javac refuses.`
              : missing.length && !dflt
                ? `an old-style statement is allowed to ignore ${missing.join(" and ")}: those values just fall out the bottom and nothing happens. silently.`
                : "a statement compiles either way. it just isn't checked for you."}
          </p>
        </div>
      </div>
    </div>
  );
}
