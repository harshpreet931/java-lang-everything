"use client";

import { useState } from "react";
import { Bits } from "@/components/viz/Bits";

// the eight primitive types, drawn to scale by bit width (one cell = one byte).
// ranges are the MIN_VALUE / MAX_VALUE constants, printed on jdk 25.

type P = "byte" | "short" | "char" | "int" | "long" | "float" | "double" | "boolean";

const TYPES: {
  t: P;
  bits: number;
  kind: string;
  range: string;
  dflt: string;
  wrapper: string;
  literal: string;
  use: string;
  sample?: number | string;
}[] = [
  { t: "byte", bits: 8, kind: "whole number", range: "-128 to 127", dflt: "0", wrapper: "Byte", literal: "(byte) 42", use: "raw bytes: files, network packets, images.", sample: 127 },
  { t: "short", bits: 16, kind: "whole number", range: "-32,768 to 32,767", dflt: "0", wrapper: "Short", literal: "(short) 42", use: "rare. only saves memory in very large arrays.", sample: 32767 },
  { t: "int", bits: 32, kind: "whole number", range: "-2,147,483,648 to 2,147,483,647", dflt: "0", wrapper: "Integer", literal: "42", use: "the default for whole numbers. about ±2.1 billion.", sample: 2147483647 },
  { t: "long", bits: 64, kind: "whole number", range: "-9,223,372,036,854,775,808 to 9,223,372,036,854,775,807", dflt: "0L", wrapper: "Long", literal: "42L", use: "timestamps, ids, byte counts. anything that might pass 2.1 billion.", sample: "9223372036854775807" },
  { t: "float", bits: 32, kind: "decimal", range: "±3.4028235E38, about 7 significant digits", dflt: "0.0f", wrapper: "Float", literal: "3.14f", use: "rare. graphics, ML, big arrays where half the memory matters.", sample: 0.1 },
  { t: "double", bits: 64, kind: "decimal", range: "±1.7976931348623157E308, about 15 to 17 significant digits", dflt: "0.0", wrapper: "Double", literal: "3.14", use: "the default for decimals. never for money.", sample: 0.1 },
  { t: "char", bits: 16, kind: "text", range: "0 to 65,535, written '\\u0000' to '\\uffff'", dflt: "'\\u0000'", wrapper: "Character", literal: "'A'", use: "one UTF-16 code unit. unsigned, the only one.", sample: "A" },
  { t: "boolean", bits: 0, kind: "logic", range: "true or false. that's all.", dflt: "false", wrapper: "Boolean", literal: "true", use: "no number behind it in java: if (1) doesn't compile." },
];

export function PrimitiveWidths() {
  const [sel, setSel] = useState<P>("int");
  const cur = TYPES.find((x) => x.t === sel)!;

  return (
    <div className="font-mono text-13">
      <div className="grid gap-1.5" role="group" aria-label="primitive types by size">
        {TYPES.map((x) => {
          const on = x.t === sel;
          return (
            <button
              key={x.t}
              onClick={() => setSel(x.t)}
              onMouseEnter={() => setSel(x.t)}
              aria-pressed={on}
              className="grid grid-cols-[8ch_minmax(0,1fr)_7ch] items-center gap-3 rounded-md py-1 text-left"
            >
              <span className={`transition-colors duration-150 ${on ? "text-hot" : "text-hi"}`}>{x.t}</span>
              <span className="flex h-[18px] items-center">
                {x.bits ? (
                  <span className="flex h-full gap-px" style={{ width: `${(x.bits / 64) * 100}%` }}>
                    {Array.from({ length: x.bits / 8 }, (_, i) => (
                      <span
                        key={i}
                        className="h-full flex-1 rounded-[1px] transition-[background-color,opacity] duration-150"
                        style={{
                          background: on ? "var(--hot)" : "var(--ink)",
                          opacity: on ? 0.85 : 0.35,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <span
                    className="h-full w-[10px] rounded-[1px]"
                    style={{ boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--mute)"}` }}
                  />
                )}
              </span>
              <span className="text-right text-12 text-faint tabular">{x.bits ? `${x.bits} bits` : "1 bit*"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-right text-11 text-faint">one cell = one byte</div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4" aria-live="polite">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 sm:gap-x-6">
          <span className="text-faint">range</span>
          <span className="text-hi">{cur.range}</span>
          <span className="text-faint">default</span>
          <span className="text-ink">
            {cur.dflt} <span className="text-faint">(fields and array slots only)</span>
          </span>
          <span className="text-faint">literal</span>
          <span className="text-ink">{cur.literal}</span>
          <span className="text-faint">boxed as</span>
          <span className="text-ink">{cur.wrapper}</span>
          <span className="text-faint">use for</span>
          <span className="text-ink">{cur.use}</span>
        </div>
        {cur.sample !== undefined ? (
          <div className="min-w-0 overflow-x-auto">
            <Bits
              key={cur.t}
              type={cur.t as Exclude<P, "boolean">}
              value={cur.sample}
              editable
              label={cur.t === "char" ? "char 'A', the actual bits (click to flip)" : `${cur.t}, the actual bits (click to flip)`}
            />
          </div>
        ) : (
          <p className="font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-mute">
            * a boolean holds one bit of information, but the JVM never stores just one bit: inside a method it&apos;s handled as an
            int (a whole local-variable slot), and a boolean field or <code className="text-hi">boolean[]</code> element takes a byte
            on HotSpot.
          </p>
        )}
      </div>
    </div>
  );
}
