"use client";

import { useState } from "react";
import { Java, Narrate, Row, Words, ring, tint } from "../functional/kit";

// the same max(List<T>) written with two bounds, called with five element types.
// every verdict and error is javac 25's, from compiling exactly these calls.
// the class declarations are trimmed to the part that matters.

type Res = { ok: true } | { ok: false; err: string[] };
type T = { id: string; label: string; decl: string[]; strict: Res; loose: Res; note: string };

const TYPES: T[] = [
  {
    id: "string",
    label: "String",
    decl: ["final class String implements Comparable<String>, ..."],
    strict: { ok: true },
    loose: { ok: true },
    note: "String is comparable to String. T = String satisfies T extends Comparable<T> exactly, so both versions work.",
  },
  {
    id: "integer",
    label: "Integer",
    decl: ["final class Integer extends Number implements Comparable<Integer>, ..."],
    strict: { ok: true },
    loose: { ok: true },
    note: "same story: Integer compares itself to Integers. most of the JDK's value types look like this.",
  },
  {
    id: "date",
    label: "LocalDate",
    decl: ["final class LocalDate implements ChronoLocalDate, ...", "interface ChronoLocalDate extends Comparable<ChronoLocalDate>, ..."],
    strict: {
      ok: false,
      err: ["error: method max in class Main cannot be", "  applied to given types;", "  reason: inference variable T has incompatible", "    equality constraints ChronoLocalDate,LocalDate"],
    },
    loose: { ok: true },
    note: "LocalDate gets compareTo from its parent interface, so it's a Comparable<ChronoLocalDate>, not a Comparable<LocalDate>. the strict bound wants T to be both LocalDate and ChronoLocalDate. ? super T accepts a T that compares with a supertype.",
  },
  {
    id: "apple",
    label: "Apple",
    decl: ["class Fruit implements Comparable<Fruit> { ... }", "class Apple extends Fruit { }"],
    strict: {
      ok: false,
      err: ["error: method max in class Main cannot be", "  applied to given types;", "  reason: inference variable T has incompatible", "    equality constraints Fruit,Apple"],
    },
    loose: { ok: true },
    note: "your own code hits this the moment a subclass inherits compareTo. apples compare fine (by weight, from Fruit), but they're Comparable<Fruit>. only the ? super T version lets you find the biggest apple and get back an Apple.",
  },
  {
    id: "object",
    label: "Object",
    decl: ["class Object { }   // not Comparable at all"],
    strict: {
      ok: false,
      err: ["error: method max in class Main cannot be", "  applied to given types;", "  reason: inference variable T has incompatible bounds", "    equality constraints: Object", "    upper bounds: Comparable<T>"],
    },
    loose: {
      ok: false,
      err: ["error: method max in class Main cannot be", "  applied to given types;", "  reason: inference variable T has incompatible bounds", "    equality constraints: Object", "    upper bounds: Comparable<? super T>"],
    },
    note: "and the bound still does its job: a list of plain Objects has no compareTo to call, so neither version lets it in. ? super T loosens the bound, it doesn't remove it.",
  },
];

function Cell({ sig, res }: { sig: string; res: Res }) {
  return (
    <div
      className="grid min-w-0 content-start gap-2 rounded-md px-3.5 py-3"
      style={{ boxShadow: ring(res.ok ? "live" : "dead", 50), background: tint(res.ok ? "live" : "dead", 5) }}
    >
      <div className="overflow-x-auto text-12 whitespace-pre">
        <Java code={sig} />
      </div>
      <div className="text-12" style={{ color: res.ok ? "var(--live)" : "var(--dead)" }}>
        {res.ok ? "compiles" : "compile error"}
      </div>
      {!res.ok && <pre className="overflow-x-auto text-11 leading-[1.65] whitespace-pre text-ink">{res.err.join("\n")}</pre>}
    </div>
  );
}

export function BoundTester() {
  const [id, setId] = useState("date");
  const t = TYPES.find((x) => x.id === id)!;
  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="List of" w="8ch" last>
          <Words options={TYPES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="element type" />
        </Row>
      </div>
      <div className="grid gap-1 overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]">
        {t.decl.map((d, i) => (
          <Java key={i} code={d} />
        ))}
      </div>
      <div className="grid gap-2 @[600px]:grid-cols-2 @[600px]:gap-3">
        <Cell sig="<T extends Comparable<T>> T max(List<T> xs)" res={t.strict} />
        <Cell sig="<T extends Comparable<? super T>> T max(List<T> xs)" res={t.loose} />
      </div>
      <Narrate minH="4.6em">{t.note}</Narrate>
    </div>
  );
}
