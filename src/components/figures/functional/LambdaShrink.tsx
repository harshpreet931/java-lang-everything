"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Narrate, tint } from "./kit";

// an anonymous Comparator shrinking into a lambda, one removable piece at a time.
// every frame is legal java (checked with javac 25), except the in-between frames
// that are marked as "not valid yet".
//   [text, mark]  mark: "x" = about to be removed (dead, struck), "+" = just added (hot)

type Seg = [string, ("x" | "+")?];
type Frame = { segs: Seg[]; note: string; valid: boolean };

const FRAMES: Frame[] = [
  {
    segs: [
      ["Comparator<String> byLength = "],
      ["new Comparator<String>() {", "x"],
      ["\n    "],
      ["@Override", "x"],
      ["\n    public int compare(String a, String b) {\n        return Integer.compare(a.length(), b.length());\n    }\n"],
      ["}", "x"],
      [";"],
    ],
    note: "an anonymous class. the left side already says Comparator<String>, so the wrapper in red is ceremony.",
    valid: true,
  },
  {
    segs: [
      ["Comparator<String> byLength =\n    "],
      ["public int compare", "x"],
      ["(String a, String b) {\n        return Integer.compare(a.length(), b.length());\n    };"],
    ],
    note: "Comparator has exactly one abstract method, so its name, return type and modifiers are implied too.",
    valid: false,
  },
  {
    segs: [
      ["Comparator<String> byLength =\n    ("],
      ["String ", "x"],
      ["a, "],
      ["String ", "x"],
      ["b)"],
      [" ->", "+"],
      [" {\n        return Integer.compare(a.length(), b.length());\n    };"],
    ],
    note: "add an arrow and this is already a legal lambda. the parameter types come from Comparator<String>, so they can go.",
    valid: true,
  },
  {
    segs: [
      ["Comparator<String> byLength =\n    (a, b) -> "],
      ["{", "x"],
      ["\n        "],
      ["return ", "x"],
      ["Integer.compare(a.length(), b.length())"],
      [";\n    }", "x"],
      [";"],
    ],
    note: "a body that is a single expression doesn't need braces, return, or its own semicolon.",
    valid: true,
  },
  {
    segs: [["Comparator<String> byLength = (a, b) -> Integer.compare(a.length(), b.length());"]],
    note: "same object, same behaviour. 6 lines became 1. (Comparator.comparingInt(String::length) is shorter still, see method references.)",
    valid: true,
  },
];

const chars = (f: Frame) => f.segs.map((s) => s[0]).join("").replace(/\s+/g, " ").trim().length;

export function LambdaShrink() {
  const s = useStepper(FRAMES.length, { interval: 2200 });
  const f = FRAMES[s.i];

  return (
    <div {...s.keys} className="outline-none">
      <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-4 text-12">
          <span className="text-ink">Main.java</span>
          <span className="flex items-center gap-3 text-11 tabular">
            <span className="text-faint">{chars(f)} chars</span>
            <span style={{ color: f.valid ? "var(--live)" : "var(--dead)" }}>{f.valid ? "compiles" : "not valid yet"}</span>
          </span>
        </div>
        <pre className="min-h-[11.5em] overflow-x-auto px-4 py-3.5 text-13 leading-[1.75]" aria-live="polite">
          {f.segs.map(([t, m], i) =>
            m === "x" ? (
              <span
                key={i}
                className="rounded-[1px] line-through decoration-1"
                style={{ background: tint("dead", 16), color: "var(--dead)", textDecorationColor: "var(--dead)" }}
              >
                {t}
              </span>
            ) : m === "+" ? (
              <span key={i} className="rounded-[1px]" style={{ background: tint("hot", 18), color: "var(--hot)" }}>
                {t}
              </span>
            ) : (
              <Java key={i} code={t} />
            ),
          )}
        </pre>
      </div>
      <Narrate className="mt-4">{f.note}</Narrate>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
