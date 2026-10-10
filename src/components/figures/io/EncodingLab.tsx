"use client";

import { useMemo, useState } from "react";
import { ByteCell, Row, Words, hex2, ring, tint, NARR } from "./kit";

// type text, see the bytes java would produce with s.getBytes(charset).
// the encoders below follow the JDK's: UTF-8 and UTF-16 (big-endian, like UTF_16BE;
// String.getBytes(UTF_16) adds an fe ff byte-order mark in front), and for ISO-8859-1 /
// US-ASCII an unmappable code point becomes one 3f ('?'). checked against jdk 25:
//   "hé😀" → UTF-8 68 c3 a9 f0 9f 98 80 · UTF-16BE 00 68 00 e9 d8 3d de 00 · ISO-8859-1 68 e9 3f · US-ASCII 68 3f 3f
// java's String.length() counts UTF-16 chars, which is exactly what a JS string's .length counts too.

type Enc = "utf-8" | "utf-16" | "iso-8859-1" | "us-ascii";

const PRESETS = ["hé😀", "hello", "naïve café", "€5", "日本", "👍🏽"];

function encode(cp: number, enc: Enc): number[] {
  if (enc === "utf-8") {
    if (cp < 0x80) return [cp];
    if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 63)];
    if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
    return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  }
  if (enc === "utf-16") {
    return units(cp).flatMap((u) => [u >> 8, u & 0xff]);
  }
  if (enc === "iso-8859-1") return [cp <= 0xff ? cp : 0x3f];
  return [cp <= 0x7f ? cp : 0x3f];
}

function units(cp: number): number[] {
  if (cp < 0x10000) return [cp];
  const v = cp - 0x10000;
  return [0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff)];
}

const lost = (cp: number, enc: Enc) => (enc === "iso-8859-1" && cp > 0xff) || (enc === "us-ascii" && cp > 0x7f);
const uplus = (cp: number) => "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
const glyph = (cp: number) => (cp === 0x20 ? "␠" : String.fromCodePoint(cp));

