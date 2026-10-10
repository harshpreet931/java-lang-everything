"use client";

import { useState } from "react";

// the same four modifiers as the matrix, drawn as places: two packages, four classes.
// html instead of svg so it reflows on a phone.
// pick a modifier on Account.balance and see which classes can touch it.

type Mod = "private" | "package" | "protected" | "public";
const MODS: { id: Mod; label: string; line: string }[] = [
  { id: "private", label: "private", line: "only code inside Account itself." },
  { id: "package", label: "(nothing)", line: "package-private: anything in package shop. subclasses elsewhere are out." },
  { id: "protected", label: "protected", line: "package-private plus subclasses anywhere (through their own type). wider than (nothing), not narrower." },
  { id: "public", label: "public", line: "everyone who can see the class. (with modules: only if the package is exported.)" },
];

type Box = { id: string; pkg: "shop" | "bank"; label: string; sub: string; who: Mod[] };
const BOXES: Box[] = [
  { id: "Account", pkg: "shop", label: "Account", sub: "declares balance", who: ["private", "package", "protected", "public"] },
  { id: "Teller", pkg: "shop", label: "Teller", sub: "same package", who: ["package", "protected", "public"] },
  { id: "Savings", pkg: "bank", label: "Savings extends Account", sub: "subclass, other package", who: ["protected", "public"] },
  { id: "Thief", pkg: "bank", label: "Thief", sub: "unrelated, other package", who: ["public"] },
];

export function AccessScopes() {
  const [mod, setMod] = useState<Mod>("package");
  const info = MODS.find((m) => m.id === mod)!;

  return (
    <div className="grid gap-4 text-13">
      <div className="grid grid-cols-[11ch_minmax(0,1fr)] items-center border-b border-line py-2">
        <span className="text-faint">balance =</span>
        <div className="flex flex-wrap gap-1">
          {MODS.map((m) => (
            <button key={m.id} className="word" aria-pressed={mod === m.id} onClick={() => setMod(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="img"
        aria-label={`with ${info.label}, these classes can access balance: ${BOXES.filter((b) => b.who.includes(mod)).map((b) => b.id).join(", ")}`}
      >
        {(["shop", "bank"] as const).map((pkg) => (
          <div key={pkg} className="rounded-md border border-dashed border-line-2 p-3">
            <div className="mb-2.5 text-11 text-faint">package {pkg}</div>
            <div className="grid gap-2">
              {BOXES.filter((b) => b.pkg === pkg).map((b) => {
                const ok = b.who.includes(mod);
                const weird = ok && mod === "protected" && b.id === "Savings";
                return (
                  <div
                    key={b.id}
                    className="flex items-start justify-between gap-3 rounded-md px-3 py-2 transition-[box-shadow,background-color,opacity] duration-200 ease-jle"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${ok ? "var(--live)" : "var(--line-2)"}`,
                      background: ok ? "color-mix(in srgb, var(--live) 9%, var(--well))" : "var(--well)",
                      opacity: ok ? 1 : 0.6,
                    }}
                  >
                    <div className="min-w-0">
                      <div className={`text-13 ${ok ? "text-hi" : "text-mute"}`}>{b.label}</div>
                      <div className={`text-11 ${weird ? "text-hot" : "text-faint"}`}>{weird ? "only via Savings references" : b.sub}</div>
                    </div>
                    <span className="text-14" style={{ color: ok ? "var(--live)" : "var(--dead)" }} aria-hidden>
                      {ok ? "✓" : "✗"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="min-h-[3.4em] font-serif text-15 leading-[1.6] text-mute" aria-live="polite">
        <span className="text-hi">{info.label}</span>: {info.line}
      </p>
    </div>
  );
}
