"use client";

import { useState } from "react";

// SIMD in one picture: 16 floats, processed one per instruction (scalar) or a whole vector
// per instruction. FloatVector.SPECIES_PREFERRED was 128 bits (4 floats) on the apple M4
// this site measures on; x64 machines with AVX2 get 256 (8 floats), AVX-512 gets 512 (16).
// "masked" shows b[i] > c[i] as a per-lane mask, the way the chapter's conditional sum uses it.

const B = [0.9, 0.2, 0.7, 0.4, 0.1, 0.8, 0.6, 0.3, 0.5, 0.95, 0.15, 0.65, 0.35, 0.75, 0.05, 0.55];
const C = [0.5, 0.6, 0.3, 0.9, 0.2, 0.1, 0.7, 0.2, 0.4, 0.5, 0.8, 0.6, 0.6, 0.3, 0.4, 0.5];

const SHAPES = [
  { v: 1, label: "scalar", bits: "32 bits" },
  { v: 4, label: "128-bit (this mac)", bits: "4 lanes" },
  { v: 8, label: "256-bit (AVX2)", bits: "8 lanes" },
  { v: 16, label: "512-bit (AVX-512)", bits: "16 lanes" },
];

export function Lanes() {
  const [lanes, setLanes] = useState(4);
  const [masked, setMasked] = useState(false);
  const groups = 16 / lanes;
  return (
    <div className="@container grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex flex-wrap gap-1" role="group" aria-label="vector width">
          {SHAPES.map((s) => (
            <button key={s.v} className="word" aria-pressed={lanes === s.v} onClick={() => setLanes(s.v)}>
              {s.label}
            </button>
          ))}
        </div>
        <button className="word" aria-pressed={masked} onClick={() => setMasked((m) => !m)}>
          mask: b &gt; c
        </button>
      </div>
      <div className="grid gap-1.5" role="img" aria-label={`16 floats in ${groups} instruction${groups > 1 ? "s" : ""}`}>
        {Array.from({ length: groups }, (_, g) => (
          <div key={g} className="flex items-center gap-2">
            <span className="w-[5ch] shrink-0 text-right text-[10px] text-faint tabular">#{g + 1}</span>
            <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}>
              {B.map((b, i) => {
                const inGroup = Math.floor(i / lanes) === g;
                const on = !masked || b > C[i];
                return (
                  <span
                    key={i}
                    className="flex h-7 items-center justify-center rounded-[2px] text-[9px] tabular transition-colors duration-200"
                    style={{
                      background: inGroup ? (on ? "color-mix(in srgb, var(--hot) 24%, var(--bg))" : "var(--bg)") : "transparent",
                      boxShadow: inGroup ? `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}` : "inset 0 0 0 1px var(--line)",
                      color: inGroup ? (on ? "var(--hi)" : "var(--faint)") : "transparent",
                    }}
                  >
                    <span className="hidden @[480px]:inline">{inGroup ? b.toFixed(2).slice(1) : ""}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-12 sm:grid-cols-3">
        <div>
          <div className="text-11 text-faint">instructions for 16 floats</div>
          <div className="text-hi tabular">{groups}</div>
        </div>
        <div>
          <div className="text-11 text-faint">floats per instruction</div>
          <div className="text-hi tabular">{lanes}</div>
        </div>
        {masked && (
          <div>
            <div className="text-11 text-faint">lanes where b &gt; c</div>
            <div className="text-hot tabular">{B.filter((b, i) => b > C[i]).length} of 16</div>
          </div>
        )}
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {masked
          ? "with a mask, every lane still does the work, and the comparison decides which results count. no branch per element, so nothing for the CPU to mispredict. that's how the conditional sum below gets its speedup."
          : lanes === 1
            ? "scalar: one float per instruction, sixteen instructions. each row above is one instruction."
            : `one instruction adds ${lanes} floats at once. the Vector API asks for the widest shape the CPU has (SPECIES_PREFERRED) and the JIT turns each vector operation into one of these instructions.`}
      </p>
    </div>
  );
}
