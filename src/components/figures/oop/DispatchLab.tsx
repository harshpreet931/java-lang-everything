"use client";

import { useState } from "react";

// two decisions, two moments. javac picks the overload from DECLARED types (compile time).
// the JVM picks the override from the receiver's RUNTIME class. the argument's runtime class never matters.
// all six combinations were run on jdk 25; outputs are in the chapter.

type R = "Vet" | "ER";
type T = "Animal" | "Dog";

const SRC = [
  "class Animal {}",
  "class Dog extends Animal {}",
  "",
  "class Vet {",
  '    String treat(Animal a) { return "Vet.treat(Animal)"; }',
  '    String treat(Dog d)    { return "Vet.treat(Dog)"; }',
  "}",
  "",
  "class ER extends Vet {",
  "    @Override",
  '    String treat(Animal a) { return "ER.treat(Animal)"; }',
  "}",
];
// 1-based source lines of each method body
const LINE: Record<string, number> = { "Vet.treat(Animal)": 5, "Vet.treat(Dog)": 6, "ER.treat(Animal)": 11 };

export function DispatchLab() {
  const [recv, setRecv] = useState<R>("ER");
  const [argStatic, setArgStatic] = useState<T>("Animal");
  const [argRuntime, setArgRuntime] = useState<T>("Dog");

  const runtimeArg: T = argStatic === "Dog" ? "Dog" : argRuntime;
  const sig = argStatic; // overload chosen by the declared type of the argument
  const ran = recv === "ER" && sig === "Animal" ? "ER.treat(Animal)" : `Vet.treat(${sig})`;
  const chosenLine = LINE[`Vet.treat(${sig})`];
  const ranLine = LINE[ran];
  const overridden = recv === "ER" && sig === "Animal";

  return (
    <div className="grid gap-5 text-13">
      <div>
        <Row label="v =">
          {(["Vet", "ER"] as const).map((r) => (
            <button key={r} className="word" aria-pressed={recv === r} onClick={() => setRecv(r)}>
              Vet v = new {r}()
            </button>
          ))}
        </Row>
        <Row label="x =">
          {(
            [
              ["Animal", "Animal"],
              ["Animal", "Dog"],
              ["Dog", "Dog"],
            ] as const
          ).map(([s, r]) => (
            <button
              key={s + r}
              className="word"
              aria-pressed={argStatic === s && runtimeArg === r}
              onClick={() => (setArgStatic(s), setArgRuntime(r))}
            >
              {s} x = new {r}()
            </button>
          ))}
        </Row>
      </div>

      <div className="grid gap-4">
        <pre className="overflow-x-auto rounded-md bg-well py-3 text-12 leading-[1.75] shadow-[inset_0_0_0_1px_var(--line)]">
          {SRC.map((l, i) => {
            const n = i + 1;
            const isRan = n === ranLine;
            const isChosen = n === chosenLine && !isRan;
            const c = isRan ? "var(--live)" : isChosen ? "var(--hot)" : undefined;
            return (
              <div
                key={i}
                className="grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 transition-colors duration-200"
                style={{ borderColor: c ?? "transparent", background: c ? `color-mix(in srgb, ${c} 10%, transparent)` : undefined }}
              >
                <span className="text-right text-faint/60 tabular">{n}</span>
                <span className="whitespace-pre" style={{ color: c ?? "var(--ink)" }}>
                  {l || " "}
                </span>
              </div>
            );
          })}
          <div className="mt-2 grid grid-cols-[3ch_1fr] gap-x-3 border-t border-line pt-2 pr-4">
            <span />
            <span className="whitespace-pre text-hi">v.treat(x);</span>
          </div>
        </pre>

        <ol className="grid content-start gap-3 md:grid-cols-2" aria-live="polite">
          <li className="rounded-md bg-well px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-11">
              <span className="text-hot">1 · javac, compile time</span>
              <span className="text-faint">reads declared types</span>
            </div>
            <div className="text-12 leading-[1.7] text-ink">
              <span className="text-hi">v</span> is a <span className="text-hi">Vet</span>, <span className="text-hi">x</span> is an{" "}
              <span className="text-hi">{argStatic}</span>. the best match in Vet is{" "}
              <span className="text-hot">treat({argStatic})</span>.
              {argStatic === "Animal" && runtimeArg === "Dog" && (
                <span className="text-mute"> it can't know x will hold a Dog.</span>
              )}
            </div>
            <div className="mt-2 text-11 text-faint">
              bytecode: <span className="text-mute">invokevirtual Vet.treat({argStatic})</span>
            </div>
          </li>
          <li className="rounded-md bg-well px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-11">
              <span className="text-live">2 · JVM, run time</span>
              <span className="text-faint">reads the object</span>
            </div>
            <div className="text-12 leading-[1.7] text-ink">
              v points at a <span className="text-hi">{recv}</span>. does {recv} override <span className="text-hi">treat({sig})</span>?{" "}
              {recv === "Vet" ? "it's the declaring class." : overridden ? "yes." : "no, it only overrides treat(Animal), so it inherits Vet's."}
            </div>
          </li>
          <li className="px-1 text-14 md:col-span-2">
            <span className="text-faint">prints </span>
            <span className="text-live">{ran}</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5ch_minmax(0,1fr)] items-start border-b border-line py-2">
      <span className="pt-1.5 text-faint">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
