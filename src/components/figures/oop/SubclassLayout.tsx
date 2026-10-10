"use client";

import { useState } from "react";

// a subclass object contains its superclass's fields. left: the class hierarchy. right: one object.
// hover a class to light up the slice of the object it contributes.
// sizes measured on jdk 25 (temurin 25.0.4, macOS aarch64, -Xint, default headers) with
// ThreadMXBean#getThreadAllocatedBytes over 1,000,000 allocations: Animal 24 B, Dog 32 B.

type Cls = "Object" | "Animal" | "Dog";

const CLASSES: { id: Cls; fields: string[]; methods: string[] }[] = [
  { id: "Object", fields: [], methods: ["toString()", "equals(..)", "hashCode()", "…"] },
  { id: "Animal", fields: ["private String name", "int legs"], methods: ["describe()"] },
  { id: "Dog", fields: ["String breed", "boolean good"], methods: ["describe()  · overrides", "fetch()"] },
];

type Row = { from: Cls | "header"; label: string; value: string; kind: "meta" | "ref" | "prim"; note?: string };

const ROWS: Row[] = [
  { from: "header", label: "mark word", value: "hash · lock · age", kind: "meta" },
  { from: "header", label: "class", value: "→ CLASS", kind: "meta" },
  { from: "Animal", label: "name", value: '→ "rex"', kind: "ref", note: "private: it's in every Dog, Dog's code just can't name it" },
  { from: "Animal", label: "legs", value: "4", kind: "prim" },
  { from: "Dog", label: "breed", value: '→ "corgi"', kind: "ref" },
  { from: "Dog", label: "good", value: "true", kind: "prim" },
];

export function SubclassLayout() {
  const [obj, setObj] = useState<"Animal" | "Dog">("Dog");
  const [hover, setHover] = useState<Cls | null>(null);
  const rows = ROWS.filter((r) => obj === "Dog" || r.from !== "Dog");

  return (
    <div className="grid gap-5 text-13">
      <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
        <span className="text-faint">object =</span>
        <div className="flex flex-wrap gap-1">
          <button className="word" aria-pressed={obj === "Animal"} onClick={() => setObj("Animal")}>
            new Animal()
          </button>
          <button className="word" aria-pressed={obj === "Dog"} onClick={() => setObj("Dog")}>
            new Dog()
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* the hierarchy */}
        <div className="flex flex-col items-stretch gap-0" aria-label="class hierarchy">
          <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">classes</div>
          {CLASSES.map((c, i) => {
            const on = hover === c.id;
            const used = c.id !== "Dog" || obj === "Dog";
            return (
              <div key={c.id} className="flex flex-col items-stretch">
                {i > 0 && (
                  <div className="flex h-6 items-center gap-2 pl-5 text-11 text-faint" aria-hidden>
                    <span className="text-line-2">▲</span> extends
                  </div>
                )}
                <div
                  onMouseEnter={() => setHover(c.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(c.id)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  className="rounded-md bg-well px-3 py-2 text-12 transition-[box-shadow,opacity] duration-150 ease-jle outline-none"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
                    opacity: used ? 1 : 0.45,
                  }}
                >
                  <div className={`mb-1 ${on ? "text-hot" : "text-hi"}`}>class {c.id}</div>
                  {c.fields.length > 0 && (
                    <div className="text-ink">
                      {c.fields.map((f) => (
                        <div key={f}>{f}</div>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 border-t border-line pt-1 text-mute">
                    {c.methods.map((m) => (
                      <div key={m}>{m}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* the object */}
        <div className="min-w-0" aria-live="polite">
          <div className="mb-2 flex items-baseline justify-between border-b border-line pb-1.5 text-11 text-faint">
            <span>one {obj} object, on the heap</span>
            <span className="text-12 text-hi tabular">{obj === "Dog" ? 32 : 24} B</span>
          </div>
          <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line-2)]">
            {rows.map((r, i) => {
              const lit = hover !== null && (r.from === hover || (hover === "Object" && r.from === "header"));
              const groupStart = i === 0 || rows[i - 1].from !== r.from;
              const bg = lit ? "color-mix(in srgb, var(--hot) 12%, transparent)" : undefined;
              const bar = lit ? "inset 2px 0 0 var(--hot)" : undefined;
              return (
                <div key={r.label} className="obj-in">
                  {groupStart && (
                    <div
                      className={`px-3 pt-2 text-[10px] text-faint transition-[background-color] duration-150 ${i > 0 ? "border-t border-line-2" : ""}`}
                      style={{ background: bg, boxShadow: bar }}
                    >
                      {r.from === "header" ? "header (the JVM's)" : `from ${r.from}`}
                    </div>
                  )}
                  <div
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-1.5 text-12 transition-[background-color] duration-150 ${
                      groupStart ? "" : "border-t border-line"
                    }`}
                    style={{ background: bg, boxShadow: bar }}
                  >
                    <span className="min-w-0">
                      <span className={r.kind === "meta" ? "text-meta" : "text-mute"}>{r.label}</span>
                      {r.note && <span className="block text-[10px] leading-4 text-faint">{r.note}</span>}
                    </span>
                    <span className={r.kind === "ref" ? "text-ref" : r.kind === "meta" ? "text-meta" : "text-hi tabular"}>
                      {r.value.replace("CLASS", obj)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-serif text-15 leading-[1.6] text-mute">
            {obj === "Dog"
              ? "the Animal part sits at the same offsets it has in a plain Animal. so code compiled against Animal reads legs from a Dog without knowing it's a Dog."
              : "a plain Animal is exactly the Animal part of a Dog. no Dog fields, nothing wasted."}
          </p>
        </div>
      </div>
    </div>
  );
}
