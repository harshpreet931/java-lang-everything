"use client";

import { useState } from "react";
import type { Step } from "@/lib/trace";
import { MemoryPane } from "@/components/viz/MemoryStepperClient";

// the four kinds of nested class, side by side: the code, the .class file javac writes,
// the hidden fields it adds, and what one instance looks like in memory.
// hidden fields checked with javap -p and reflection on jdk 25 (see the chapter).

type Kind = "nested" | "inner" | "local" | "anon";

const OUTER = {
  outer: { type: "Outer", fields: { name: { ref: "s1" }, big: { ref: "b1" } } },
  s1: { type: "String", value: '"outer"' },
  b1: { type: "byte[]", value: "10,000,000 bytes" },
} satisfies Step["heap"];

const KINDS: Record<
  Kind,
  { label: string; code: string; file: string; hidden: string; why: string; locals: Step["frames"][number]["locals"]; heap: Step["heap"] }
> = {
  nested: {
    label: "static nested",
    code: `class Outer {
    static class Nested { ... }
}

var n = new Outer.Nested();`,
    file: "Outer$Nested.class",
    hidden: "none",
    why: "a static nested class is just a top-level class with a longer name (and access to Outer's privates). no outer object involved.",
    locals: { outer: { ref: "outer" }, n: { ref: "x" } },
    heap: { x: { type: "Outer$Nested", fields: {} }, ...OUTER },
  },
  inner: {
    label: "inner",
    code: `class Outer {
    String name;
    class Inner {
        String hi() { return name; }
    }
}

var i = outer.new Inner();`,
    file: "Outer$Inner.class",
    hidden: "final Outer this$0",
    why: "an inner class reads Outer's fields, so every Inner carries a hidden reference to the Outer that made it. you can't even create one without an Outer: outer.new Inner().",
    locals: { outer: { ref: "outer" }, i: { ref: "x" } },
    heap: { x: { type: "Outer$Inner", fields: { this$0: { ref: "outer" } } }, ...OUTER },
  },
  local: {
    label: "local",
    code: `Supplier<String> make(String greeting) {
    class Local implements Supplier<String> {
        public String get() {
            return greeting + " from " + name;
        }
    }
    return new Local();
}`,
    file: "Outer$1Local.class",
    hidden: "final String val$greeting\nfinal Outer this$0",
    why: "a class declared inside a method. it captures the local greeting by copying it into a hidden field, and the Outer through this$0.",
    locals: { outer: { ref: "outer" }, s: { ref: "x" } },
    heap: { x: { type: "Outer$1Local", fields: { val$greeting: { ref: "g" }, this$0: { ref: "outer" } } }, g: { type: "String", value: '"hi"' }, ...OUTER },
  },
  anon: {
    label: "anonymous",
    code: `Supplier<String> make(String greeting) {
    return new Supplier<>() {
        public String get() {
            return greeting + " from " + name;
        }
    };
}`,
    file: "Outer$1.class",
    hidden: "final String val$greeting\nfinal Outer this$0",
    why: "a local class with no name, declared and instantiated in one expression. same hidden fields, a numbered class file.",
    locals: { outer: { ref: "outer" }, s: { ref: "x" } },
    heap: { x: { type: "Outer$1", fields: { val$greeting: { ref: "g" }, this$0: { ref: "outer" } } }, g: { type: "String", value: '"hi"' }, ...OUTER },
  },
};

export function NestedKinds() {
  const [kind, setKind] = useState<Kind>("inner");
  const k = KINDS[kind];
  const step: Step = { line: 0, frames: [{ name: "main", locals: k.locals }], heap: k.heap };

  return (
    <div className="grid gap-5 text-13">
      <div className="grid grid-cols-[7ch_minmax(0,1fr)] items-start border-b border-line py-2">
        <span className="pt-1.5 text-faint">kind =</span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(KINDS) as Kind[]).map((id) => (
            <button
              key={id}
              className="word"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
            >
              {KINDS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-3.5 py-3 text-11 leading-[1.7] text-ink shadow-[inset_0_0_0_1px_var(--line)]">{k.code}</pre>
        <div className="grid content-start gap-2 text-12">
          <div className="rounded-md bg-well px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="text-11 text-faint">javac writes</div>
            <div className="text-hi">{k.file}</div>
          </div>
          <div className="rounded-md bg-well px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="text-11 text-faint">hidden fields it adds</div>
            <div className={`whitespace-pre-wrap ${k.hidden === "none" ? "text-live" : "text-meta"}`}>{k.hidden}</div>
          </div>
        </div>
      </div>

      <MemoryPane key={kind} step={step} />

      <p className="font-serif text-15 leading-[1.6] text-ink" aria-live="polite">
        {k.why}
      </p>
    </div>
  );
}