export function EncodingLab() {
  const [text, setText] = useState("hé😀");
  const [enc, setEnc] = useState<Enc>("utf-8");
  const [sel, setSel] = useState(2);

  const cps = useMemo(() => Array.from(text).map((c) => c.codePointAt(0)!), [text]);
  const pick = Math.min(sel, Math.max(0, cps.length - 1));
  const totals = useMemo(() => {
    const t = { "utf-8": 0, "utf-16": 0, "iso-8859-1": 0, "us-ascii": 0 } as Record<Enc, number>;
    for (const cp of cps) for (const e of Object.keys(t) as Enc[]) t[e] += encode(cp, e).length;
    return t;
  }, [cps]);
  const lostCount = cps.filter((cp) => lost(cp, enc)).length;
  const cp = cps[pick];

  return (
    <div className="@container text-13">
      <Row k="text =" w="10ch">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 24))}
          className="w-full min-w-0 border-b border-line-2 bg-transparent py-1 text-15 text-hi outline-none focus:border-hi"
          spellCheck={false}
          aria-label="text to encode"
        />
      </Row>
      <Row k="try =" w="10ch">
        {PRESETS.map((p) => (
          <button key={p} className="word" aria-pressed={text === p} onClick={() => (setText(p), setSel(0))}>
            {p}
          </button>
        ))}
      </Row>
      <Row k="charset =" w="10ch" last>
        <Words
          label="charset"
          options={[
            { v: "utf-8", label: "UTF-8" },
            { v: "utf-16", label: "UTF-16" },
            { v: "iso-8859-1", label: "ISO-8859-1" },
            { v: "us-ascii", label: "US-ASCII" },
          ]}
          value={enc}
          onChange={setEnc}
        />
      </Row>

      {/* one card per code point */}
      <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="code points and their bytes">
        {cps.length === 0 && <span className="text-12 text-faint">type something.</span>}
        {cps.map((c, i) => {
          const bytes = encode(c, enc);
          const isLost = lost(c, enc);
          const on = i === pick;
          return (
            <button
              key={i}
              role="listitem"
              onClick={() => setSel(i)}
              className="flex min-w-[64px] flex-col items-center gap-1.5 rounded-md px-2 py-2 transition-[box-shadow] duration-150 ease-jle"
              style={{ boxShadow: on ? ring("hot") : ring("line") }}
              aria-label={`${uplus(c)}, ${bytes.length} byte${bytes.length > 1 ? "s" : ""}`}
            >
              <span className="text-20 leading-none text-hi">{glyph(c)}</span>
              <span className="text-[10px] text-faint tabular">{uplus(c)}</span>
              <span className="flex gap-0.5">
                {bytes.map((b, j) => (
                  <ByteCell key={j} b={b} tone={isLost ? "dead" : on ? "hot" : undefined} />
                ))}
              </span>
              {enc === "utf-16" && c > 0xffff && <span className="text-[10px] text-ref">2 chars</span>}
            </button>
          );
        })}
      </div>

      {/* totals */}
      <div className="mt-5 grid gap-x-6 gap-y-1 border-t border-line pt-3 text-12 @[520px]:grid-cols-2">
        <span className="text-faint">
          s.length() = <span className="text-hi tabular">{text.length}</span>
          <span className="text-faint"> (UTF-16 chars)</span>
        </span>
        <span className="text-faint">
          code points = <span className="text-hi tabular">{cps.length}</span>
        </span>
        {(Object.keys(totals) as Enc[]).map((e) => (
          <span key={e} className={e === enc ? "text-ink" : "text-faint"}>
            {e === "utf-8" ? "UTF-8" : e === "utf-16" ? "UTF-16BE" : e.toUpperCase()} ={" "}
            <span className={e === enc ? "text-hi tabular" : "tabular"}>{totals[e]} bytes</span>
            {e !== "utf-8" && e !== "utf-16" && cps.some((c) => lost(c, e)) && <span className="text-dead"> (lossy)</span>}
          </span>
        ))}
      </div>

      {/* the microscope */}
      {cp !== undefined && (
        <div className="mt-5 rounded-md bg-well p-3.5 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
          <div className="mb-2 text-12 text-faint">
            <span className="text-hi">{glyph(cp)}</span> {uplus(cp)} in {enc.toUpperCase()}
          </div>
          {enc === "utf-8" ? (
            <Utf8Bits cp={cp} />
          ) : enc === "utf-16" ? (
             <p className={NARR}>
              {cp > 0xffff ? (
                <>
                  too big for one 16-bit char, so it&apos;s split into a <span className="text-ref">surrogate pair</span>: (0x{cp.toString(16)} - 0x10000)
                  = 20 bits → high 10 bits + d800 = <span className="text-hot">{units(cp)[0].toString(16)}</span>, low 10 bits + dc00 ={" "}
                  <span className="text-hot">{units(cp)[1].toString(16)}</span>. that&apos;s why <code className="text-hi">&quot;{glyph(cp)}&quot;.length()</code> is 2.
                </>
              ) : (
                <>
                  fits in one 16-bit char: <span className="text-hot">{cp.toString(16).padStart(4, "0")}</span>. this is literally what a java{" "}
                  <code className="text-hi">char</code> holds.
                </>
              )}
            </p>
          ) : (
             <p className={NARR}>
              {lost(cp, enc) ? (
                <>
                  {enc.toUpperCase()} only has {enc === "us-ascii" ? 128 : 256} characters and this isn&apos;t one of them. java writes{" "}
                  <span className="text-dead">3f</span> (a literal <code className="text-hi">?</code>) and moves on. no exception. the character is gone
                  {lostCount > 1 ? `, and so are ${lostCount - 1} more in this text.` : "."}
                </>
              ) : (
                <>
                  one byte, and it&apos;s just the code point: <span className="text-hot">{hex2(cp)}</span>.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// split the payload bits the way UTF-8 will pour them into bytes: 7 | 5,6 | 4,6,6 | 3,6,6,6
function chunks(bits: string, n: number) {
  const sizes = [[7], [5, 6], [4, 6, 6], [3, 6, 6, 6]][n - 1];
  let at = 0;
  return sizes.map((k) => bits.slice(at, (at += k)));
}

function Utf8Bits({ cp }: { cp: number }) {
  const n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  const payload = [7, 11, 16, 21][n - 1];
  const bits = cp.toString(2).padStart(payload, "0");
  const bytes = encode(cp, "utf-8");
  // prefix lengths per byte
  const pre = n === 1 ? [1] : [n + 1, ...Array(n - 1).fill(2)];
  return (
    <div className="grid gap-3">
      <div className="text-12 text-mute">
        code point bits <span className="text-hot tabular break-all">{chunks(bits, n).join(" ")}</span>
        <span className="text-faint"> · {payload} bits → {n} byte{n > 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {bytes.map((b, i) => {
          const s = b.toString(2).padStart(8, "0");
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="flex rounded-[1px] px-1 py-0.5 text-12 tabular" style={{ boxShadow: ring("line-2") }}>
                {s.split("").map((bit, j) => (
                  <span
                    key={j}
                    className="inline-block w-[1.1ch] text-center"
                    style={j < pre[i] ? { color: "var(--meta)" } : { color: "var(--hot)", background: tint("hot", 10) }}
                  >
                    {bit}
                  </span>
                ))}
              </span>
              <span className="text-[10px] text-faint tabular">{hex2(b)}</span>
            </div>
          );
        })}
      </div>
      <p className="font-serif text-15 leading-[1.6] text-mute">
        <span style={{ color: "var(--meta)" }}>purple</span> bits are UTF-8&apos;s bookkeeping: the first byte says how many bytes follow, every
        continuation byte starts with 10. the <span className="text-hot">amber</span> bits are the code point, poured in left to right.
      </p>
    </div>
  );
}
