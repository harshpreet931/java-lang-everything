"use client";

import { useState } from "react";
import { Java, Row, Verdict, Words, ring } from "./kit";

// one lambda, six possible targets. the lambda has no type of its own: the
// target decides what it means, or whether it means anything at all.
// every error is the real first line javac 25 prints for that declaration.

type T = {
  id: string;
  type: string;
  ok: boolean;
  sam?: string;
  says: string;
  err?: string[];
};

const TARGETS: T[] = [
  {
    id: "predicate",
    type: "Predicate<String>",
    ok: true,
    sam: "boolean test(String s)",
    says: "the lambda becomes the body of test. s is a String, the result is a boolean. a perfect fit.",
  },
  {
    id: "function",
    type: "Function<String, Boolean>",
    ok: true,
    sam: "Boolean apply(String s)",
    says: "same text, different object. now it's an apply that returns a boxed Boolean (the boolean gets autoboxed).",
  },
  {
    id: "wrongret",
    type: "Function<String, Integer>",
    ok: false,
    sam: "Integer apply(String s)",
    says: "the shape matches (one argument in, something out), but the body returns a boolean.",
    err: ["error: incompatible types: bad return type in lambda expression", "    boolean cannot be converted to Integer"],
  },
  {
    id: "supplier",
    type: "Supplier<Boolean>",
    ok: false,
    sam: "Boolean get()",
    says: "get takes no arguments. the lambda wants one.",
    err: ["error: incompatible types: incompatible parameter types in lambda expression"],
  },
  {
    id: "object",
    type: "Object",
    ok: false,
    says: "Object isn't an interface with one abstract method, so there's nothing for the lambda to become.",
    err: ["error: incompatible types: Object is not a functional interface"],
  },
  {
    id: "var",
    type: "var",
    ok: false,
    says: "var asks the right side for a type. a lambda doesn't have one to give. stalemate.",
    err: ["error: cannot infer type for local variable f", "  (lambda expression needs an explicit target-type)"],
  },
];

export function TargetTyping() {
  const [id, setId] = useState("predicate");
  const t = TARGETS.find((x) => x.id === id)!;

  return (
    <div className="@container grid gap-5">
      <div>
        <Row k="target =" w="9ch" last>
          <Words options={TARGETS.map((x) => ({ v: x.id, label: x.type }))} value={id} onChange={setId} label="target type" />
        </Row>
      </div>

      <div className="rounded-md bg-well px-4 py-4 text-13 shadow-[inset_0_0_0_1px_var(--line)] @[560px]:px-5">
        <div className="overflow-x-auto whitespace-pre">
          <span
            className="rounded-[1px] px-1 py-0.5 transition-[box-shadow,color] duration-200 ease-jle"
            style={{ boxShadow: ring(t.ok ? "hot" : "dead", 60) }}
          >
            <Java code={t.type} />
          </span>
          <Java code={" f = "} />
          <span className="rounded-[1px] px-1 py-0.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <Java code={"s -> s.isEmpty()"} />
          </span>
          <Java code=";" />
        </div>

        <div className="mt-4 grid gap-2 border-t border-line pt-3.5 text-12 @[560px]:grid-cols-[16ch_minmax(0,1fr)]">
          <span className="text-faint">its one method</span>
          <span className="min-w-0 overflow-x-auto whitespace-pre">
            {t.sam ? <Java code={t.sam} /> : <span className="text-dead">none</span>}
          </span>
          <span className="text-faint">the lambda is</span>
          <span className="min-w-0 overflow-x-auto whitespace-pre">
            {t.ok && t.sam ? (
              <Java code={`${t.sam.replace(/\(.*\)/, "(String s)")} { return s.isEmpty(); }`} />
            ) : (
              <span className="text-faint">nothing. it doesn&apos;t compile.</span>
            )}
          </span>
        </div>
      </div>

      <Verdict ok={t.ok}>{t.err ? <span className="text-dead">{t.err.join("\n")}</span> : null}</Verdict>
      <p className="-mt-1 font-serif text-17 leading-[1.6] text-ink" aria-live="polite">{t.says}</p>
    </div>
  );
}
