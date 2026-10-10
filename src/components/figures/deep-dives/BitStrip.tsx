"use client";

import type { Tone } from "./kit";

// a row of bits for the bit-level figures (hash spreading, ctl packing, tableSizeFor).
// msb first, a small gap every 4 bits and a bigger one between the two 16-bit halves.
// needs an @container ancestor: bits get wider once there's room.

export function BitStrip({
  value,
  width = 32,
  toneAt,
  dimAt,
  label,
}: {
  /** the int, as a js number (only the low `width` bits are drawn) */
  value: number;
  width?: number;
  /** tone for bit index b (0 = lsb) */
  toneAt?: (b: number) => Tone | undefined;
  /** fade bit index b */
  dimAt?: (b: number) => boolean;
  label?: string;
}) {
  const s = (value >>> 0).toString(2).padStart(32, "0").slice(32 - width);
  return (
    <span className="inline-flex whitespace-nowrap" role="img" aria-label={label ?? `bits ${s}`}>
      {s.split("").map((b, i) => {
        const bit = width - 1 - i;
        const tone = toneAt?.(bit);
        const dim = dimAt?.(bit);
        const gap = i > 0 && i % 4 === 0 ? (i % 16 === 0 ? "ml-[7px] @[560px]:ml-2.5" : "ml-[2px] @[560px]:ml-[4px]") : "";
        return (
          <span
            key={i}
            aria-hidden
            className={`inline-flex h-[22px] w-[8.5px] items-center justify-center text-[10px] transition-[color,background-color,opacity] duration-200 ease-jle @[440px]:w-[10px] @[560px]:h-6 @[560px]:w-[13px] @[560px]:text-11 ${gap}`}
            style={{
              color: tone ? `var(--${tone})` : b === "1" ? "var(--hi)" : "var(--faint)",
              background: tone ? `color-mix(in srgb, var(--${tone}) ${b === "1" ? 24 : 9}%, transparent)` : undefined,
              opacity: dim ? 0.35 : 1,
            }}
          >
            {b}
          </span>
        );
      })}
    </span>
  );
}
