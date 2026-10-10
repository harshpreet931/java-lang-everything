"use client";

import { useState } from "react";
import { Java, Row } from "@/components/figures/basics/kit";
import { OVERLOAD_RESULTS } from "@/components/figures/basics/overloads.data";

// which overload does javac pick? not a model: every combination below was compiled and run
// on jdk 25 (see overloads.data.ts). the explanation names the conversion that made it fit.

const OVERLOADS = ["int", "long", "double", "Integer", "Object", "int..."] as const;
type O = (typeof OVERLOADS)[number];

const ARGS = [
  { code: "5", type: "int" },
  { code: "5L", type: "long" },
  { code: "5.0f", type: "float" },
  { code: "'c'", type: "char" },
  { code: "(short) 5", type: "short" },
  { code: "Integer.valueOf(5)", type: "Integer" },
  { code: '"hi"', type: "String" },
  { code: "", type: "nothing" },
  { code: "1, 2", type: "two ints" },
];

const PRIM = ["byte", "short", "char", "int", "long", "float", "double"];

function why(arg: string, picked: O): { phase: 1 | 2 | 3; text: string } {
  if (picked === "int...") return { phase: 3, text: "varargs. java only tries this in phase 3, after every fixed-arity overload has failed." };
  if (picked === arg) return { phase: 1, text: "an exact match. phase 1 found it, nothing else was even considered." };
  const argPrim = PRIM.includes(arg);
  const pickPrim = PRIM.includes(picked);
  if (argPrim && pickPrim) return { phase: 1, text: `widening: ${arg} → ${picked}, no boxing needed, so it's found in phase 1. among the ones that fit, the most specific (narrowest) type wins.` };
  if (argPrim && !pickPrim)
    return { phase: 2, text: `boxing: ${arg} → ${arg === "int" ? "Integer" : "its wrapper"}${picked === "Object" ? " → Object" : ""}. that's phase 2, which only runs because nothing fit without boxing.` };
  if (!argPrim && pickPrim) return { phase: 2, text: `unboxing: Integer → int${picked !== "int" ? ` → ${picked}` : ""}. phase 2, because phase 1 (no boxing) found nothing.` };
  return { phase: 1, text: `subtyping: a ${arg} is an Object. reference widening, phase 1.` };
}

export function OverloadResolver() {
  const [have, setHave] = useState<Set<O>>(() => new Set<O>(["long", "Integer", "int..."]));
  const [ai, setAi] = useState(0);
  const arg = ARGS[ai];

  const key = OVERLOADS.filter((o) => have.has(o)).join("|");
  const result = key ? OVERLOAD_RESULTS[key][ai] : "ERR:cannot find symbol";
  const err = result.startsWith("ERR:");
  const picked = err ? null : (result as O);
  const expl = picked ? why(arg.type, picked) : null;

  const toggle = (o: O) =>
    setHave((s) => {
      const x = new Set(s);
      if (x.has(o)) x.delete(o);
      else x.add(o);
      return x;
    });

  return (
    <div className="font-mono text-13">
      <Row k="overloads =" w="12ch">
        <div className="flex flex-wrap gap-1">
          {OVERLOADS.map((o) => (
            <button key={o} className="word" aria-pressed={have.has(o)} onClick={() => toggle(o)}>
              m({o})
            </button>
          ))}
        </div>
      </Row>
      <Row k="call =" w="12ch" last>
        <div className="flex flex-wrap gap-1">
          {ARGS.map((a, i) => (
            <button key={a.code || "none"} className="word" aria-pressed={i === ai} onClick={() => setAi(i)}>
              m({a.code})
            </button>
          ))}
        </div>
      </Row>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well py-3 text-12 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line)]">
          {OVERLOADS.filter((o) => have.has(o)).map((o) => (
            <div
              key={o}
              className="border-l-2 px-[14px]"
              style={{
                borderColor: picked === o ? "var(--live)" : "transparent",
                background: picked === o ? "color-mix(in srgb, var(--live) 11%, transparent)" : undefined,
              }}
            >
              <Java code={`static String m(${o} x) { ... }`} />
            </div>
          ))}
          {have.size === 0 && <div className="px-4 text-faint">// no m at all</div>}
          <div className="mt-2 border-t border-line px-4 pt-2">
            <Java code={`m(${arg.code});`} />
            <span className="text-faint">{`  // ${arg.type}`}</span>
          </div>
        </pre>

        <div className="grid content-start gap-3" aria-live="polite">
          <div className="flex gap-1.5 text-11">
            {[1, 2, 3].map((p) => (
              <span
                key={p}
                className="flex-1 rounded-sm px-2 py-1 text-center"
                style={{
                  color: expl?.phase === p ? "var(--hi)" : "var(--faint)",
                  boxShadow: `inset 0 0 0 1px ${expl?.phase === p ? "var(--line-2)" : "var(--line)"}`,
                  background: expl?.phase === p ? "var(--well-2)" : undefined,
                }}
              >
                phase {p}
                <span className="block text-[10px] text-faint">{p === 1 ? "no boxing" : p === 2 ? "+ boxing" : "+ varargs"}</span>
              </span>
            ))}
          </div>
          {picked ? (
            <div className="text-13">
              <span className="text-faint">javac picks </span>
              <span className="text-live">m({picked})</span>
            </div>
          ) : (
            <div className="text-12 leading-[1.6] text-dead">error: {result.slice(4)}</div>
          )}
          <p className="font-serif text-16 leading-[1.6] text-ink">
            {expl
              ? expl.text
              : "no overload accepts this argument in any phase. javac never narrows a value (long → int) or converts between unrelated types to make a call fit."}
          </p>
        </div>
      </div>
    </div>
  );
}
