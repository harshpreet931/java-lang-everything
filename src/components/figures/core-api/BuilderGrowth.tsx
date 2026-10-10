"use client";

import { useState } from "react";
import { Row } from "./kit";

// a StringBuilder's byte[] buffer, growing as you append.
// the rules are AbstractStringBuilder in jdk 25 (temurin 25.0.4), checked by running it:
//   same coder:  newCapacity = max(needed, old * 2 + 2)      16 → 34 → 70 → 142 → 286
//   latin1 → utf16 with growth: newCapacity = max(needed, old + 2)   (16 full + '€' → 18)
//   latin1 → utf16 without growth: same capacity, twice the bytes
// one cell = one byte of the backing array.

type Coder = 0 | 1;
type Ev = { text: string; old?: number; grew?: boolean };
type S = { count: number; cap: number; coder: Coder; last: number; copied: number; log: Ev[]; ghost: number | null; chars: string };

const MAX = 140;
const init: S = { count: 0, cap: 16, coder: 0, last: 0, copied: 0, log: [{ text: "new StringBuilder()  →  byte[16]" }], ghost: null, chars: "" };

function append(s: S, str: string, wide: boolean): S {
  const len = str.length;
  const min = s.count + len;
  const newCoder: Coder = (s.coder | (wide ? 1 : 0)) as Coder;
  const oldBytes = s.cap << s.coder;
  let cap = s.cap;
  let ev: Ev | null = null;
  let copied = s.copied;
  let ghost: number | null = null;

  if (newCoder !== s.coder) {
    // inflate: every existing char goes from 1 byte to 2
    cap = min > s.cap ? Math.max(min, s.cap + 2) : s.cap;
    copied += s.count;
    ghost = oldBytes;
    ev = { text: `'€' is not latin-1  →  inflate to UTF16, byte[${oldBytes}] → byte[${cap << 1}]`, old: oldBytes, grew: true };
  } else if (min > s.cap) {
    cap = Math.max(min, s.cap * 2 + 2);
    copied += s.count << s.coder;
    ghost = oldBytes;
    ev = { text: `needs ${min}, has ${s.cap}  →  grow to ${cap} (${s.cap} × 2 + 2), copy ${s.count << s.coder} bytes`, old: oldBytes, grew: true };
  }
  return {
    count: min,
    cap,
    coder: newCoder,
    last: len,
    copied,
    ghost,
    chars: s.chars + str,
    log: ev ? [...s.log, ev].slice(-4) : s.log,
  };
}

export function BuilderGrowth() {
  const [s, set] = useState<S>(init);
  const bytes = s.cap << s.coder;
  const used = s.count << s.coder;
  const fresh = s.last << s.coder;
  const full = s.count >= MAX;

  const cells = Array.from({ length: bytes }, (_, i) => {
    if (i >= used) return "empty";
    if (i >= used - fresh) return "new";
    return "old";
  });

  return (
    <div className="font-mono @container">
      <div className="text-13">
        <Row k="append =">
          <div className="flex flex-wrap gap-1.5">
            <button className="act" disabled={full} onClick={() => set((x) => append(x, "a", false))}>
              .append(&apos;a&apos;)
            </button>
            <button className="act" disabled={full} onClick={() => set((x) => append(x, "abcdefghij", false))}>
              .append(&quot;abcdefghij&quot;)
            </button>
            <button className="act" disabled={full} onClick={() => set((x) => append(x, "€", true))}>
              .append(&apos;€&apos;)
            </button>
            <button className="act" onClick={() => set(init)} disabled={s.count === 0}>
              reset
            </button>
          </div>
        </Row>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-12 @[560px]:grid-cols-4" aria-live="polite">
        <Stat k="length()" v={s.count} />
        <Stat k="capacity()" v={s.cap} />
        <Stat k="value" v={`byte[${bytes}]`} />
        <Stat k="coder" v={s.coder ? "UTF16" : "LATIN1"} hot={s.coder === 1} />
      </div>

      <div
        className="mt-4 flex flex-wrap gap-[3px] rounded-md bg-well p-3 shadow-[inset_0_0_0_1px_var(--line)]"
        role="img"
        aria-label={`backing array of ${bytes} bytes, ${used} used`}
      >
        {cells.map((c, i) => (
          <span
            key={i}
            className="h-[14px] w-[9px] rounded-[1px] transition-colors duration-200"
            style={{
              background: c === "new" ? "var(--hot)" : c === "old" ? "var(--ink)" : "transparent",
              opacity: c === "old" ? 0.55 : 1,
              boxShadow: c === "empty" ? "inset 0 0 0 1px var(--line-2)" : undefined,
              marginRight: s.coder === 1 && i % 2 === 1 ? 3 : undefined,
            }}
          />
        ))}
      </div>

      {s.ghost !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-11">
          <span className="flex flex-wrap gap-[3px] opacity-60" aria-hidden>
            {Array.from({ length: Math.min(s.ghost, 70) }, (_, i) => (
              <span key={i} className="h-[6px] w-[4px] rounded-[1px] bg-dead" />
            ))}
          </span>
          <span className="text-dead">old byte[{s.ghost}], garbage now</span>
        </div>
      )}

      <ol className="mt-4 grid gap-1 border-t border-line pt-3 text-12 leading-[1.6]">
        {s.log.map((e, i) => (
          <li key={`${i}-${e.text}`} className={i === s.log.length - 1 ? (e.grew ? "text-hot" : "text-hi") : "text-faint"}>
            {e.text}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-11 text-faint">
        <span>
          bytes copied by growth so far: <span className="text-mute tabular">{s.copied}</span>
        </span>
        <span>{full ? "that's enough to see the pattern." : "one cell = one byte"}</span>
      </div>
    </div>
  );
}

function Stat({ k, v, hot }: { k: string; v: string | number; hot?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className={`tabular ${hot ? "text-hot" : "text-hi"}`}>{v}</span>
    </div>
  );
}
