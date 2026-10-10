"use client";

import { useState } from "react";
import { CodePanel, Narrate, Row, Words } from "../functional/kit";
import { Terminal } from "../generics/ui";

// a pattern switch, tested top to bottom against one input at a time. the results are
// what jdk 25 prints for this exact method (run with all eight inputs, and with the
// case null line removed for the NullPointerException).

type In = { id: string; label: string; kind: "null" | "int" | "str" | "arr" | "dbl" | "list"; n?: number; s?: string };
const INPUTS: In[] = [
  { id: "null", label: "null", kind: "null" },
  { id: "neg", label: "-3", kind: "int", n: -3 },
  { id: "int", label: "42", kind: "int", n: 42 },
  { id: "blank", label: '" "', kind: "str", s: " " },
  { id: "str", label: '"hi"', kind: "str", s: "hi" },
  { id: "arr", label: "new int[]{1, 2, 3}", kind: "arr" },
  { id: "dbl", label: "3.14", kind: "dbl" },
  { id: "list", label: "List.of(1)", kind: "list" },
];

type Case = { id: string; src: string; test: (x: In) => "match" | "type" | "guard"; why: string; out: (x: In) => string };
const CASES: Case[] = [
  { id: "null", src: 'case null                      -> "null";', test: (x) => (x.kind === "null" ? "match" : "type"), why: "not null", out: () => "null" },
  { id: "neg", src: 'case Integer i when i < 0      -> "negative int " + i;', test: (x) => (x.kind !== "int" ? "type" : x.n! < 0 ? "match" : "guard"), why: "i < 0 is false", out: (x) => `negative int ${x.n}` },
  { id: "int", src: 'case Integer i                 -> "int " + i;', test: (x) => (x.kind === "int" ? "match" : "type"), why: "", out: (x) => `int ${x.n}` },
  { id: "blank", src: 'case String s when s.isBlank() -> "blank string";', test: (x) => (x.kind !== "str" ? "type" : x.s!.trim() === "" ? "match" : "guard"), why: "s.isBlank() is false", out: () => "blank string" },
  { id: "str", src: 'case String s                  -> "string of length " + s.length();', test: (x) => (x.kind === "str" ? "match" : "type"), why: "", out: (x) => `string of length ${x.s!.length}` },
  { id: "arr", src: 'case int[] a                   -> "int[] of " + a.length;', test: (x) => (x.kind === "arr" ? "match" : "type"), why: "", out: () => "int[] of 3" },
  { id: "def", src: 'default                        -> "something else: " + o;', test: () => "match", why: "", out: (x) => `something else: ${x.kind === "dbl" ? "3.14" : "[1]"}` },
];

const TYPE_NAME: Record<string, string> = { neg: "an Integer", int: "an Integer", blank: "a String", str: "a String", arr: "an int[]", null: "null" };

export function SwitchMatcher() {
  const [inId, setIn] = useState("neg");
  const [withNull, setWithNull] = useState(true);
  const x = INPUTS.find((i) => i.id === inId)!;
  const cases = CASES.filter((c) => withNull || c.id !== "null");

  const head = ["static String describe(Object o) {", "    return switch (o) {"];
  const code = [...head, ...cases.map((c) => "        " + c.src), "    };", "}"].join("\n");
  const first = head.length + 1;

  const npe = x.kind === "null" && !withNull;
  let matched = -1;
  const notes: Record<number, { text: string; tone?: "dead" | "live" | "hot" }> = {};
  const dim: number[] = [];
  if (npe) {
    cases.forEach((_, i) => dim.push(first + i));
  } else {
    for (let i = 0; i < cases.length; i++) {
      const line = first + i;
      if (matched >= 0) {
        dim.push(line);
        continue;
      }
      const r = cases[i].test(x);
      if (r === "match") {
        matched = i;
        notes[line] = { text: "← match", tone: "live" };
      } else if (r === "guard") {
        notes[line] = { text: `✗ ${cases[i].why}`, tone: "dead" };
      } else {
        notes[line] = { text: cases[i].id === "null" ? "✗ not null" : `✗ not ${TYPE_NAME[cases[i].id]}`, tone: "dead" };
      }
    }
  }

  const result = npe ? null : cases[matched].out(x);
  const tested = npe ? 0 : matched + 1;

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="describe(" w="10ch">
          <Words options={INPUTS.map((i) => ({ v: i.id, label: i.label }))} value={inId} onChange={setIn} label="input" />
        </Row>
        <Row k="case null" w="10ch" last>
          <Words
            options={[
              { v: "on", label: "keep it" },
              { v: "off", label: "delete it" },
            ]}
            value={withNull ? "on" : "off"}
            onChange={(v) => setWithNull(v === "on")}
            label="case null line"
          />
        </Row>
      </div>

      <CodePanel file="Main.java" code={code} live={matched >= 0 ? [first + matched] : []} dead={npe ? [2] : []} dim={dim} notes={notes} />

      <Terminal
        cmd={`describe(${x.label})`}
        edge={npe ? "dead" : "live"}
        lines={
          npe
            ? [
                { t: 'Exception in thread "main" java.lang.NullPointerException', tone: "dead" },
                { t: "    at java.base/java.util.Objects.requireNonNull(Objects.java:220)", tone: "mute" },
              ]
            : [{ t: result! }]
        }
      />

      <Narrate minH="4.6em">
        {npe
          ? "without a case null, a switch on null throws NullPointerException before it looks at a single case. that's the old switch behaviour, kept on purpose. add case null (or case null, default) to handle it."
          : x.kind === "null"
            ? "case null is checked like any other label. without it, this input would never reach the cases at all."
            : `tested ${tested} case${tested > 1 ? "s" : ""}, top to bottom. ${matched > 0 ? "a label fails either on its type test or on its when guard, and the next one gets a go. " : ""}the first match wins, and everything below it is never considered.`}
      </Narrate>
    </div>
  );
}
