"use client";

import { useState } from "react";
import { Readout } from "./kit";

// a generational ZGC colored pointer (a "zpointer"): the address in the high bits, 16 bits of
// metadata ("colors") in the low bits. layout per src/hotspot/share/gc/z/zAddress.hpp:
//   RRRR MM mm FF rr 0000   (bit 15 → bit 0)
//   RRRR remapped (one-hot), MM marked old, mm marked young, FF finalizable, rr remembered,
//   0000 reserved.
// the load barrier only looks at RRRR: is this pointer's remapped bit the currently good one?

type G = "addr" | "R" | "M" | "m" | "F" | "r" | "z";

const GROUPS: { g: G; bits: number; label: string; tone: string; what: string }[] = [
  { g: "R", bits: 4, label: "remapped", tone: "var(--hot)", what: "one-hot: exactly one of these 4 bits is set. which one is \"good\" changes every time a young or old GC starts relocating. the load barrier checks only this: does the pointer carry the good one? if not, the address may be stale." },
  { g: "M", bits: 2, label: "marked old", tone: "var(--meta)", what: "has this pointer been seen by the current old-generation mark? two bits, because the meaning alternates between cycles (so nothing ever needs clearing)." },
  { g: "m", bits: 2, label: "marked young", tone: "var(--meta)", what: "the same thing for the young-generation mark. young and old cycles run independently, so each gets its own pair." },
  { g: "F", bits: 2, label: "finalizable", tone: "var(--meta)", what: "marked only through a finalizer, not strongly. needed for the rules of java.lang.ref." },
  { g: "r", bits: 2, label: "remembered", tone: "var(--meta)", what: "used by the store barrier: has this field already been recorded in the remembered set (old → young pointers) this cycle?" },
  { g: "z", bits: 4, label: "reserved", tone: "var(--faint)", what: "unused for now." },
];

const ADDR_WHAT =
  "the object's address, stored above the 16 color bits. to use it, the barrier shifts the colors off. this is generational ZGC (java 21+). the old non-generational ZGC kept 4 color bits just above the address instead, and mapped the heap three times in virtual memory to make that work.";

export function ColoredPointer() {
  const [good, setGood] = useState(2); // which remapped bit (0..3) is good right now
  const [ptrR, setPtrR] = useState(2); // the remapped bit our example pointer carries
  const [sel, setSel] = useState<G | null>(null);
  const isGood = good === ptrR;

  const bitsFor = (g: G): number[] => {
    switch (g) {
      case "R":
        return [3, 2, 1, 0].map((i) => (i === ptrR ? 1 : 0));
      case "M":
        return [0, 1];
      case "m":
        return [1, 0];
      case "F":
        return [0, 0];
      case "r":
        return [0, 1];
      default:
        return [0, 0, 0, 0];
    }
  };

  const explain = sel === "addr" ? ADDR_WHAT : sel ? GROUPS.find((x) => x.g === sel)!.what : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        {/* high 48 bits */}
        <button
          className="flex h-[58px] min-w-0 flex-col justify-between rounded-md px-3 py-2 text-left transition-[box-shadow] duration-150"
          style={{ background: "var(--bg)", boxShadow: `inset 0 0 0 ${sel === "addr" ? 2 : 1}px ${sel === "addr" ? "var(--hi)" : "var(--ref)"}` }}
          onMouseEnter={() => setSel("addr")}
          onFocus={() => setSel("addr")}
          onClick={() => setSel("addr")}
        >
          <span className="flex justify-between text-[10px] text-faint tabular">
            <span>63</span>
            <span>16</span>
          </span>
          <span className="truncate text-12 text-ref">address of the object</span>
        </button>
        {/* low 16 bits */}
        <div className="flex gap-[5px]">
          {GROUPS.map((grp) => {
            const on = sel === grp.g;
            return (
              <button
                key={grp.g}
                className="flex flex-col items-center gap-1"
                onMouseEnter={() => setSel(grp.g)}
                onFocus={() => setSel(grp.g)}
                onClick={() => setSel(grp.g)}
                aria-label={grp.label}
              >
                <span className="flex gap-[2px]">
                  {bitsFor(grp.g).map((b, i) => {
                    const isRemapped = grp.g === "R";
                    const goodBit = isRemapped && 3 - i === good;
                    return (
                      <span
                        key={i}
                        className="flex h-[30px] w-[15px] items-center justify-center rounded-[3px] text-12 tabular sm:w-[18px]"
                        style={{
                          color: b ? grp.tone : "var(--faint)",
                          background: b ? `color-mix(in srgb, ${grp.tone} 16%, var(--bg))` : "var(--bg)",
                          boxShadow: `inset 0 0 0 ${on ? 1.6 : 1}px ${on ? "var(--hi)" : b ? grp.tone : "var(--line-2)"}`,
                          outline: goodBit ? "1px dashed var(--live)" : undefined,
                          outlineOffset: 2,
                        }}
                      >
                        {b}
                      </span>
                    );
                  })}
                </span>
                <span className="text-[10px] leading-none" style={{ color: on ? "var(--hi)" : grp.tone }}>
                  {grp.g === "z" ? "0000" : grp.g.repeat(grp.bits)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 text-12 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-2">
          <button className="act" onClick={() => setGood((g) => (g + 1) % 4)}>
            start a new relocation phase
          </button>
          <span className="text-faint">
            good bit: <span className="text-live tabular">R{good}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button className="act" onClick={() => setPtrR(good)} disabled={isGood}>
            load it (barrier heals it)
          </button>
          <span style={{ color: isGood ? "var(--live)" : "var(--dead)" }}>{isGood ? "good: fast path" : "stale: slow path"}</span>
        </div>
      </div>

      <Readout minLines={3}>
        {explain ??
          (isGood
            ? "this pointer's remapped bit (R" + ptrR + ") is the good one. the load barrier tests the color, sees it's fine, strips it and hands you the address. a test and a branch. hover the bits to see what each group is for."
            : "the GC started a new relocation phase and changed which remapped bit is good. this pointer wasn't touched, it just became stale. the next load takes the slow path: look up where the object went, then write the fixed, good-colored pointer back into the field.")}
      </Readout>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        <span>
          <span className="text-ref">blue</span> the address
        </span>
        <span>
          <span className="text-hot">amber</span> what the load barrier checks
        </span>
        <span>
          <span className="text-meta">purple</span> what marking and the store barrier use
        </span>
        <span>
          <span className="text-live">dashed green</span> the good remapped bit
        </span>
      </div>
    </div>
  );
}
