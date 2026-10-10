"use client";

import { useState } from "react";

// JLS 5.1.2 widening primitive conversions, drawn as a chain (every arrow is also allowed
// transitively, e.g. byte → double). three of them can lose precision: int → float,
// long → float, long → double. examples checked on jdk 25.

const CHAIN = ["byte", "short", "int", "long", "float", "double"] as const;

const LOSSY = [
  { from: "int", to: "float", ex: "(float) 16_777_217", got: "1.6777216E7", why: "a float has 24 bits of precision. that's 2²⁴ + 1, the first int that doesn't fit: it rounds to 2²⁴." },
  { from: "long", to: "float", ex: "(float) 123_456_789_123L", got: "1.2345679E11", why: "same story, worse: 64 bits squeezed into 24 bits of precision." },
  { from: "long", to: "double", ex: "(double) 9_007_199_254_740_993L", got: "9.007199254740992E15", why: "a double has 53 bits of precision. that's 2⁵³ + 1, the first long that doesn't fit: it rounds to 2⁵³." },
];

export function WideningMap() {
  const [sel, setSel] = useState<number | null>(null);
  const lossy = sel === null ? null : LOSSY[sel];
  const isLossyEdge = (a: string, b: string) => LOSSY.some((l) => l.from === a && l.to === b);

  return (
    <div className="font-mono @container text-13">
      {/* wide: one row, skip arcs above */}
      <svg fontFamily="var(--font-code), monospace" viewBox="0 0 660 160" className="hidden w-full @[560px]:block" role="img" aria-label="widening conversions: byte to short to int to long to float to double, and char to int">
        <defs>
          <marker id="wm-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--mute)" />
          </marker>
          <marker id="wm-ah-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--hot)" />
          </marker>
        </defs>
        {CHAIN.map((t, i) => {
          const x = 20 + i * 110;
          return (
            <g key={t}>
              <rect x={x} y={70} width={70} height={30} rx={2} fill="var(--well)" stroke="var(--line-2)" />
              <text x={x + 35} y={89} textAnchor="middle" fontSize={12} fill="var(--hi)">
                {t}
              </text>
              {i < CHAIN.length - 1 && (
                <line
                  x1={x + 72}
                  y1={85}
                  x2={x + 107}
                  y2={85}
                  stroke={isLossyEdge(t, CHAIN[i + 1]) ? "var(--hot)" : "var(--mute)"}
                  strokeDasharray={isLossyEdge(t, CHAIN[i + 1]) ? "4 3" : undefined}
                  markerEnd={`url(#${isLossyEdge(t, CHAIN[i + 1]) ? "wm-ah-hot" : "wm-ah"})`}
                />
              )}
            </g>
          );
        })}
        {/* char joins at int */}
        <rect x={240} y={118} width={70} height={28} rx={2} fill="var(--well)" stroke="var(--line-2)" />
        <text x={275} y={136} textAnchor="middle" fontSize={12} fill="var(--hi)">
          char
        </text>
        <path d="M 260 118 L 260 103" stroke="var(--mute)" fill="none" markerEnd="url(#wm-ah)" />
        {/* skip arcs for the lossy ones that skip a step: int → float over the top, long → double underneath */}
        <path d="M 255 68 C 290 26, 440 26, 470 66" fill="none" stroke="var(--hot)" strokeDasharray="4 3" markerEnd="url(#wm-ah-hot)" />
        <text x={362} y={26} textAnchor="middle" fontSize={10} fill="var(--hot)">
          int → float
        </text>
        <path d="M 365 102 C 400 140, 550 140, 580 104" fill="none" stroke="var(--hot)" strokeDasharray="4 3" markerEnd="url(#wm-ah-hot)" />
        <text x={472} y={150} textAnchor="middle" fontSize={10} fill="var(--hot)">
          long → double
        </text>
        <text x={20} y={150} fontSize={10} fill="var(--faint)">
          automatic, left to right.
        </text>
      </svg>

      {/* narrow: a column */}
      <div className="grid gap-1 @[560px]:hidden" aria-hidden>
        {CHAIN.map((t, i) => (
          <div key={t} className="grid justify-items-start">
            <span className="rounded-md bg-well px-3 py-1 text-12 text-hi shadow-[inset_0_0_0_1px_var(--line-2)]">
              {t}
              {t === "int" && <span className="text-faint"> ← char</span>}
            </span>
            {i < CHAIN.length - 1 && (
              <span className={`pl-5 text-11 ${isLossyEdge(t, CHAIN[i + 1]) ? "text-hot" : "text-mute"}`}>
                ↓{isLossyEdge(t, CHAIN[i + 1]) ? " may round" : ""}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 text-11 text-faint">the three widenings that can lose precision (no cast, no warning):</div>
        <div className="flex flex-wrap gap-1">
          {LOSSY.map((l, i) => (
            <button key={l.ex} className="word !text-12" aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>
              {l.from} → {l.to}
            </button>
          ))}
        </div>
        <p className="mt-3 min-h-[3.2em] text-13 leading-[1.7] text-ink" aria-live="polite">
          {lossy ? (
            <>
              <span className="text-hi">{lossy.ex}</span> <span className="text-faint">is</span> <span className="text-hot">{lossy.got}</span>.{" "}
              <span className="text-mute">{lossy.why}</span>
            </>
          ) : (
            <span className="text-faint">pick one to see it round.</span>
          )}
        </p>
      </div>
    </div>
  );
}
