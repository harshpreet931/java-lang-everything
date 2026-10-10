"use client";

import { useState } from "react";

// EnumSet<Day> is one long. bit i is set when the constant with ordinal i is in the set.
// (java.util.RegularEnumSet keeps it in a field called `elements`; enums with more than 64
// constants get JumboEnumSet, a long[].) click days to toggle them.

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

export function EnumSetBits() {
  const [bits, setBits] = useState(0b0010101); // MONDAY, WEDNESDAY, FRIDAY
  const [last, setLast] = useState<number>(4);

  const toggle = (i: number) => {
    setBits(bits ^ (1 << i));
    setLast(i);
  };
  const members = DAYS.filter((_, i) => bits & (1 << i));
  const on = (bits & (1 << last)) !== 0;

  return (
    <div className="grid gap-5 text-13">
      <div className="flex flex-wrap gap-1" role="group" aria-label="days in the set">
        {DAYS.map((d, i) => (
          <button key={d} className="word" aria-pressed={(bits & (1 << i)) !== 0} onClick={() => toggle(i)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="rounded-md bg-well px-3.5 py-3 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">EnumSet.of(</span>
        <span className="text-hi">{members.length ? members.join(", ") : ""}</span>
        <span className="text-faint">)</span>
        {!members.length && <span className="ml-2 text-faint">// EnumSet.noneOf(Day.class)</span>}
      </div>

      {/* the long */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-11 text-faint">
          <span>long elements <span className="sm:hidden">(57 more zero bits on the left)</span></span>
          <span className="tabular">= {bits} = 0b{bits.toString(2).padStart(7, "0")}</span>
        </div>
        <div className="flex items-stretch gap-1" role="img" aria-label={`bits: ${bits.toString(2).padStart(7, "0")}`}>
          <div className="hidden min-w-0 flex-1 items-center justify-center rounded-md bg-well px-2 sm:flex text-center text-[10px] text-faint shadow-[inset_0_0_0_1px_var(--line)]">
            57 more zero bits
          </div>
          {DAYS.map((_, k) => {
            const i = DAYS.length - 1 - k; // bit 6 on the left, bit 0 on the right
            const d = DAYS[i];
            const set = (bits & (1 << i)) !== 0;
            const isLast = i === last;
            return (
              <button
                key={d}
                onClick={() => toggle(i)}
                className="flex min-w-0 flex-1 flex-col items-center rounded-md sm:w-12 sm:flex-none py-1.5 transition-[box-shadow,background-color] duration-150 ease-jle"
                style={{
                  boxShadow: `inset 0 0 0 1px ${isLast ? "var(--hot)" : set ? "var(--live)" : "var(--line-2)"}`,
                  background: set ? "color-mix(in srgb, var(--live) 12%, var(--well))" : "var(--well)",
                }}
                aria-label={`bit ${i}, ${DAYS[i]}, ${set ? "1" : "0"}`}
              >
                <span className={`text-15 tabular ${set ? "text-live" : "text-faint"}`}>{set ? 1 : 0}</span>
                <span className="text-[10px] text-faint tabular">bit {i}</span>
                <span className="text-[10px] text-mute">{d.slice(0, 3).toLowerCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1 rounded-md bg-well px-3.5 py-3 text-12 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div>
          <span className="text-mute">set.contains({DAYS[last]})</span>
          <span className="text-faint"> is </span>
          <span className="text-ink">(elements &amp; (1L &lt;&lt; {last})) != 0</span>
          <span className="text-faint"> → </span>
          <span className={on ? "text-live" : "text-dead"}>{String(on)}</span>
        </div>
        <div className="text-faint">
          size() is Long.bitCount(elements) = <span className="text-hi">{members.length}</span>. add and remove are one OR / AND-NOT. no hashing, no objects.
        </div>
      </div>
    </div>
  );
}
