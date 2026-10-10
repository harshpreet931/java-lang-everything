"use client";

import { useState } from "react";
import { Row, Words } from "@/components/figures/basics/kit";

// an int cast to a smaller type keeps only the low bits. the rest are just dropped,
// and whatever's left is read with the new type's rules (signed for byte/short, unsigned for char).

type To = "byte" | "short" | "char";
const KEEP: Record<To, number> = { byte: 8, short: 16, char: 16 };

const PRESETS = [200, 300, 127, 128, -1, 65, 70000];

export function NarrowingChop() {
  const [text, setText] = useState("200");
  const [to, setTo] = useState<To>("byte");

  let n: number | null = null;
  try {
    const b = BigInt(text.trim().replace(/_/g, ""));
    if (b >= -2147483648n && b <= 2147483647n) n = Number(b);
  } catch {
    n = null;
  }

  const raw = n === null ? 0n : BigInt.asUintN(32, BigInt(n));
  const bits = Array.from({ length: 32 }, (_, i) => Number((raw >> BigInt(31 - i)) & 1n));
  const k = KEEP[to];
  const low = BigInt.asUintN(k, raw);
  const result = to === "char" ? Number(low) : Number(BigInt.asIntN(k, low));
  const signBit = to !== "char" ? bits[32 - k] : null;
  const shown =
    to === "char"
      ? `'${result >= 32 && result < 127 ? String.fromCharCode(result) : "\\u" + result.toString(16).padStart(4, "0")}' (${result})`
      : result.toLocaleString("en-US");
  const same = n !== null && result === n;

  return (
    <div className="font-mono text-13">
      <Row k="int x =">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="int value"
            className="w-[14ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
          />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button key={p} className="word !min-h-7 !px-2 !text-12" aria-pressed={text === String(p)} onClick={() => setText(String(p))}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </Row>
      <Row k="cast to =" last>
        <Words
          options={[
            { v: "byte", label: "(byte) x" },
            { v: "short", label: "(short) x" },
            { v: "char", label: "(char) x" },
          ]}
          value={to}
          onChange={setTo}
          label="target type"
        />
      </Row>

      {n === null ? (
        <p className="mt-4 text-dead">that&apos;s not an int (it has to fit in 32 bits).</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <div className="flex min-w-max items-end gap-[3px]">
              {[0, 1, 2, 3].map((g) => (
                <div key={g} className="flex flex-col gap-1">
                  <div className="flex gap-px">
                    {bits.slice(g * 8, g * 8 + 8).map((b, j) => {
                      const i = g * 8 + j;
                      const kept = i >= 32 - k;
                      const isSign = i === 32 - k && to !== "char";
                      return (
                        <span
                          key={i}
                          className="flex h-7 w-[9px] items-center justify-center text-[10px] transition-[opacity,background-color] duration-200 sm:w-[15px] sm:text-11"
                          style={{
                            opacity: kept ? 1 : 0.3,
                            background: kept && b ? (isSign ? "var(--hot)" : "var(--ink)") : undefined,
                            color: kept && b ? "var(--bg)" : kept ? "var(--mute)" : "var(--faint)",
                            boxShadow: kept && !b ? `inset 0 0 0 1px ${isSign ? "var(--hot)" : "var(--line-2)"}` : undefined,
                            textDecoration: kept ? undefined : "line-through",
                          }}
                        >
                          {b}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex min-w-max gap-[3px] text-[10px] text-faint">
              <span style={{ width: `calc(${(32 - k) / 32} * 100%)` }} className="text-dead">
                ← {32 - k} bits dropped
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-1 text-13" aria-live="polite">
            <div>
              <span className="text-faint">({to}) {n.toLocaleString("en-US")}</span>
              <span className="text-faint"> = </span>
              <span className={same ? "text-hi" : "text-hot"}>{shown}</span>
            </div>
            <p className="font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-mute">
              {same
                ? `it fit: the dropped bits were all copies of the sign${to === "char" ? " (zeros)" : ""}, so nothing was lost.`
                : to === "char"
                  ? `keep the low 16 bits and read them unsigned. ${n < 0 ? "a negative int turns into a big positive char." : "the top bits are simply gone."}`
                  : `keep the low ${k} bits. ${signBit ? `the leftmost kept bit is a 1, and in a ${to} that's the sign bit, so it reads as negative.` : `whatever was in the dropped bits is just gone.`}`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
