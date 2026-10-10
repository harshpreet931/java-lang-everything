"use client";

import { useState } from "react";

// the real header of one `new Object()`, read with sun.misc.Unsafe.getLong(o, 0)
// on jdk 25 (temurin 25.0.4.1, aarch64): fresh, after System.identityHashCode,
// after surviving a few young GCs, and inside synchronized (o). the hash was
// found at bit 11 in both modes; the age moved 0 → 1 → 3 → 4 across GCs.

type Mode = "default" | "compact";
type State = "fresh" | "hashed" | "aged" | "locked";

const BITS: Record<Mode, Record<State, string>> = {
  default: {
    fresh: "0000000000000000000000000000000000000000000000000000000000000001",
    hashed: "0000000000000000000000010001100100010000001001010000100000000001",
    aged: "0000000000000000000000010001100100010000001001010000100000100001",
    locked: "0000000000000000000000010001100100010000001001010000100000100000",
  },
  compact: {
    fresh: "0000000000010111011000000000000000000000000000000000000000000001",
    hashed: "0000000000010111011000111110101001001100100011010110100000000001",
    aged: "0000000000010111011000111110101001001100100011010110100000100001",
    locked: "0000000000010111011000111110101001001100100011010110100000100000",
  },
};
// the second header word in default mode: the 32-bit compressed class pointer
const KLASS32 = "00000000000101110101100001011000";

type Group = { name: string; from: number; len: number; tone: string; note: string };
// bit 63 is index 0 in the strings above
const GROUPS: Record<Mode, Group[]> = {
  default: [
    { name: "unused", from: 0, len: 22, tone: "var(--faint)", note: "22 bits nobody uses. compact headers put the class pointer here." },
    { name: "identity hash", from: 22, len: 31, tone: "var(--hi)", note: "System.identityHashCode, computed lazily the first time someone asks, then stored here forever." },
    { name: "unused", from: 53, len: 4, tone: "var(--faint)", note: "4 bits. compact headers reserve these for Valhalla." },
    { name: "age", from: 57, len: 4, tone: "var(--ink)", note: "how many young GCs this object survived. 4 bits, so the tenuring threshold can't go past 15." },
    { name: "self-fwd", from: 61, len: 1, tone: "var(--faint)", note: "used by the GC while it's moving objects. 0 in a running program." },
    { name: "lock", from: 62, len: 2, tone: "var(--meta)", note: "01 unlocked, 00 lightweight locked, 10 inflated monitor, 11 marked by the GC." },
  ],
  compact: [
    { name: "class pointer", from: 0, len: 22, tone: "var(--ref)", note: "the compressed class pointer, moved into the mark word. 22 bits: room for about 4 million classes." },
    { name: "identity hash", from: 22, len: 31, tone: "var(--hi)", note: "System.identityHashCode, same 31 bits, same place." },
    { name: "valhalla", from: 53, len: 4, tone: "var(--faint)", note: "reserved for Project Valhalla (value objects)." },
    { name: "age", from: 57, len: 4, tone: "var(--ink)", note: "GC age, as before." },
    { name: "self-fwd", from: 61, len: 1, tone: "var(--faint)", note: "used by the GC while it's moving objects." },
    { name: "lock", from: 62, len: 2, tone: "var(--meta)", note: "the same lock bits." },
  ],
};

const STATES: { id: State; label: string; what: string }[] = [
  { id: "fresh", label: "new Object()", what: "fresh: everything zero except the lock bits, 01 (unlocked)." },
  { id: "hashed", label: "identityHashCode", what: "after System.identityHashCode(o): 31 bits of hash appear at bit 11." },
  { id: "aged", label: "a few young GCs", what: "after surviving young collections: the age field reads 4 (0100)." },
  { id: "locked", label: "synchronized (o)", what: "inside synchronized: lock bits 00. lightweight locking leaves the hash and age untouched." },
];

