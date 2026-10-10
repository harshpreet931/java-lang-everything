"use client";

import { useState } from "react";
import { Java } from "@/components/figures/basics/kit";

// every place you might try `var`, and what javac 25 says. the errors are copied from real
// compiles (first line, plus javac's explanation in parentheses where it gives one).

const SPOTS: { where: string; code: string; ok: boolean; err?: string; why: string }[] = [
  { where: "local variable", code: "var count = 0;", ok: true, why: "the one job var was made for (java 10)." },
  { where: "for loop", code: "for (var i = 0; i < 3; i++) { }", ok: true, why: "a local variable, so yes." },
  { where: "for-each", code: 'for (var s : List.of("a")) { }', ok: true, why: "also a local. s is a String." },
  { where: "try-with-resources", code: 'try (var in = new StringReader("x")) { }', ok: true, why: "the resource is a local too." },
  { where: "lambda parameters", code: "(var x, var y) -> x + y", ok: true, why: "since java 11, mostly so you can annotate them: (@NonNull var x, var y) -> ..." },
  { where: "field", code: "class C { var count = 0; }", ok: false, err: "'var' is not allowed here", why: "fields are part of the class's API. their type should be written down, not inferred." },
  { where: "parameter", code: "void f(var x) { }", ok: false, err: "'var' is not allowed here", why: "there's nothing to infer from: a parameter has no initializer, its value comes from callers." },
  { where: "return type", code: "var f() { return 1; }", ok: false, err: "'var' is not allowed here", why: "a method's signature is a contract. it stays explicit." },
  { where: "no initializer", code: "var x;", ok: false, err: "cannot infer type for local variable x (cannot use 'var' on variable without initializer)", why: "no right-hand side, nothing to infer from." },
  { where: "null", code: "var x = null;", ok: false, err: "cannot infer type for local variable x (variable initializer is 'null')", why: "null fits every reference type, so it says nothing about which one you meant." },
  { where: "lambda", code: "var g = () -> 1;", ok: false, err: "cannot infer type for local variable g (lambda expression needs an explicit target-type)", why: "a lambda needs to know its functional interface first. Supplier<Integer>? IntSupplier? var can't guess." },
  { where: "method reference", code: "var m = String::length;", ok: false, err: "cannot infer type for local variable m (method reference needs an explicit target-type)", why: "same problem as a lambda." },
  { where: "array initializer", code: "var a = {1, 2};", ok: false, err: "cannot infer type for local variable a (array initializer needs an explicit target-type)", why: "{1, 2} alone could be int[], long[], Integer[]... write new int[] {1, 2}." },
  { where: "two at once", code: "var a = 1, b = 2;", ok: false, err: "'var' is not allowed in a compound declaration", why: "one var per declaration." },
  { where: "array type", code: "var[] a = new int[1];", ok: false, err: "'var' is not allowed as an element type of an array", why: "var stands for the whole type, int[] included. just var a = new int[1]." },
  { where: "catch", code: "catch (var e) { }", ok: false, err: "'var' is not allowed here", why: "the catch clause is where you choose the exception type. that's the point of it." },
  { where: "mixing in lambdas", code: "(var x, y) -> x + y", ok: false, err: "invalid lambda parameter declaration", why: "lambda parameters are all var, all typed, or all bare. no mixing." },
];

export function VarWhere() {
  const [sel, setSel] = useState(6);
  const cur = SPOTS[sel];
  return (
    <div className="font-mono text-13">
      <div className="flex flex-wrap gap-1" role="group" aria-label="places to try var">
        {SPOTS.map((s, i) => (
          <button
            key={s.where}
            className="word !min-h-7 !px-2 !text-12"
            aria-pressed={i === sel}
            onClick={() => setSel(i)}
            style={i === sel ? undefined : { color: s.ok ? "var(--live)" : "var(--dead)" }}
          >
            {s.ok ? "✓" : "✗"} {s.where}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-md bg-well px-4 py-3 text-13 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div className="whitespace-pre">
          <Java code={cur.code} />
        </div>
        <div className="mt-2 text-12 leading-[1.6]" style={{ color: cur.ok ? "var(--live)" : "var(--dead)" }}>
          {cur.ok ? "compiles." : `error: ${cur.err}`}
        </div>
      </div>
      <p className="mt-3 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink">{cur.why}</p>
    </div>
  );
}
