"use client";

import { useState } from "react";
import { Console } from "./kit";

// every cell below was run on jdk 25 (temurin 25.0.4). "ok" = no exception.
// UOE = UnsupportedOperationException, NPE = NullPointerException.

type R = "ok" | "UOE" | "NPE";
type Fac = { name: string; code: string; nullCode: string; kind: string; cells: R[]; sees: boolean | null; note: string };
const OPS = ["add(x)", "set(0, x)", "remove(0)", "sort(…)", "null inside", "contains(null)"];
const OPCODE = ['list.add("c")', 'list.set(0, "z")', "list.remove(0)", "list.sort(null)", '…("a", null)', "list.contains(null)"];

const FACS: Fac[] = [
  { name: "new ArrayList<>(…)", code: 'new ArrayList<>(List.of("a", "b"))', nullCode: "new ArrayList<>(Arrays.asList(\"a\", null))", kind: "mutable", cells: ["ok", "ok", "ok", "ok", "ok", "ok"], sees: null, note: "a plain mutable list. your copy, do what you like." },
  { name: "List.of(…)", code: 'List.of("a", "b")', nullCode: "List.of(\"a\", null)", kind: "immutable", cells: ["UOE", "UOE", "UOE", "UOE", "NPE", "NPE"], sees: null, note: "truly immutable, and allergic to null: it won't store one, and contains(null) throws instead of returning false." },
  { name: "List.copyOf(src)", code: "List.copyOf(src)", nullCode: "List.copyOf(Arrays.asList(\"a\", null))", kind: "immutable copy", cells: ["UOE", "UOE", "UOE", "UOE", "NPE", "NPE"], sees: false, note: "an immutable snapshot. later changes to src don't show up. if src is already an immutable list, you get the same object back." },
  { name: "Collections.unmodifiableList(src)", code: "Collections.unmodifiableList(src)", nullCode: "Collections.unmodifiableList(Arrays.asList(\"a\", null))", kind: "read-only view", cells: ["UOE", "UOE", "UOE", "UOE", "ok", "ok"], sees: true, note: "a view, not a copy. you can't write through it, but whoever holds src can, and the view shows every change." },
  { name: "Arrays.asList(…)", code: 'Arrays.asList("a", "b")', nullCode: "Arrays.asList(\"a\", null)", kind: "fixed-size view", cells: ["UOE", "ok", "UOE", "ok", "ok", "ok"], sees: true, note: "a list wrapped around the array itself. size is fixed, but set and sort work, and they write straight into the array (and vice versa)." },
  { name: "stream.toList()", code: 'Stream.of("a", "b").toList()', nullCode: "Stream.of(\"a\", null).toList()", kind: "unmodifiable", cells: ["UOE", "UOE", "UOE", "UOE", "ok", "ok"], sees: false, note: "java 16+. unmodifiable like List.of, but nulls are allowed." },
  { name: "collect(Collectors.toList())", code: "….collect(Collectors.toList())", nullCode: "Stream.of(\"a\", null).collect(Collectors.toList())", kind: "mutable (today)", cells: ["ok", "ok", "ok", "ok", "ok", "ok"], sees: false, note: "an ArrayList today, but the javadoc promises nothing about mutability. don't rely on either." },
];

export function MutabilityGrid() {
  const [cell, setCell] = useState<[number, number]>([1, 0]);
  const f = FACS[cell[0]];
  const r = f.cells[cell[1]];
  const tone = (x: R) => (x === "ok" ? "var(--live)" : "var(--dead)");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-mono text-12 [&_td]:align-middle [&_th]:font-mono [&_th]:text-11">
          <thead>
            <tr>
              <th className="py-1.5 pr-3 text-left font-normal text-faint">list made by</th>
              {OPS.map((o) => (
                <th key={o} className="px-1 py-1.5 text-center font-normal whitespace-nowrap text-faint">
                  {o}
                </th>
              ))}
              <th className="px-1 py-1.5 text-center font-normal whitespace-nowrap text-faint">sees src changes</th>
            </tr>
          </thead>
          <tbody>
            {FACS.map((fac, i) => (
              <tr key={fac.name} className="border-t border-line">
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  <span className="text-hi">{fac.name}</span>
                </td>
                {fac.cells.map((c, j) => {
                  const sel = cell[0] === i && cell[1] === j;
                  return (
                    <td key={j} className="px-1 py-1 text-center">
                      <button
                        onClick={() => setCell([i, j])}
                        aria-pressed={sel}
                        aria-label={`${fac.name}, ${OPS[j]}: ${c}`}
                        className="inline-flex min-h-7 min-w-[5ch] items-center justify-center rounded-xs px-1.5 text-11 transition-[box-shadow] duration-150"
                        style={{
                          color: tone(c),
                          background: sel ? `color-mix(in srgb, ${tone(c)} 14%, var(--bg))` : "transparent",
                          boxShadow: sel ? `inset 0 0 0 1px ${tone(c)}` : "inset 0 0 0 1px var(--line)",
                        }}
                      >
                        {c}
                      </button>
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center text-11 text-mute">{fac.sees === null ? "·" : fac.sees ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Console label="click any cell" minH="4.4em">
        {cell[1] === 4 ? (
          <span className="text-ink">{`var list = ${f.nullCode};`}</span>
        ) : (
          <>
            <span className="text-faint">{`var list = ${f.code};\n`}</span>
            <span className="text-ink">{OPCODE[cell[1]]}</span>
          </>
        )}
        <span className="text-faint">{"  // → "}</span>
        <span style={{ color: tone(r) }}>{r === "ok" ? "fine" : r === "UOE" ? "UnsupportedOperationException" : "NullPointerException"}</span>
        {"\n"}
        <span className="say text-mute">
          <span className="text-hi">{f.kind}.</span> {f.note}
        </span>
      </Console>
    </div>
  );
}
