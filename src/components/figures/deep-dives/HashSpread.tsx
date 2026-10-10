"use client";

import { useState, type ReactNode } from "react";
import { BitStrip } from "./BitStrip";
import { javaStringHash, Row, Words } from "./kit";

// HashMap.hash(key) = h ^ (h >>> 16), then index = (n - 1) & hash. straight from
// java.util.HashMap in jdk 25. String keys use the real String.hashCode (31 * h + c),
// Integer keys hash to themselves.

type K = { v: string; label: string; h: number };

const PRESETS: K[] = [
  { v: "hello", label: '"hello"', h: javaStringHash("hello") },
  { v: "Aa", label: '"Aa"', h: javaStringHash("Aa") },
  { v: "BB", label: '"BB"', h: javaStringHash("BB") },
  { v: "65536", label: "65536", h: 65536 },
  { v: "196608", label: "3 << 16", h: 3 << 16 },
];

const SIZES = [16, 32, 64] as const;

export function HashSpread() {
  const [key, setKey] = useState<string>("hello");
  const [typed, setTyped] = useState("");
  const [n, setN] = useState<(typeof SIZES)[number]>(16);
  const [spread, setSpread] = useState(true);

  const preset = PRESETS.find((p) => p.v === key);
  const h = preset ? preset.h : javaStringHash(typed);
  const k = Math.log2(n);
  const hi = h >>> 16;
  const hash = spread ? h ^ hi : h;
  const index = hash & (n - 1);
  const inMask = (b: number) => b < k;

  const rows: { label: ReactNode; value: number; dec: string; tone?: (b: number) => "hot" | undefined; dim?: boolean }[] = [
    {
      label: (
        <>
          h <span className="text-faint">= key.hashCode()</span>
        </>
      ),
      value: h,
      dec: String(h),
      tone: (b) => (inMask(b) || (spread && b >= 16 && b < 16 + k) ? "hot" : undefined),
    },
    { label: "h >>> 16", value: hi, dec: String(hi), tone: (b) => (spread && inMask(b) ? "hot" : undefined), dim: !spread },
    {
      label: (
        <>
          hash <span className="text-faint">= h ^ (h &gt;&gt;&gt; 16)</span>
        </>
      ),
      value: hash,
      dec: String(hash | 0),
      tone: (b) => (inMask(b) ? "hot" : undefined),
      dim: !spread,
    },
    { label: `n - 1 = ${n - 1}`, value: n - 1, dec: "" },
    {
      label: (
        <>
          index <span className="text-faint">= hash &amp; (n - 1)</span>
        </>
      ),
      value: index,
      dec: "",
      tone: (b) => (inMask(b) ? "hot" : undefined),
    },
  ];

  // panel 2: sixteen Integer keys that only differ above bit 16
  const counts = new Array(n).fill(0);
  for (let i = 0; i < 16; i++) {
    const kh = i << 16;
    counts[(spread ? kh ^ (kh >>> 16) : kh) & (n - 1)]++;
  }
  const used = counts.filter((c) => c > 0).length;

  return (
    <div className="@container text-13">
      <Row k="key =" w="8ch">
        <div className="flex flex-wrap items-center gap-1">
          <Words
            label="key"
            value={key}
            onChange={setKey}
            options={[...PRESETS.map((p) => ({ v: p.v, label: p.label })), { v: "typed", label: "type one" }]}
          />
          {key === "typed" && (
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="any string"
              aria-label="a string key"
              autoFocus
              className="ml-1 w-[16ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
              spellCheck={false}
            />
          )}
        </div>
      </Row>
      <Row k="n =" w="8ch">
        <Words label="table length" value={n} onChange={setN} options={SIZES.map((s) => ({ v: s, label: String(s) }))} />
      </Row>
      <Row k="spread =" w="8ch" last>
        <Words
          label="spread the high bits"
          value={spread ? "on" : "off"}
          onChange={(v) => setSpread(v === "on")}
          options={[
            { v: "on", label: "h ^ (h >>> 16)" },
            { v: "off", label: "off (just h)" },
          ]}
        />
      </Row>

      <div className="mt-3 grid gap-y-2.5 border-t border-line pt-4">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`grid items-center gap-x-4 gap-y-0.5 transition-opacity duration-200 @[680px]:grid-cols-[25ch_auto_minmax(0,1fr)] ${
              r.dim ? "opacity-35" : ""
            } ${i === 4 ? "border-t border-line pt-2.5" : ""}`}
          >
            <span className="text-12 text-ink">{r.label}</span>
            <BitStrip value={r.value} toneAt={r.tone} label={`${typeof r.label === "string" ? r.label : "row"}: ${(r.value >>> 0).toString(2)}`} />
            <span className="hidden text-right text-11 text-faint tabular @[680px]:block">{r.dec}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        <span className="text-faint">lands in</span>
        <span className="text-20 font-light text-hot tabular">bin {index}</span>
        <span className="text-12 text-mute">
          {spread
            ? `the low ${k} bits of hash: h's bits 0 to ${k - 1} XOR its bits 16 to ${15 + k}.`
            : `the low ${k} bits of h. the top ${32 - k} bits never get a say.`}
        </span>
      </div>

      <div className="mt-7 border-t border-line pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-12">
          <span className="text-ink">
            16 Integer keys: <span className="text-hi">0, 1 &lt;&lt; 16, 2 &lt;&lt; 16 … 15 &lt;&lt; 16</span>
          </span>
          <span className={used === 1 ? "text-dead" : "text-live"}>
            {used === 1 ? "all 16 in one bin" : `${used} bins used`}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-px" role="img" aria-label={`${used} of ${n} bins used`}>
          {counts.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className="flex h-7 w-full items-center justify-center text-11 tabular transition-[background-color,box-shadow,color] duration-200"
                style={{
                  boxShadow: `inset 0 0 0 1px ${c > 1 ? "var(--dead)" : c === 1 ? "color-mix(in srgb, var(--live) 60%, transparent)" : "var(--line)"}`,
                  background: c > 1 ? "color-mix(in srgb, var(--dead) 14%, transparent)" : c === 1 ? "color-mix(in srgb, var(--live) 10%, transparent)" : undefined,
                  color: c > 1 ? "var(--dead)" : c === 1 ? "var(--live)" : "var(--faint)",
                }}
              >
                {c || ""}
              </div>
              {(i % 16 === 0 || i % 16 === 15 || n === 16) && (
                <span className="mt-0.5 hidden text-[10px] text-faint tabular @[440px]:block">{i}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