export function MarkWord() {
  const [mode, setMode] = useState<Mode>("default");
  const [state, setState] = useState<State>("hashed");
  const [hover, setHover] = useState<number | null>(null);
  const bits = BITS[mode][state];
  const prevState = STATES[Math.max(0, STATES.findIndex((s) => s.id === state) - 1)].id;
  const prev = BITS[mode][prevState];
  const groups = GROUPS[mode];
  const gi = (i: number) => groups.findIndex((g) => i >= g.from && i < g.from + g.len);
  const active = hover !== null ? groups[hover] : null;

  const row = (from: number, to: number) => (
    <div className="flex flex-wrap">
      {Array.from({ length: to - from }, (_, k) => {
        const i = from + k;
        const g = gi(i);
        const b = bits[i];
        const changed = state !== "fresh" && b !== prev[i];
        const dim = hover !== null && hover !== g;
        const startsGroup = groups.some((gg) => gg.from === i) && i !== from;
        return (
          <span
            key={i}
            onMouseEnter={() => setHover(g)}
            onMouseLeave={() => setHover(null)}
            className={`flex h-7 w-[14px] shrink-0 items-center justify-center text-11 transition-opacity duration-150 ${startsGroup ? "ml-1.5" : ""}`}
            style={{
              color: b === "1" ? groups[g].tone : "var(--faint)",
              opacity: dim ? 0.3 : b === "1" ? 1 : 0.55,
              boxShadow: changed ? "inset 0 -2px 0 var(--hot)" : `inset 0 0 0 0.5px var(--line)`,
              fontWeight: b === "1" ? 600 : 400,
            }}
          >
            {b}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="@container">
      <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-line pb-3 text-13">
        <span className="text-faint">header =</span>
        <div className="flex flex-wrap gap-1">
          <button className="word" aria-pressed={mode === "default"} onClick={() => setMode("default")}>
            default · 12 bytes
          </button>
          <button className="word" aria-pressed={mode === "compact"} onClick={() => setMode("compact")}>
            compact · 8 bytes
          </button>
        </div>
        <span className="text-faint">object =</span>
        <div className="flex flex-wrap gap-1">
          {STATES.map((s) => (
            <button key={s.id} className="word" aria-pressed={state === s.id} onClick={() => setState(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="mb-1 flex justify-between text-[10px] text-faint">
          <span>bit 63</span>
          <span>mark word · 64 bits{mode === "compact" ? " · the whole header" : ""}</span>
          <span>bit 0</span>
        </div>
        <div className="flex flex-col gap-1 @[520px]:hidden">
          {row(0, 16)}
          {row(16, 32)}
          {row(32, 48)}
          {row(48, 64)}
        </div>
        <div className="hidden flex-col gap-1 @[520px]:flex @[980px]:hidden">
          {row(0, 32)}
          {row(32, 64)}
        </div>
        <div className="hidden @[980px]:block">{row(0, 64)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-11">
        {groups.map((g, i) => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="text-left"
            style={{ color: g.tone === "var(--faint)" ? "var(--mute)" : g.tone }}
          >
            {g.name} · {g.len}
          </button>
        ))}
      </div>

      {mode === "default" && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] text-faint">then 32 more bits: the compressed class pointer (read at offset 8)</div>
          <div className="flex flex-wrap">
            {KLASS32.split("").map((b, i) => (
              <span
                key={i}
                className="flex h-7 w-[14px] shrink-0 items-center justify-center text-11"
                style={{ color: b === "1" ? "var(--ref)" : "var(--faint)", opacity: b === "1" ? 1 : 0.55, boxShadow: "inset 0 0 0 0.5px var(--line)", fontWeight: b === "1" ? 600 : 400 }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {active ? (
          <>
            <span style={{ color: active.tone === "var(--faint)" ? "var(--mute)" : active.tone }}>{active.name}</span>: {active.note}
          </>
        ) : (
          STATES.find((s) => s.id === state)!.what
        )}
      </p>
    </div>
  );
}
