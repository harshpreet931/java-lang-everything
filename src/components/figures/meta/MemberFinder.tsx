"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// which members each Class.getX() call returns. the lists are real: Dog/Animal below,
// compiled and run on jdk 25 (getMethods().length == 11, constructors 1 / 2).

type Kind = "field" | "method" | "ctor";
type Access = "public" | "protected" | "package" | "private";
type Member = { name: string; kind: Kind; access: Access; sig: string };

const CLASSES: { name: string; decl: string; members: Member[] }[] = [
  {
    name: "Dog",
    decl: "class Dog extends Animal",
    members: [
      { name: "age", kind: "field", access: "private", sig: "private int age" },
      { name: "breed", kind: "field", access: "public", sig: "public String breed" },
      { name: "Dog()", kind: "ctor", access: "public", sig: "public Dog()" },
      { name: "Dog(int)", kind: "ctor", access: "private", sig: "private Dog(int age)" },
      { name: "bark", kind: "method", access: "public", sig: "public String bark(int)" },
      { name: "secret", kind: "method", access: "private", sig: "private void secret()" },
      { name: "count", kind: "method", access: "package", sig: "static int count()" },
    ],
  },
  {
    name: "Animal",
    decl: "class Animal",
    members: [
      { name: "name", kind: "field", access: "public", sig: "public String name" },
      { name: "legs", kind: "field", access: "protected", sig: "protected int legs" },
      { name: "Animal()", kind: "ctor", access: "package", sig: "Animal()" },
      { name: "eat", kind: "method", access: "public", sig: "public void eat()" },
    ],
  },
  {
    name: "Object",
    decl: "class Object",
    members: [
      { name: "Object()", kind: "ctor", access: "public", sig: "public Object()" },
      ...["equals", "hashCode", "toString", "getClass", "notify", "notifyAll", "wait()", "wait(long)", "wait(long,int)"].map(
        (n) => ({ name: n, kind: "method" as Kind, access: "public" as Access, sig: `public ${n}` }),
      ),
      { name: "clone", kind: "method", access: "protected", sig: "protected Object clone()" },
      { name: "finalize", kind: "method", access: "protected", sig: "protected void finalize()" },
    ],
  },
];

type Call = "getFields" | "getDeclaredFields" | "getMethods" | "getDeclaredMethods" | "getConstructors" | "getDeclaredConstructors";

const CALLS: Call[] = ["getFields", "getDeclaredFields", "getMethods", "getDeclaredMethods", "getConstructors", "getDeclaredConstructors"];

function matches(call: Call, cls: string, m: Member) {
  const declared = call.startsWith("getDeclared");
  const kind: Kind = call.endsWith("Fields") ? "field" : call.endsWith("Methods") ? "method" : "ctor";
  if (m.kind !== kind) return false;
  if (declared) return cls === "Dog";
  // public only. constructors are never inherited; fields and methods are.
  if (m.access !== "public") return false;
  return kind === "ctor" ? cls === "Dog" : true;
}

const NOTES: Record<Call, string> = {
  getFields: "public fields, including the ones inherited from Animal. the private age is invisible.",
  getDeclaredFields: "every field written in Dog, any access, private included. nothing inherited.",
  getMethods: "public methods all the way up: bark, eat, and Object's nine public methods. 11 in total. the package-private count() and Object's protected clone() are left out.",
  getDeclaredMethods: "everything declared in Dog itself: public, private, static. eat() is Animal's, so it's not here.",
  getConstructors: "public constructors of Dog only. constructors are never inherited.",
  getDeclaredConstructors: "all of Dog's constructors, the private one too.",
};

const accessGlyph: Record<Access, string> = { public: "+", protected: "#", package: "~", private: "-" };

export function MemberFinder() {
  const [call, setCall] = useState<Call>("getMethods");
  const total = CLASSES.reduce((n, c) => n + c.members.filter((m) => matches(call, c.name, m)).length, 0);

  return (
    <div className="@container">
      <Row k="Dog.class." w="10ch">
        <Words options={CALLS.map((c) => ({ v: c, label: `${c}()` }))} value={call} onChange={setCall} label="reflection call" />
      </Row>

      <div className="mt-5 flex flex-col gap-3">
        {CLASSES.map((c, ci) => (
          <div key={c.name} className="flex flex-col gap-1">
            {ci > 0 && <div className="pl-3 text-11 text-faint">↑ extends</div>}
            <div className="rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-13 text-meta">{c.decl}</span>
                <span className="text-11 text-faint">{c.name === "Dog" ? "the class you asked" : "superclass"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.members.map((m) => {
                  const on = matches(call, c.name, m);
                  return (
                    <span
                      key={m.name}
                      title={m.sig}
                      className="rounded-xs px-1.5 py-0.5 text-12 transition-[opacity,box-shadow,color] duration-200 ease-jle"
                      style={{
                        boxShadow: `inset 0 0 0 1px ${on ? "var(--live)" : "var(--line-2)"}`,
                        color: on ? "var(--live)" : "var(--mute)",
                        opacity: on ? 1 : 0.45,
                      }}
                    >
                      <span className="text-faint">{accessGlyph[m.access]}</span> {m.name}
                      {m.kind === "field" && <span className="text-faint"> (f)</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-11 text-faint">
        <span>+ public &nbsp; # protected &nbsp; ~ package-private &nbsp; - private &nbsp; (f) field</span>
        <span className="text-12 text-hi tabular">
          {call}().length == {total}
        </span>
      </div>
      <p className="mt-3 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {NOTES[call]}
      </p>
    </div>
  );
}
