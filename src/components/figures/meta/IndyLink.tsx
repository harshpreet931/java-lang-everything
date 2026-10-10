"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "./kit";

// how an invokedynamic call site gets linked, for four call sites javac 25 really emits.
// every instruction and every BootstrapMethods entry below is from `javap -c -v` on
// Indy.java (a lambda, string concat, a record, a pattern switch), trimmed to fit.

type Site = {
  id: string;
  label: string;
  source: string;
  insn: string;
  bsm: string;
  args: string[];
  target: string;
  result: string;
};

const SITES: Site[] = [
  {
    id: "lambda",
    label: "a lambda",
    source: 'Supplier<String> s = () -> "hi";',
    insn: "invokedynamic #7, 0  // InvokeDynamic #0:get:()Ljava/util/function/Supplier;",
    bsm: "LambdaMetafactory.metafactory",
    args: ["()Ljava/lang/Object;", "REF_invokeStatic Indy.lambda$lambda$0:()Ljava/lang/String;", "()Ljava/lang/String;"],
    target: "spins a hidden class Indy$$Lambda implementing Supplier, whose get() calls lambda$lambda$0. non-capturing, so the target just returns one pre-built instance.",
    result: "a Supplier",
  },
  {
    id: "concat",
    label: 'string "+"',
    source: 'return "hi " + name + " #" + n;',
    insn: "invokedynamic #11, 0  // InvokeDynamic #1:makeConcatWithConstants:(Ljava/lang/String;I)Ljava/lang/String;",
    bsm: "StringConcatFactory.makeConcatWithConstants",
    args: ['"hi \\u0001 #\\u0001"   (the recipe: \\u0001 marks an argument)'],
    target: "builds a MethodHandle that measures every piece, allocates one byte[] of exactly the right size and fills it. no StringBuilder anywhere.",
    result: '"hi ada #1"',
  },
  {
    id: "record",
    label: "a record's toString",
    source: "record Point(int x, int y) {}  // p.toString()",
    insn: "invokedynamic #16, 0  // InvokeDynamic #0:toString:(LIndy$Point;)Ljava/lang/String;",
    bsm: "ObjectMethods.bootstrap",
    args: ["Indy$Point", '"x;y"', "REF_getField Indy$Point.x:I", "REF_getField Indy$Point.y:I"],
    target: "composes the field getters into one handle that prints Point[x=1, y=2]. equals and hashCode are two more indy sites with the same bootstrap.",
    result: '"Point[x=1, y=2]"',
  },
  {
    id: "switch",
    label: "a pattern switch",
    source: "switch (shape) { case Circle c -> …; case Square q -> …; }",
    insn: "invokedynamic #21, 0  // InvokeDynamic #2:typeSwitch:(LIndy$Shape;I)I",
    bsm: "SwitchBootstraps.typeSwitch",
    args: ["Indy$Circle", "Indy$Square"],
    target: "a handle that takes the object and returns the index of the first case it matches: 0 for Circle, 1 for Square. a plain lookupswitch on that int does the jump.",
    result: "1   (it was a Square)",
  },
];

const STEPS = [
  { on: ["site"], linked: false, note: "the first time this instruction runs, it's unlinked. it names no method, just a bootstrap method (in the class's BootstrapMethods attribute), a name and a type." },
  { on: ["site", "bsm"], linked: false, note: "so the JVM calls the bootstrap: a Lookup with your class's access rights, the name, the MethodType, and the static arguments javac stored for this site." },
  { on: ["bsm", "target"], linked: false, note: "the bootstrap is ordinary java code. it builds a MethodHandle for this exact call site and returns it wrapped in a CallSite." },
  { on: ["site", "target"], linked: true, note: "the JVM binds the instruction to that CallSite, then calls its target. a ConstantCallSite can never change, so this happens exactly once." },
  { on: ["site", "target"], linked: true, again: true, note: "every later execution skips the bootstrap entirely and calls the target. to the JIT it's a constant method handle, which it can inline like a direct call." },
] as { on: string[]; linked: boolean; again?: boolean; note: string }[];

export function IndyLink() {
  const [id, setId] = useState("concat");
  const site = SITES.find((x) => x.id === id)!;
  const s = useStepper(STEPS.length, { interval: 2400 });
  const { reset } = s;
  useEffect(() => reset(), [id, reset]);
  const st = STEPS[s.i];
  const on = (k: string) => st.on.includes(k);
  const box = (k: string) => ({
    boxShadow: `inset 0 0 0 1px ${on(k) ? "var(--hot)" : "var(--line-2)"}`,
    opacity: k === "bsm" && st.again ? 0.4 : 1,
  });

  return (
    <div {...s.keys} className="@container outline-none">
      <Row k="site =" w="6ch">
        <Words options={SITES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="call site" />
      </Row>

      <div className="mt-3 text-12 text-mute break-words">{site.source}</div>

      <div className="mt-3 flex flex-col gap-1.5">
        <div className="rounded-md bg-well px-3 py-2 transition-[box-shadow] duration-200 ease-jle" style={box("site")}>
          <div className="flex items-baseline justify-between gap-2 text-11">
            <span className="text-faint">the call site</span>
            <span style={{ color: st.linked ? "var(--live)" : "var(--faint)" }}>{st.linked ? "linked" : "unlinked"}</span>
          </div>
          <div className="mt-1 overflow-x-auto text-11 whitespace-nowrap text-ink">{site.insn}</div>
        </div>
        <div className="pl-3 text-11 text-ref">{st.again ? "↓ (bootstrap skipped)" : "↓ first execution"}</div>
        <div className="rounded-md bg-well px-3 py-2 transition-[box-shadow,opacity] duration-200 ease-jle" style={box("bsm")}>
          <div className="text-11 text-faint">bootstrap method</div>
          <div className="mt-1 text-12 text-meta">{site.bsm}(lookup, name, type, …)</div>
          <div className="mt-1 flex flex-col text-11 text-mute">
            {site.args.map((a) => (
              <span key={a} className="break-words">
                + {a}
              </span>
            ))}
          </div>
        </div>
        <div className="pl-3 text-11 text-ref">↓ returns</div>
        <div className="rounded-md bg-well px-3 py-2 transition-[box-shadow] duration-200 ease-jle" style={box("target")}>
          <div className="flex items-baseline justify-between gap-2 text-11">
            <span className="text-faint">ConstantCallSite → target MethodHandle</span>
            {st.linked && <span className="text-live">→ {site.result}</span>}
          </div>
          <div className="mt-1 font-serif text-15 leading-[1.5] text-ink">{site.target}</div>
        </div>
      </div>

      <p className="mt-4 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
