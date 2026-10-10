"use client";

import { useEffect, useState } from "react";
import { NARR, Row } from "./kit";

// SHA-256 in the browser (crypto.subtle) is the same function as java's
// MessageDigest.getInstance("SHA-256"): same input bytes (UTF-8), same 32-byte digest.
// the default pair was checked on jdk 25: 126 of 256 bits differ.
//   "transfer 100 to bob" → 75b79cfd a6fb3276 8bca896c fc3fcff9 6e6dd92c 04cbbe89 4a28774d 7902bfab
//   "transfer 900 to bob" → 7654b974 bec8906b a6edcfa6 aab07bdf 8ac47e1b 5a4101f0 6b25dab8 34bafb41

const DEFAULT_A = "transfer 100 to bob";
const DEFAULT_B = "transfer 900 to bob";
const KNOWN: Record<string, string> = {
  [DEFAULT_A]: "75b79cfda6fb32768bca896cfc3fcff96e6dd92c04cbbe894a28774d7902bfab",
  [DEFAULT_B]: "7654b974bec8906ba6edcfa6aab07bdf8ac47e1b5a4101f06b25dab834bafb41",
};

async function sha256(text: string): Promise<string | null> {
  if (KNOWN[text]) return KNOWN[text];
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const bits = (hex: string) =>
  hex
    .match(/../g)!
    .map((h) => parseInt(h, 16).toString(2).padStart(8, "0"))
    .join("");

export function Avalanche() {
  const [a, setA] = useState(DEFAULT_A);
  const [b, setB] = useState(DEFAULT_B);
  const [ha, setHa] = useState<string | null>(KNOWN[DEFAULT_A]);
  const [hb, setHb] = useState<string | null>(KNOWN[DEFAULT_B]);

  useEffect(() => {
    let live = true;
    sha256(a).then((h) => live && setHa(h));
    sha256(b).then((h) => live && setHb(h));
    return () => {
      live = false;
    };
  }, [a, b]);

  const ba = ha ? bits(ha) : "";
  const bb = hb ? bits(hb) : "";
  const diff = ba && bb ? [...ba].filter((x, i) => x !== bb[i]).length : 0;
  const inputDiff = a === b ? 0 : [...a].filter((c, i) => c !== b[i]).length + Math.abs(a.length - b.length);

  return (
    <div className="@container text-13">
      <Row k="a =" w="4ch">
        <input
          value={a}
          onChange={(e) => setA(e.target.value.slice(0, 60))}
          className="w-full min-w-0 border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
          spellCheck={false}
          aria-label="first input"
        />
      </Row>
      <Row k="b =" w="4ch" last>
        <input
          value={b}
          onChange={(e) => setB(e.target.value.slice(0, 60))}
          className="w-full min-w-0 border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
          spellCheck={false}
          aria-label="second input"
        />
      </Row>

      {ha && hb ? (
        <>
          <div className="mt-4 grid gap-1 text-11 tabular break-all sm:text-12">
            <div>
              <span className="text-faint">sha256(a) </span>
              <span className="text-ink">{ha}</span>
            </div>
            <div>
              <span className="text-faint">sha256(b) </span>
              {hb.split("").map((c, i) => (
                <span key={i} style={{ color: c !== ha[i] ? "var(--hot)" : "var(--ink)" }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid max-w-[520px] gap-[2px]" style={{ gridTemplateColumns: "repeat(32, minmax(0, 1fr))" }} role="img" aria-label={`${diff} of 256 bits differ`}>
            {[...ba].map((x, i) => {
              const d = x !== bb[i];
              return (
                <span
                  key={i}
                  className="aspect-square rounded-[1px] transition-[background-color] duration-200"
                  style={{ background: d ? "var(--hot)" : "var(--well-2)", boxShadow: d ? "none" : "inset 0 0 0 1px var(--line)" }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-12">
            <span className="text-faint">
              input chars changed = <span className="text-hi tabular">{inputDiff}</span>
            </span>
            <span className="text-faint">
              digest bits changed = <span className="text-16 text-hot tabular">{diff}</span> <span className="text-faint">/ 256</span>
            </span>
          </div>
          <p className={`mt-3 ${NARR}`} aria-live="polite">
            {a === b
              ? "same input, same digest. every time, on every machine. that's what makes it a fingerprint."
              : `about half the bits flip (${diff} of 256), and you can't predict which. a tiny change in the input looks like a completely unrelated digest: that's the avalanche effect.`}
          </p>
        </>
      ) : (
        <p className="mt-4 text-12 text-faint">this browser won&apos;t compute SHA-256 here (it needs a secure context). the default pair above differs in 126 of 256 bits, checked on jdk 25.</p>
      )}
    </div>
  );
}
