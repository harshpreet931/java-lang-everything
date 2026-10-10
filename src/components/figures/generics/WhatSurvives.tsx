"use client";

import { useState } from "react";
import { CodePanel, Narrate, ring, tint } from "../functional/kit";
import { Terminal } from "./ui";

// what generic information is still there at run time, and what isn't. the
// reflective calls and their output are verbatim from jdk 25 (Repo and UserRepo as
// top-level classes, so the names print without a Main$ prefix).

const SRC = `class Repo<T extends Comparable<T>> {
    Map<String, List<T>> index;

    <R> R find(Class<R> type, Optional<? extends T> hint) {
        List<T> found = new ArrayList<>();
        return null;
    }
}

class UserRepo extends Repo<String> {}`;

type Item = { id: string; label: string; line: number; kept: boolean; call: string; out: string[]; note: string };

const ITEMS: Item[] = [
  {
    id: "params",
    label: "type parameters",
    line: 1,
    kept: true,
    call: "Repo.class.getTypeParameters()[0].getBounds()",
    out: ["[java.lang.Comparable<T>]"],
    note: "the class header survives in full: its type parameter T, and T's bound. this is how a framework knows a class is generic at all.",
  },
  {
    id: "field",
    label: "a field's type",
    line: 2,
    kept: true,
    call: "f.getType() + \"  vs  \" + f.getGenericType()",
    out: ["interface java.util.Map  vs  java.util.Map<java.lang.String, java.util.List<T>>"],
    note: "two answers. getType() is the erased type the JVM uses. getGenericType() reads the Signature attribute and gives you the full declared type, nested arguments and all.",
  },
  {
    id: "method",
    label: "a method's signature",
    line: 4,
    kept: true,
    call: "m.toGenericString()",
    out: ["<R> R Repo.find(java.lang.Class<R>,java.util.Optional<? extends T>)"],
    note: "parameters, return type, the method's own type parameters, wildcards. everything you wrote in the declaration is there.",
  },
  {
    id: "super",
    label: "a superclass's type arguments",
    line: 10,
    kept: true,
    call: "UserRepo.class.getGenericSuperclass()",
    out: ["Repo<java.lang.String>"],
    note: "the big one. when a class extends a parameterized type, the concrete type argument (String here) is written into the subclass's class file, forever. super type tokens are built on exactly this.",
  },
  {
    id: "local",
    label: "a local variable",
    line: 5,
    kept: false,
    call: "(no reflection API for local variables)",
    out: ["javac -g records List<T> in debug info (LocalVariableTypeTable)", "only for debuggers. off by default, invisible to reflection."],
    note: "locals don't exist as far as reflection is concerned. the generic type of a local only survives as debugging info, and only if you compile with -g.",
  },
  {
    id: "object",
    label: "an object's type argument",
    line: 5,
    kept: false,
    call: "local.getClass() + \" \" + Arrays.toString(local.getClass().getTypeParameters())",
    out: ["class java.util.ArrayList [E]"],
    note: "this is what erasure really erases. the object knows it's an ArrayList, and ArrayList declares a type parameter E, but which type argument this particular object was created with is recorded nowhere.",
  },
];

export function WhatSurvives() {
  const [id, setId] = useState("super");
  const it = ITEMS.find((x) => x.id === id)!;
  const kept = ITEMS.filter((x) => x.kept).map((x) => x.line);

  return (
    <div className="@container grid gap-4">
      <div className="grid gap-1.5 @[560px]:grid-cols-2">
        {ITEMS.map((x) => {
          const sel = x.id === id;
          const tone = x.kept ? "live" : "dead";
          return (
            <button
              key={x.id}
              onClick={() => setId(x.id)}
              aria-pressed={sel}
              className="flex items-center justify-between gap-3 rounded-md px-3.5 py-2 text-left text-12 transition-[box-shadow,background-color] duration-200 ease-jle"
              style={{ boxShadow: ring(tone, sel ? 100 : 35), background: tint(tone, sel ? 10 : 3) }}
            >
              <span className="text-ink">{x.label}</span>
              <span style={{ color: `var(--${tone})` }}>{x.kept ? "survives" : "erased"}</span>
            </button>
          );
        })}
      </div>

      <CodePanel
        file="Repo.java"
        code={SRC}
        hot={[it.line]}
        live={kept.filter((l) => l !== it.line)}
        notes={{ [it.line]: { text: it.kept ? "← kept in the class file" : "← gone at run time", tone: it.kept ? "live" : "dead" } }}
      />

      <Terminal cmd={it.call} lines={it.out.map((t) => ({ t, tone: it.kept ? "ink" : "mute" }))} edge={it.kept ? "live" : "dead"} />

      <Narrate minH="4.6em">{it.note}</Narrate>
    </div>
  );
}
