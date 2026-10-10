"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// how far an annotation survives, per retention policy. the javap snippets are real:
// Retain.java compiled with javac 25, read back with `javap -v -p`. @Src (SOURCE) leaves
// no trace in Retain.class, @Cls (CLASS) lands in RuntimeInvisibleAnnotations, and
// @Run (RUNTIME) in RuntimeVisibleAnnotations. getAnnotations() on m() returned 1.

type Policy = "SOURCE" | "CLASS" | "RUNTIME";

const STAGES = [
  { id: "src", title: "Retain.java", sub: "your source" },
  { id: "javac", title: "javac", sub: "compiler + processors" },
  { id: "class", title: "Retain.class", sub: "on disk" },
  { id: "jvm", title: "running JVM", sub: "reflection" },
] as const;

const CELLS: Record<Policy, { alive: boolean; text: string }[]> = {
  SOURCE: [
    { alive: true, text: "@Src void m()" },
    { alive: true, text: "javac and annotation processors see it, then drop it" },
    { alive: false, text: "no trace. not even a constant pool entry" },
    { alive: false, text: "gone" },
  ],
  CLASS: [
    { alive: true, text: "@Cls void m()" },
    { alive: true, text: "seen, and written out" },
    { alive: true, text: "RuntimeInvisible\u200bAnnotations" },
    { alive: false, text: "the JVM skips the attribute. reflection can't see it" },
  ],
  RUNTIME: [
    { alive: true, text: '@Run("hi") void m()' },
    { alive: true, text: "seen, and written out" },
    { alive: true, text: "RuntimeVisible\u200bAnnotations" },
    { alive: true, text: 'm.getAnnotation(Run.class)\u200b.value() → "hi"' },
  ],
};

const JAVAP: Record<Policy, string> = {
  SOURCE: "void m();\n  descriptor: ()V\n  Code:\n     0: return\n\n(no annotation attribute at all)",
  CLASS: "void m();\n  descriptor: ()V\n  Code:\n     0: return\n  RuntimeInvisibleAnnotations:\n    0: #77()\n      Cls",
  RUNTIME: 'void m();\n  descriptor: ()V\n  Code:\n     0: return\n  RuntimeVisibleAnnotations:\n    0: #74(#43=s#75)\n      Run(\n        value="hi"\n      )',
};

const WHO: Record<Policy, string> = {
  SOURCE: "for the compiler only: @Override, @SuppressWarnings, lombok's @Getter, @Generated. their whole job is done before a class file exists.",
  CLASS: "the default if you write no @Retention at all. kept for bytecode tools (agents, shrinkers, static analyzers) that read class files, invisible to reflection. rarely what you meant.",
  RUNTIME: "for frameworks that look at your code while it runs: @Deprecated, @FunctionalInterface, JUnit's @Test, Spring's @Autowired, JPA's @Entity.",
};

export function RetentionTrail() {
  const [p, setP] = useState<Policy>("RUNTIME");
  const cells = CELLS[p];

  return (
    <div className="@container">
      <Row k="@Retention(" w="11ch">
        <Words options={["SOURCE", "CLASS", "RUNTIME"] as Policy[]} value={p} onChange={setP} label="retention policy" />
        <span className="text-12 text-faint">)</span>
      </Row>

      <ol className="mt-5 grid grid-cols-1 gap-2 @[620px]:grid-cols-4">
        {STAGES.map((s, i) => {
          const c = cells[i];
          return (
            <li
              key={s.id}
              className="relative rounded-md bg-well px-3 py-2.5 transition-[box-shadow,opacity] duration-200 ease-jle"
              style={{
                boxShadow: `inset 0 0 0 1px ${c.alive ? "var(--live)" : "var(--line-2)"}`,
                opacity: c.alive ? 1 : 0.6,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-13 text-hi">{s.title}</span>
                <span className="text-12" style={{ color: c.alive ? "var(--live)" : "var(--dead)" }}>
                  {c.alive ? "kept" : "gone"}
                </span>
              </div>
              <div className="text-11 text-faint">{s.sub}</div>
              <div className="mt-2 text-12 leading-[1.5] break-words" style={{ color: c.alive ? "var(--ink)" : "var(--mute)" }}>
                {c.text}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid gap-4 @[620px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-1 text-11 text-faint">javap -v -p Retain (real, jdk 25)</div>
          <pre className="min-h-[11.5em] overflow-x-auto rounded-md bg-well px-3 py-2.5 text-12 leading-[1.6] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
            {JAVAP[p]}
          </pre>
        </div>
        <p className="font-serif text-17 leading-[1.6] text-ink @[620px]:self-center" aria-live="polite">
          {WHO[p]}
        </p>
      </div>
    </div>
  );
}
