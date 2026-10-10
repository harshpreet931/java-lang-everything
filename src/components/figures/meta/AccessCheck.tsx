"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// what setAccessible(true) and Field.set actually do, per target. every message below
// is the real one from jdk 25 (temurin 25.0.4.1). the "@4fcd19b3" is the unnamed
// module's identity hash, different every run.

type Outcome = { ok: boolean; text: string };
type Case = {
  id: string;
  label: string;
  code: string;
  where: string;
  opens: "yes" | "no" | "flag" | "unsupported";
  access: Outcome;
  set?: Outcome;
  note: string;
};

const CASES: Case[] = [
  {
    id: "own",
    label: "your private field",
    code: 'Dog.class.getDeclaredField("age")',
    where: "Dog, on the class path (unnamed module)",
    opens: "yes",
    access: { ok: true, text: "true" },
    set: { ok: true, text: "age.set(dog, 4)  → age = 4" },
    note: "everything on the class path lives in one unnamed module, and a module is open to itself. setAccessible works, private means nothing to reflection here.",
  },
  {
    id: "jdk",
    label: "String.value",
    code: 'String.class.getDeclaredField("value")',
    where: "java.lang.String, in module java.base",
    opens: "no",
    access: {
      ok: false,
      text: 'java.lang.reflect.InaccessibleObjectException: Unable to make field private final byte[] java.lang.String.value accessible: module java.base does not "opens java.lang" to unnamed module @4fcd19b3',
    },
    note: "java.base exports java.lang (you can use its public API) but doesn't open it (you can't break into its privates). since java 17 there is no global switch to turn this off.",
  },
  {
    id: "flag",
    label: "String.value + --add-opens",
    code: 'String.class.getDeclaredField("value")',
    where: "java --add-opens java.base/java.lang=ALL-UNNAMED",
    opens: "flag",
    access: { ok: true, text: "true" },
    note: "--add-opens opens one package to one module (ALL-UNNAMED = the class path). it's an explicit, greppable admission that this app depends on JDK internals.",
  },
  {
    id: "unsafe",
    label: "Unsafe.theUnsafe",
    code: 'sun.misc.Unsafe.class.getDeclaredField("theUnsafe")',
    where: "sun.misc, in module jdk.unsupported",
    opens: "unsupported",
    access: { ok: true, text: "true" },
    set: {
      ok: false,
      text: "WARNING: A terminally deprecated method in sun.misc.Unsafe has been called\nWARNING: sun.misc.Unsafe::allocateMemory has been called by Uns (...)\nWARNING: sun.misc.Unsafe::allocateMemory will be removed in a future release",
    },
    note: "the one deliberate hole: jdk.unsupported opens sun.misc so old libraries keep working. but its memory methods are deprecated for removal, and since java 24 using one prints a warning. the replacements are VarHandle and the FFM API.",
  },
  {
    id: "final",
    label: "a final field",
    code: 'Box.class.getDeclaredField("size")  // final int size = 1',
    where: "Box, on the class path",
    opens: "yes",
    access: { ok: true, text: "true" },
    set: { ok: true, text: "size.set(box, 99)\nsize.get(box) → 99, but box.size in code → 1" },
    note: "it 'works' on 25, and that's worse. size = 1 is a compile-time constant, so javac inlined 1 everywhere box.size is read. reflection changed the field; the code never reads it. java 26 starts warning about final-field mutation (JEP 500), and plans to block it.",
  },
  {
    id: "record",
    label: "a record component",
    code: 'Point.class.getDeclaredField("x")  // record Point(int x, int y)',
    where: "a record, on the class path",
    opens: "yes",
    access: { ok: true, text: "true" },
    set: { ok: false, text: "java.lang.IllegalAccessException: Can not set final int field Point.x to java.lang.Integer" },
    note: "record fields are truly final, even to reflection, and so are static finals and hidden-class fields. (the message blames the Integer. the real reason is final.)",
  },
];

const OPENS: Record<Case["opens"], { text: string; tone: string }> = {
  yes: { text: "same module: open", tone: "var(--live)" },
  no: { text: "exported, not opened", tone: "var(--dead)" },
  flag: { text: "opened by a flag", tone: "var(--hot)" },
  unsupported: { text: "opened on purpose (legacy)", tone: "var(--hot)" },
};

function Result({ label, r }: { label: string; r: Outcome }) {
  return (
    <div className="border-b border-line py-2 text-12">
      <div className="text-11 text-faint">{label}</div>
      <div className="mt-0.5 min-w-0 break-words whitespace-pre-wrap" style={{ color: r.ok ? "var(--live)" : "var(--dead)" }}>
        {r.text}
      </div>
    </div>
  );
}

export function AccessCheck() {
  const [id, setId] = useState("jdk");
  const c = CASES.find((x) => x.id === id)!;
  const o = OPENS[c.opens];

  return (
    <div>
      <Row k="target =" w="9ch">
        <Words options={CASES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="reflection target" />
      </Row>

      <div className="mt-4 rounded-md bg-well px-3 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="break-words text-hi">Field f = {c.code};</div>
        <div className="mt-1 text-ref">f.setAccessible(true);</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-12">
        <span className="text-faint">your code</span>
        <span className="text-ref">→</span>
        <span className="text-meta">{c.where}</span>
        <span className="rounded-xs px-1.5 py-0.5 text-11" style={{ color: o.tone, boxShadow: `inset 0 0 0 1px ${o.tone}` }}>
          {o.text}
        </span>
      </div>

      <div className="mt-3">
        <Result label="f.setAccessible(true) →" r={c.access} />
        {c.set && <Result label={c.id === "unsafe" ? "then use it →" : "then set it →"} r={c.set} />}
      </div>

      <p className="mt-3 min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {c.note}
      </p>
    </div>
  );
}
