"use client";

import { useState } from "react";

// primitive type patterns on an int, following the exactness rule of JEP 455 and its
// re-previews (488, 507, 530, 532): `v instanceof T t` matches only if converting v to T and
// back loses nothing. int → float is exact when the int has at most 24 significant bits
// (Math.fround(v) === v); int → long and int → double are always exact.

const PRESETS = [42, -129, 1000, 65535, 16777217, 2147483647];

type Check = { type: string; ok: (v: number) => boolean; why: (v: number) => string };

const CHECKS: Check[] = [
  { type: "byte", ok: (v) => v >= -128 && v <= 127, why: () => "-128 to 127" },
  { type: "short", ok: (v) => v >= -32768 && v <= 32767, why: () => "-32,768 to 32,767" },
  { type: "char", ok: (v) => v >= 0 && v <= 65535, why: () => "0 to 65,535 (no negatives)" },
  {
    type: "float",
    ok: (v) => Math.fround(v) === v,
    why: (v) => (Math.fround(v) === v ? "a float holds it exactly" : `a float would round it to ${Math.fround(v).toLocaleString("en-US")}`),
  },
  { type: "long", ok: () => true, why: () => "every int fits" },
  { type: "double", ok: () => true, why: () => "every int fits exactly" },
];

export function Exactness() {
  const [text, setText] = useState("1000");
  const n = Number(text.replace(/[_,\s]/g, ""));
  const valid = Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-2 text-13">
        <label className="text-faint" htmlFor="exact-int">
          int v =
        </label>
        <input
          id="exact-int"
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="numeric"
          className="w-[13ch] rounded-[4px] bg-bg px-2 py-1 text-hi tabular shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus:shadow-[inset_0_0_0_1px_var(--hot)]"
        />
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p} className="word" aria-pressed={String(p) === text} onClick={() => setText(String(p))}>
              {p.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      </div>
      {!valid ? (
        <p className="text-12 text-dead">that's not an int: it has to be a whole number from -2,147,483,648 to 2,147,483,647.</p>
      ) : (
        <div className="grid gap-1.5" aria-live="polite">
          {CHECKS.map((c) => {
            const ok = c.ok(n);
            return (
              <div key={c.type} className="grid grid-cols-[18ch_6ch_minmax(0,1fr)] items-baseline gap-x-3 text-12">
                <span className="text-ink">v instanceof {c.type}</span>
                <span style={{ color: ok ? "var(--live)" : "var(--dead)" }}>{ok ? "true" : "false"}</span>
                <span className="text-11 text-faint">{c.why(n)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
