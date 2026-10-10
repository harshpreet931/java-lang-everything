"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// what a String's byte[] value actually holds (JEP 254, compact strings, java 9+).
// bytes read with reflection on temurin 25.0.4 (aarch64, little-endian):
//   "hello" → 68 65 6c 6c 6f                    coder 0 (LATIN1)
//   "héllo" → 68 e9 6c 6c 6f                    coder 0 (é is U+00E9, still one byte)
//   "h€llo" → 68 00 ac 20 6c 00 6c 00 6f 00     coder 1 (UTF16, low byte first)
//   "hi😀"  → 68 00 69 00 3d d8 00 de            coder 1, length() 4: the emoji is two chars

const PRESETS = ["hello", "héllo", "h€llo", "hi😀"] as const;

const hex = (n: number) => n.toString(16).padStart(2, "0");

export function CompactStrings() {
  const [text, setText] = useState<string>("h€llo");
  const units = Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const utf16 = units.some((u) => u > 0xff);
  const bytes = utf16 ? units.length * 2 : units.length;

  const glyph = (i: number) => {
    const u = units[i];
    if (u >= 0xd800 && u <= 0xdbff) return { g: String.fromCodePoint(text.codePointAt(i) ?? u), sur: false };
    if (u >= 0xdc00 && u <= 0xdfff) return { g: "(pair)", sur: true };
    if (u === 0x20) return { g: "␠", sur: false };
    return { g: text[i], sur: false };
  };

  return (
    <div className="font-mono @container">
      <div className="text-13">
        <Row k="s =">
          <Words<string> label="preset strings" options={PRESETS.map((p) => ({ v: p, label: `"${p}"` }))} value={text} onChange={setText} />
        </Row>
        <Row k="or type =">
          <input
            value={text}
            maxLength={14}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            aria-label="type a string"
            className="w-full max-w-[24ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
          />
        </Row>
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-[5px]" role="img" aria-label={`${text.length} chars stored in ${bytes} bytes, coder ${utf16 ? "UTF16" : "LATIN1"}`}>
          {units.map((u, i) => {
            const { g, sur } = glyph(i);
            const hot = u > 0xff;
            const b = utf16 ? [u & 0xff, u >> 8] : [u];
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className={`flex h-7 items-center text-15 ${sur ? "text-11 text-faint" : hot ? "text-hot" : "text-hi"}`}>{g}</span>
                <span className="text-[10px] text-faint tabular">{i}</span>
                <div className="flex gap-px">
                  {b.map((x, j) => (
                    <span
                      key={j}
                      className="flex h-8 w-[30px] items-center justify-center rounded-[1px] text-12 tabular"
                      style={{
                        boxShadow: `inset 0 0 0 1px ${hot ? "var(--hot)" : x === 0 && j === 1 ? "var(--line)" : "var(--line-2)"}`,
                        color: hot ? "var(--hot)" : x === 0 && j === 1 ? "var(--faint)" : "var(--ink)",
                      }}
                    >
                      {hex(x)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {units.length === 0 && <span className="text-12 text-faint">the empty string: byte[0]. still an object, though.</span>}
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-1 text-12 @[560px]:grid-cols-3" aria-live="polite">
        <Stat k="coder" v={utf16 ? "UTF16 (1)" : "LATIN1 (0)"} hot={utf16} />
        <Stat k="length()" v={String(text.length)} />
        <Stat k="value.length" v={`${bytes} bytes`} />
      </div>
      <p className="mt-3 font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-mute">
        {utf16 ? (
          <>
            one char above <span className="text-hi">0xFF</span> and the <em>whole</em> string switches to 2 bytes per char. the zero bytes
            are the price.
          </>
        ) : (
          <>
            every char fits in one byte, so it costs {bytes} bytes. before java 9 it would have been {units.length * 2}.
          </>
        )}
      </p>
    </div>
  );
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className={`tabular ${hot ? "text-hot" : "text-hi"}`}>{v}</span>
    </div>
  );
}
