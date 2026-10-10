"use client";

import { useState } from "react";
import { Java } from "@/components/figures/basics/kit";

// what `var` actually infers. every type below is what jshell 25's /vars printed for the
// exact declaration on the left.

const DECLS: { code: string; type: string; note: string; tone?: "hot" | "dead" }[] = [
  { code: "var count = 10;", type: "int", note: "an int literal, so int. the type is fixed from here on." },
  { code: "var big = 10L;", type: "long", note: "the L makes the literal a long." },
  { code: "var ratio = 10 / 4;", type: "int", note: "int / int is int division, so the type is int and the value is 2. var doesn't make the math any smarter.", tone: "hot" },
  { code: "var price = 9.99;", type: "double", note: "any decimal literal is a double." },
  { code: "var c = 'a' + 1;", type: "int", note: "char + int is an int (98), not a char.", tone: "hot" },
  { code: "var s = (short) 1;", type: "short", note: "the cast decides the type." },
  { code: 'var name = "duke";', type: "String", note: "a String, exactly like writing String name = \"duke\";" },
  { code: "var list = new ArrayList<String>();", type: "ArrayList<String>", note: "the exact class on the right, ArrayList, not the List interface you might have written by hand.", tone: "hot" },
  { code: "var empty = new ArrayList<>();", type: "ArrayList<Object>", note: "with a diamond and nothing to infer from, the type argument falls back to Object. you lose the String you meant.", tone: "dead" },
  { code: 'var map = Map.of("a", 1);', type: "Map<String,Integer>", note: "inferred from the method's return type, generics included." },
  { code: "var nums = new int[] {1, 2};", type: "int[]", note: "fine. it's only the bare {1, 2} initializer that var can't handle." },
  {
    code: "var anon = new Object() { int hits = 3; };",
    type: "<anonymous class extending Object>",
    note: "a type you can't even write. and since var keeps it, anon.hits works (it's 3). with Object anon = ..., it wouldn't compile.",
    tone: "hot",
  },
  {
    code: 'var maybe = true ? 1 : "one";',
    type: "Serializable&Comparable<? extends Serializable&Comparable<?>&Constable&ConstantDesc>&Constable&ConstantDesc",
    note: "the closest common type of Integer and String, spelled out. var will happily infer something nobody would ever write.",
    tone: "dead",
  },
];

export function VarInspector() {
  const [sel, setSel] = useState(7);
  const cur = DECLS[sel];
  return (
    <div className="font-mono text-13">
      <div className="overflow-x-auto rounded-md bg-well py-2 shadow-[inset_0_0_0_1px_var(--line)]" role="list">
        {DECLS.map((d, i) => (
          <button
            key={d.code}
            role="listitem"
            onClick={() => setSel(i)}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            className="grid w-full min-w-max grid-cols-[minmax(0,auto)_1fr] gap-x-6 border-l-2 px-[14px] py-[3px] text-left text-12 leading-[1.7] transition-colors duration-150 sm:text-13"
            style={{
              borderColor: i === sel ? "var(--hot)" : "transparent",
              background: i === sel ? "color-mix(in srgb, var(--hot) 9%, transparent)" : undefined,
            }}
          >
            <span className="whitespace-pre">
              <Java code={d.code} />
            </span>
            <span className="hidden truncate text-right text-11 text-faint md:block">{i === sel ? "" : d.type.length > 28 ? d.type.slice(0, 26) + "…" : d.type}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-1.5" aria-live="polite">
        <div className="text-11 text-faint">javac infers</div>
        <div className="text-14 break-all" style={{ color: cur.tone ? `var(--${cur.tone})` : "var(--hi)" }}>
          {cur.type}
        </div>
        <p className="font-serif text-16 leading-[1.6] text-ink">{cur.note}</p>
      </div>
    </div>
  );
}
