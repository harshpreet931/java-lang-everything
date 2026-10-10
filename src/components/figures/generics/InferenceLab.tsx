"use client";

import { useState } from "react";
import { Chip, Java, Narrate, Row, Words, ring, tint } from "../functional/kit";

// how javac picks E for List.of(...): bounds from the arguments, bounds from the
// target, then one answer. every result below was checked against javac 25 by
// compiling the line (and, for var, calling a missing method on the variable so the
// error message prints the inferred type). intersection types are shortened to
// "Number & Comparable<...> & ..." from javac's INT#1 notation.

type Case = {
  id: string;
  label: string;
  code: string;
  args: string[];
  target?: string;
  result: string;
  ok: boolean;
  err?: string[];
  note: string;
};

const NUM_LUB = "Number & Comparable<...> & Constable & ConstantDesc";
const OBJ_LUB = "Object & Serializable & Comparable<...> & Constable & ConstantDesc";

const CASES: Case[] = [
  {
    id: "same",
    label: '("x", "y")',
    code: 'var a = List.of("x", "y");',
    args: ["String", "String"],
    result: "String",
    ok: true,
    note: "both arguments are Strings, nothing else has an opinion. E = String, so a is a List<String>.",
  },
  {
    id: "mixnum",
    label: "(1, 2.0)",
    code: "var b = List.of(1, 2.0);",
    args: ["Integer", "Double"],
    result: NUM_LUB,
    ok: true,
    note: "an Integer and a Double. E has to be a supertype of both, so javac computes their least upper bound: everything they have in common. that's not just Number, it's Number and three interfaces both happen to implement.",
  },
  {
    id: "mixobj",
    label: '("x", 1)',
    code: 'var c = List.of("x", 1);',
    args: ["String", "Integer"],
    result: OBJ_LUB,
    ok: true,
    note: "a String and an Integer share even less: Object, plus Serializable, Comparable and the two constant-descriptor interfaces. legal, and a type you could never write yourself.",
  },
  {
    id: "tnum",
    label: "List<Number> = (1, 2.0)",
    code: "List<Number> d = List.of(1, 2.0);",
    args: ["Integer", "Double"],
    target: "List<Number>",
    result: "Number",
    ok: true,
    note: "now the target has a say. List<E> must be a List<Number>, and generics are invariant, so E must be exactly Number. both arguments fit under Number, so it works.",
  },
  {
    id: "tstr",
    label: 'List<String> = ("x", 1)',
    code: 'List<String> f = List.of("x", 1);',
    args: ["String", "Integer"],
    target: "List<String>",
    result: "",
    ok: false,
    err: [
      "error: incompatible types: inference variable E has incompatible bounds",
      "    equality constraints: String",
      "    lower bounds: Integer,String",
    ],
    note: "the target says E is exactly String. the 1 says E is at least Integer. no type is both, and javac lists the bounds it couldn't reconcile.",
  },
  {
    id: "tempty",
    label: "List<String> = ()",
    code: "List<String> g = List.of();",
    args: [],
    target: "List<String>",
    result: "String",
    ok: true,
    note: "no arguments at all, so the only clue is the target. this is target typing, and it's been this general since java 8.",
  },
  {
    id: "vempty",
    label: "var = ()",
    code: "var h = List.of();",
    args: [],
    result: "Object",
    ok: true,
    note: "no arguments and no target (var asks the right side for its type). with zero clues, E falls back to its bound, Object. h is a List<Object>.",
  },
  {
    id: "witness",
    label: "List.<Number>of(1, 2)",
    code: "var i = List.<Number>of(1, 2);",
    args: ["Integer", "Integer"],
    target: "<Number> (witness)",
    result: "Number",
    ok: true,
    note: "an explicit type witness skips inference: you say E out loud. rarely needed, but it's the escape hatch when inference picks something you didn't want.",
  },
];

function Clues({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="grid content-start gap-1.5 rounded-md bg-well px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <span className="text-11 text-faint">{title}</span>
      <div className="flex min-h-[22px] flex-wrap gap-1">
        {items.length ? items.map((t, i) => <Chip key={i}>{t}</Chip>) : <span className="text-12 text-faint">{empty}</span>}
      </div>
    </div>
  );
}

export function InferenceLab() {
  const [id, setId] = useState("mixnum");
  const c = CASES.find((x) => x.id === id)!;

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="List.of" w="7ch" last>
          <Words options={CASES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="which call" />
        </Row>
      </div>

      <div className="overflow-x-auto rounded-md bg-bg px-4 py-3 text-13 whitespace-pre shadow-[inset_0_0_0_1px_var(--line-2)]">
        <Java code={c.code} />
      </div>

      <div className="grid gap-2 @[560px]:grid-cols-2">
        <Clues
          title="from the arguments: E must hold all of"
          items={c.args}
          empty="no arguments, no clues"
        />
        <Clues
          title="from the target: E must be exactly"
          items={c.target ? [c.target.startsWith("<") ? `${c.target.slice(1, c.target.indexOf(">"))} (you said so)` : c.target.slice(5, -1)] : []}
          empty={c.code.startsWith("var") ? "var: no target" : "none"}
        />
      </div>

      <div
        className="rounded-md px-4 py-3 text-13 leading-[1.7]"
        style={{ boxShadow: ring(c.ok ? "live" : "dead", 55), background: tint(c.ok ? "live" : "dead", 6) }}
        aria-live="polite"
      >
        {c.ok ? (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-faint">E =</span>
            <span className="text-live">{c.result}</span>
          </div>
        ) : (
          <div className="overflow-x-auto whitespace-pre text-12 text-dead">{c.err!.join("\n")}</div>
        )}
      </div>

      <Narrate>{c.note}</Narrate>
    </div>
  );
}
