"use client";

import { useState } from "react";
import { CodePanel, Narrate, Row, Verdict, Words } from "../functional/kit";

// where is the pattern variable s in scope? flow scoping: s exists exactly where
// the compiler can prove the instanceof matched. each shape was compiled with javac 25;
// the failing ones fail with "error: cannot find symbol" on the marked line.

type Shape = { id: string; label: string; code: string; live: number[]; dead?: number; note: string };

const SHAPES: Shape[] = [
  {
    id: "if",
    label: "if",
    code: `if (o instanceof String s) {
    IO.println(s.length());     // s is here
}
// s is not here`,
    live: [2],
    note: "the simple case. s exists inside the block, where the test is known to be true, and nowhere else.",
  },
  {
    id: "and",
    label: "&&",
    code: `if (o instanceof String s && s.length() > 3) {
    IO.println(s);
}`,
    live: [1, 2],
    note: "&& only evaluates its right side when the left side was true, so s is already bound there. this is the shape you'll write most.",
  },
  {
    id: "or",
    label: "||",
    code: `if (o instanceof String s || s.length() > 3) {
    IO.println("hmm");
}`,
    live: [],
    dead: 1,
    note: "|| evaluates its right side only when the left side was false, which is exactly when s didn't match. javac refuses: there's no s to talk about.",
  },
  {
    id: "early",
    label: "if (!...) return",
    code: `if (!(o instanceof String s)) {
    return 0;
}
return s.length();              // s is here!`,
    live: [4],
    note: "the clever one. if the test failed, the method returned. so every line after the if knows the test passed, and s is in scope for the rest of the method. great for guard clauses.",
  },
  {
    id: "noreturn",
    label: "if (!...) no return",
    code: `if (!(o instanceof String s)) {
    IO.println("not a string");
}
return s.length();`,
    live: [],
    dead: 4,
    note: "same shape without the return: execution can reach line 4 either way, so the match isn't guaranteed, and s isn't in scope.",
  },
  {
    id: "else",
    label: "else",
    code: `if (o instanceof String s) {
    return 1;
} else {
    return s.length();
}`,
    live: [],
    dead: 4,
    note: "the else branch is where the test failed. s would be meaningless here, so it doesn't exist. (flip the test with ! and it's the other way around.)",
  },
];

export function ScopeLab() {
  const [id, setId] = useState("early");
  const s = SHAPES.find((x) => x.id === id)!;
  const ok = s.dead === undefined;
  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="shape =" w="8ch" last>
          <Words options={SHAPES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="code shape" />
        </Row>
      </div>
      <CodePanel
        file="Main.java"
        code={s.code}
        live={s.live}
        dead={ok ? [] : [s.dead!]}
        notes={ok ? undefined : { [s.dead!]: { text: "← cannot find symbol", tone: "dead" } }}
      />
      <Verdict ok={ok}>
        {ok ? null : (
          <span className="text-dead">
            Main.java:{s.dead}: error: cannot find symbol{"\n"}  symbol:   variable s
          </span>
        )}
      </Verdict>
      <Narrate minH="4.6em">{s.note}</Narrate>
    </div>
  );
}
