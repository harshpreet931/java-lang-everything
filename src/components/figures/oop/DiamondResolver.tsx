"use client";

import { useState } from "react";

// who wins when a class inherits hello() from more than one place?
// the three rules: 1. a class (or superclass) method wins over any interface default.
// 2. otherwise the most specific interface wins. 3. otherwise it's a compile error,
// and you resolve it by overriding, optionally calling X.super.hello().
// every scenario was compiled and run on jdk 25; outputs and errors are javac's, verbatim.

type Node = { kind: string; name: string; method: string; role: "win" | "lose" | "bad" | "none" };
type Scenario = {
  id: string;
  label: string;
  rule: string;
  left: Node;
  right: Node;
  link?: string; // relation drawn between the two parents
  robot: { decl: string; method?: string; role: "win" | "lose" | "bad" | "none" };
  code: string;
  ok: boolean;
  result: string;
};

const GREETER = "interface Greeter {\n    default String hello() { return \"Greeter.hello\"; }\n}";
const WAVER = "interface Waver {\n    default String hello() { return \"Waver.hello\"; }\n}";

const SCENARIOS: Scenario[] = [
  {
    id: "class",
    label: "class wins",
    rule: "rule 1: a method from the superclass chain beats every interface default. defaults are a fallback, never an override of real class code.",
    left: { kind: "class", name: "Base", method: "public String hello()", role: "win" },
    right: { kind: "interface", name: "Greeter", method: "default String hello()", role: "lose" },
    robot: { decl: "class Robot extends Base implements Greeter", role: "none" },
    code: `${GREETER}\n\nclass Base {\n    public String hello() { return "Base.hello"; }\n}\n\nclass Robot extends Base implements Greeter {}`,
    ok: true,
    result: "Base.hello",
  },
  {
    id: "abstract",
    label: "even if abstract",
    rule: "rule 1 again, the weird way: the class wins even when its method is abstract. the default doesn't fill the hole, Robot has to.",
    left: { kind: "abstract class", name: "Base", method: "public abstract String hello()", role: "bad" },
    right: { kind: "interface", name: "Greeter", method: "default String hello()", role: "lose" },
    robot: { decl: "class Robot extends Base implements Greeter", role: "bad" },
    code: `${GREETER}\n\nabstract class Base {\n    public abstract String hello();\n}\n\nclass Robot extends Base implements Greeter {}`,
    ok: false,
    result: "error: Robot is not abstract and does not override abstract method hello() in Base",
  },
  {
    id: "specific",
    label: "more specific wins",
    rule: "rule 2: LoudGreeter extends Greeter, so its default is more specific and replaces Greeter's. no conflict.",
    left: { kind: "interface", name: "Greeter", method: "default String hello()", role: "lose" },
    right: { kind: "interface", name: "LoudGreeter", method: "default String hello()", role: "win" },
    link: "extends",
    robot: { decl: "class Robot implements Greeter, LoudGreeter", role: "none" },
    code: `${GREETER}\n\ninterface LoudGreeter extends Greeter {\n    @Override\n    default String hello() { return "LoudGreeter.hello"; }\n}\n\nclass Robot implements Greeter, LoudGreeter {}`,
    ok: true,
    result: "LoudGreeter.hello",
  },
  {
    id: "conflict",
    label: "a real diamond",
    rule: "rule 3: two unrelated defaults, neither more specific. javac refuses to guess.",
    left: { kind: "interface", name: "Greeter", method: "default String hello()", role: "bad" },
    right: { kind: "interface", name: "Waver", method: "default String hello()", role: "bad" },
    robot: { decl: "class Robot implements Greeter, Waver", role: "bad" },
    code: `${GREETER}\n\n${WAVER}\n\nclass Robot implements Greeter, Waver {}`,
    ok: false,
    result: "error: types Greeter and Waver are incompatible;\n  class Robot inherits unrelated defaults for hello() from types Greeter and Waver",
  },
  {
    id: "fix",
    label: "you pick",
    rule: "the fix: override it. X.super.hello() calls one specific interface's default, so you can pick one, or both.",
    left: { kind: "interface", name: "Greeter", method: "default String hello()", role: "lose" },
    right: { kind: "interface", name: "Waver", method: "default String hello()", role: "lose" },
    robot: { decl: "class Robot implements Greeter, Waver", method: "public String hello()  · overrides", role: "win" },
    code: `${GREETER}\n\n${WAVER}\n\nclass Robot implements Greeter, Waver {\n    @Override\n    public String hello() {\n        return Greeter.super.hello() + " + " + Waver.super.hello();\n    }\n}`,
    ok: true,
    result: "Greeter.hello + Waver.hello",
  },
];

const roleColor = (r: Node["role"]) => (r === "win" ? "var(--live)" : r === "bad" ? "var(--dead)" : "var(--line-2)");

export function DiamondResolver() {
  const [id, setId] = useState("conflict");
  const s = SCENARIOS.find((x) => x.id === id)!;

  return (
    <div className="grid gap-5 text-13">
      <div className="grid grid-cols-[7ch_minmax(0,1fr)] items-start border-b border-line py-2">
        <span className="pt-1.5 text-faint">case =</span>
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((x) => (
            <button key={x.id} className="word" aria-pressed={x.id === id} onClick={() => setId(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* the hierarchy */}
      <div className="grid gap-2" role="img" aria-label={`${s.left.kind} ${s.left.name} and ${s.right.kind} ${s.right.name} both offer hello(). ${s.rule}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Box n={s.left} />
          <span className="w-[7ch] text-center text-11 text-faint">{s.link ? `← ${s.link}` : ""}</span>
          <Box n={s.right} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] text-center text-14 text-line-2" aria-hidden>
          <span>▲</span>
          <span className="w-[7ch]" />
          <span>▲</span>
        </div>
        <div className="mx-auto w-full max-w-[460px]">
          <Box n={{ kind: "class", name: "Robot", method: s.robot.method ?? "(declares nothing)", role: s.robot.role }} sub={s.robot.decl} />
        </div>
      </div>

      <p className="font-serif text-15 leading-[1.6] text-mute" aria-live="polite">
        {s.rule}
      </p>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-3.5 py-3 text-11 leading-[1.7] text-ink shadow-[inset_0_0_0_1px_var(--line)]">{s.code}</pre>
        <div className="rounded-md bg-well px-3.5 py-3 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-1 text-11 text-faint">{s.ok ? "new Robot().hello() prints" : "$ javac"}</div>
          <div className="whitespace-pre-wrap" style={{ color: s.ok ? "var(--live)" : "var(--dead)" }}>
            {s.result}
          </div>
        </div>
      </div>
    </div>
  );
}

function Box({ n, sub }: { n: Node; sub?: string }) {
  return (
    <div
      className="min-w-0 rounded-md bg-well px-3 py-2 text-12 transition-[box-shadow,opacity] duration-200 ease-jle"
      style={{ boxShadow: `inset 0 0 0 1px ${roleColor(n.role)}`, opacity: n.role === "lose" ? 0.55 : 1 }}
    >
      <div className="text-[10px] text-faint">{n.kind}</div>
      <div className="text-hi">{n.name}</div>
      {sub && <div className="truncate text-11 text-mute">{sub}</div>}
      <div className="mt-1 border-t border-line pt-1 text-11" style={{ color: n.role === "win" ? "var(--live)" : n.role === "bad" ? "var(--dead)" : "var(--mute)" }}>
        {n.method}
      </div>
    </div>
  );
}
