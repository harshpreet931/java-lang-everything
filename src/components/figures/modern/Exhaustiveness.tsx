"use client";

import { useState } from "react";
import { CodePanel, Narrate, Row, Verdict, Words } from "../functional/kit";

// toggle the cases of a switch over a sealed interface and see what javac says.
// every combination was compiled with javac 25 (with and without Triangle in the
// permits clause): a switch expression is accepted iff it has a default, or a
// case for every permitted subtype. the error texts are verbatim.

type Case = "Circle" | "Square" | "Rect" | "Triangle" | "default";
const LINE: Record<Case, string> = {
  Circle: '        case Circle c -> "circle";',
  Square: '        case Square q -> "square";',
  Rect: '        case Rect r -> "rect";',
  Triangle: '        case Triangle t -> "triangle";',
  default: '        default -> "something else";',
};

export function Exhaustiveness() {
  const [tri, setTri] = useState(false);
  const [on, setOn] = useState<Record<Case, boolean>>({ Circle: true, Square: true, Rect: false, Triangle: false, default: false });
  const permitted: Case[] = tri ? ["Circle", "Square", "Rect", "Triangle"] : ["Circle", "Square", "Rect"];
  const cases = ([...permitted, "default"] as Case[]).filter((c) => on[c]);
  const missing = permitted.filter((c) => !on[c]);
  const ok = cases.length > 0 && (on.default || missing.length === 0);

  const code = [
    `sealed interface Shape permits ${permitted.join(", ")} {}`,
    "record Circle(double r) implements Shape {}",
    "record Square(double side) implements Shape {}",
    "non-sealed class Rect implements Shape {}",
    ...(tri ? ["record Triangle(double b, double h) implements Shape {}"] : []),
    "",
    "String name(Shape shape) {",
    "    return switch (shape) {",
    ...cases.map((c) => LINE[c]),
    "    };",
    "}",
  ].join("\n");
  const switchLine = tri ? 8 : 7;

  const note = !cases.length
    ? "a switch expression has to produce a value, so it needs at least one case."
    : ok && on.default && missing.length
      ? `it compiles, because default catches everything. ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} silently lumped in with it. add a new subtype tomorrow and this switch won't tell you.`
      : ok && on.default
        ? "every subtype is covered, and the default can never run. it's legal, but it switches off the check you'd want the next time someone adds a subtype."
        : ok
          ? `every permitted subtype has a case, so the compiler knows nothing can fall through. no default needed${tri ? "" : ". now try adding Triangle to the hierarchy"}.`
          : `${missing.join(", ")} ${missing.length > 1 ? "aren't" : "isn't"} handled, and because Shape is sealed, javac knows exactly what's missing.`;

  return (
    <div className="grid gap-4">
      <div>
        <Row k="hierarchy =" w="12ch">
          <Words
            options={[
              { v: "3", label: "Circle, Square, Rect" },
              { v: "4", label: "+ Triangle" },
            ]}
            value={tri ? "4" : "3"}
            onChange={(v) => setTri(v === "4")}
            label="permitted subtypes"
          />
        </Row>
        <Row k="cases =" w="12ch" last>
          <div className="flex flex-wrap gap-1" role="group" aria-label="cases in the switch">
            {([...permitted, "default"] as Case[]).map((c) => (
              <button key={c} className="word" aria-pressed={on[c]} onClick={() => setOn((o) => ({ ...o, [c]: !o[c] }))}>
                {c === "default" ? "default" : `case ${c}`}
              </button>
            ))}
          </div>
        </Row>
      </div>
      <CodePanel file="Main.java" code={code} dead={ok ? [] : [switchLine]} live={ok ? [switchLine] : []} />
      <Verdict ok={ok}>
        {ok ? null : (
          <span className="text-dead">
            {cases.length
              ? `Main.java:${switchLine}: error: the switch expression does not cover all possible input values`
              : `Main.java:${switchLine}: error: switch expression does not have any case clauses`}
          </span>
        )}
      </Verdict>
      <Narrate>{note}</Narrate>
    </div>
  );
}
