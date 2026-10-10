"use client";

import { useState } from "react";
import { CodePanel, Java, Narrate, ring, tint } from "../functional/kit";

// `record Point(int x, int y) {}` and the class javac turns it into.
// the javap -p lines on the right are verbatim from javac 25; the expanded source on
// the left is that class written back out as java (equals/hashCode/toString are
// really an invokedynamic to java.lang.runtime.ObjectMethods, not hand-written code).

const EXPANDED = `public final class Point extends java.lang.Record {
    private final int x;
    private final int y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int x() { return x; }
    public int y() { return y; }

    public final boolean equals(Object o) { /* compare x, y */ }
    public final int hashCode() { /* mix x, y */ }
    public final String toString() { /* "Point[x=1, y=2]" */ }
}`;

const JAVAP = [
  "public final class Point extends java.lang.Record {",
  "  private final int x;",
  "  private final int y;",
  "  public Point(int, int);",
  "  public final java.lang.String toString();",
  "  public final int hashCode();",
  "  public final boolean equals(java.lang.Object);",
  "  public int x();",
  "  public int y();",
  "}",
];

type M = { id: string; label: string; lines: number[]; javap: number[]; note: string };
const MEMBERS: M[] = [
  { id: "class", label: "final class", lines: [1, 16], javap: [0], note: "a record is a final class that extends java.lang.Record. you can't extend it, and it can't extend anything else (it can implement interfaces)." },
  { id: "fields", label: "fields", lines: [2, 3], javap: [1, 2], note: "one private final field per component, and no others: a record can't declare extra instance fields. that's what makes it 'just its data'." },
  { id: "ctor", label: "canonical constructor", lines: [5, 6, 7, 8], javap: [3], note: "takes every component in order and assigns the fields. you can write a compact version of it to validate, without repeating the assignments." },
  { id: "acc", label: "accessors", lines: [10, 11], javap: [7, 8], note: "x() and y(), not getX(). same name as the component, and you can override them (rarely a good idea)." },
  { id: "eq", label: "equals", lines: [13], javap: [6], note: "two Points are equal if their components are equal. value semantics, not identity: new Point(1, 2).equals(new Point(1, 2)) is true." },
  { id: "hash", label: "hashCode", lines: [14], javap: [5], note: "consistent with equals, computed from the components. so records just work as HashMap keys and in HashSets." },
  { id: "str", label: "toString", lines: [15], javap: [4], note: "Point[x=1, y=2]. all three are generated at runtime through invokedynamic and ObjectMethods.bootstrap, so the class file stays tiny." },
];

export function RecordExpansion() {
  const [sel, setSel] = useState("fields");
  const m = MEMBERS.find((x) => x.id === sel)!;
  return (
    <div className="@container grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-md px-3 py-1.5 text-14" style={{ boxShadow: ring("hot", 60), background: tint("hot", 6) }}>
          <Java code="record Point(int x, int y) {}" />
        </span>
        <span className="text-12 text-faint">expands to ↓</span>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="generated member">
        {MEMBERS.map((x) => (
          <button key={x.id} className="word" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        <CodePanel file="what javac writes for you" code={EXPANDED} hot={m.lines} />
        <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">$ javap -p Point.class</div>
          <pre className="overflow-x-auto py-3 text-12 leading-[1.75]">
            {JAVAP.map((l, i) => (
              <div
                key={i}
                className="border-l-2 px-4 transition-colors duration-200"
                style={{
                  borderColor: m.javap.includes(i) ? "var(--hot)" : "transparent",
                  background: m.javap.includes(i) ? tint("hot", 10) : undefined,
                  color: m.javap.includes(i) ? "var(--hot)" : "var(--mute)",
                }}
              >
                {l}
              </div>
            ))}
          </pre>
        </div>
      </div>
      <Narrate>{m.note}</Narrate>
    </div>
  );
}
