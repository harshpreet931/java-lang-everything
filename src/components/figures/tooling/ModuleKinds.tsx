"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// the three kinds of module, per JEP 261 and java.lang.module.ModuleFinder's docs.
// "reads" here is readability: whether code in one can even see types in another.

type Kind = "named" | "automatic" | "unnamed";

const KINDS: { id: Kind; title: string; where: string; looks: string; gives: string }[] = [
  {
    id: "named",
    title: "named module",
    where: "module path",
    looks: "a jar with module-info.class",
    gives: "exactly the packages it exports. opens only what it opens.",
  },
  {
    id: "automatic",
    title: "automatic module",
    where: "module path",
    looks: "a plain jar, no module-info",
    gives: "every package, exported and open. it has no idea what's internal.",
  },
  {
    id: "unnamed",
    title: "unnamed module",
    where: "class path",
    looks: "every jar on -cp, mixed into one",
    gives: "every package, but no named module can say requires on it (it has no name).",
  },
];

const READS: Record<Kind, Record<Kind, [boolean, string]>> = {
  named: {
    named: [true, "only the ones it requires"],
    automatic: [true, "if it requires it, by its derived name"],
    unnamed: [false, "never. named modules can't see the class path"],
  },
  automatic: {
    named: [true, "all of them. no requires needed"],
    automatic: [true, "all of them"],
    unnamed: [true, "yes, the class path too. that's how old jars keep working"],
  },
  unnamed: {
    named: [true, "every module that got resolved"],
    automatic: [true, "every one that got resolved"],
    unnamed: [true, "it is the class path. one big module"],
  },
};

export function ModuleKinds() {
  const [from, setFrom] = useState<Kind>("named");
  return (
    <div className="@container">
      <Row k="code in a =" w="12ch" last>
        <Words
          label="pick the kind of module the code lives in"
          options={KINDS.map((k) => ({ v: k.id, label: k.id }))}
          value={from}
          onChange={setFrom}
        />
      </Row>
      <div className="mt-4 grid gap-2.5 @[620px]:grid-cols-3" aria-live="polite">
        {KINDS.map((k) => {
          const [ok, why] = READS[from][k.id];
          const self = k.id === from;
          return (
            <div
              key={k.id}
              className="flex min-w-0 flex-col rounded-md bg-bg p-3.5 transition-[box-shadow] duration-200 ease-jle"
              style={{
                boxShadow: `inset 0 0 0 1px ${self ? "var(--hi)" : "var(--line-2)"}`,
                borderStyle: "solid",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-13 text-hi">{k.title}</span>
                <span className="text-11 text-faint">{k.where}</span>
              </div>
              <div className="mt-1 text-12 text-mute">{k.looks}</div>
              <div className="mt-2 text-12 leading-[1.6] text-ink">
                <span className="text-faint">gives others: </span>
                {k.gives}
              </div>
              <div
                className="mt-auto flex items-baseline gap-2 border-t border-line pt-2.5 text-12 leading-[1.5]"
                style={{ color: ok ? "var(--ref)" : "var(--dead)", marginTop: 12 }}
              >
                <span className="shrink-0">{ok ? "→ reads" : "✗ blind"}</span>
                <span className="text-mute">{why}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
