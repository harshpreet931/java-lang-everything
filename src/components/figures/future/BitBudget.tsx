"use client";

import { useState } from "react";

// why some value objects flatten and some don't, following JEP 401: a flattened reference in
// a field or array element you can write to has to be read and written atomically, which on
// common hardware means 64 bits, and a nullable one needs at least one extra bit for "null".
// LocalDate's data is "an int and two bytes" (JEP 401's own description). null-restricted
// types, which would drop the flag bit, are only a draft JEP (8303099 / 8316779).

type T = { name: string; bits: number; parts: string };
const TYPES: T[] = [
  { name: "Color(byte r, g, b)", bits: 24, parts: "3 × 8" },
  { name: "Integer", bits: 32, parts: "an int" },
  { name: "LocalDate", bits: 48, parts: "an int and two bytes" },
  { name: "Point(int x, int y)", bits: 64, parts: "2 × 32" },
  { name: "Long", bits: 64, parts: "a long" },
  { name: "Double", bits: 64, parts: "a double" },
];

export function BitBudget() {
  const [nullable, setNullable] = useState(true);
  const max = 72;
  const pct = (b: number) => `${(b / max) * 100}%`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="nullness">
        <button className="word" aria-pressed={nullable} onClick={() => setNullable(true)}>
          nullable (jdk 28 preview)
        </button>
        <button className="word" aria-pressed={!nullable} onClick={() => setNullable(false)}>
          null-restricted (draft, not in any JDK)
        </button>
      </div>
      <div className="grid gap-2.5">
        {TYPES.map((t) => {
          const total = t.bits + (nullable ? 1 : 0);
          const fits = total <= 64;
          return (
            <div key={t.name} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-12">
                <span className="text-ink">
                  {t.name} <span className="text-11 text-faint">· {t.parts}</span>
                </span>
                <span className="shrink-0 text-11 tabular" style={{ color: fits ? "var(--live)" : "var(--dead)" }}>
                  {total} bits · {fits ? "can flatten" : "too wide"}
                </span>
              </div>
              <div className="relative h-[14px] bg-well-2">
                <div className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-jle" style={{ width: pct(t.bits), background: "color-mix(in srgb, var(--ink) 55%, transparent)" }} />
                {nullable && <div className="absolute inset-y-0 bg-hot" style={{ left: pct(t.bits), width: pct(1) }} title="null flag" />}
                <div className="absolute inset-y-[-3px] border-l border-dashed border-dead" style={{ left: pct(64) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 bg-[color-mix(in_srgb,var(--ink)_55%,transparent)]" /> the object&apos;s data
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 bg-hot" /> the null flag
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 border-l border-dashed border-dead" /> 64 bits: what hardware reads and writes in one go
        </span>
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {nullable
          ? "a nullable Long or Point needs 65 bits, one more than the hardware can update atomically, so in a mutable field or array it stays a pointer to an object. small values (Integer, LocalDate, a three-byte Color) fit, flag and all."
          : "drop the null flag and Long, Double and Point fit in exactly 64 bits. that's the storage half of why null-restricted types are on valhalla's list. as of october 2026 they're draft JEPs: no syntax is final and no JDK has them."}
      </p>
    </div>
  );
}
