"use client";

import { useId, useState } from "react";
import { useWidth } from "@/components/figures/gc/kit";

// the same Integer[] {1996, 2006, 1996, null, null, 7, 42, 1996}, three ways. "today" is
// HotSpot with compressed oops (4-byte slots, 16-byte Integer objects: 12-byte header plus the
// int; 1996 is outside the integer cache, so each one is its own object). "flattened" is what
// JEP 401 describes a JVM *may* do once Integer is a value class (jdk 28, preview): each
// element becomes one 64-bit word holding the int and a null flag. it's an optimization the
// JVM is allowed to make, not a promised layout. int[] is there for scale.

type Mode = "today" | "flat" | "int";
const VALS: (number | null)[] = [1996, 2006, 1996, null, null, 7, 42, 1996];

const INFO: Record<Mode, { label: string; bytes: string; loads: string; eq: string; nulls: string; note: string }> = {
  today: {
    label: "Integer[] today",
    bytes: "4 + 16",
    loads: "2",
    eq: "false",
    nulls: "yes",
    note: "an array of references. every non-null element is a separate 16-byte object with a 12-byte header, somewhere else on the heap. reading one is two loads: the slot, then the object. and a[0] and a[2] are two separate 1996 objects, so == says they're different.",
  },
  flat: {
    label: "value Integer, flattened",
    bytes: "8",
    loads: "1",
    eq: "true",
    nulls: "yes, a flag bit",
    note: "with Integer as a value class, the JVM is allowed to put the int straight into the array, plus one bit that says null. JEP 401 expects a 64-bit word per element: twice an int[], but no headers, no pointers, one load. and == compares values, so a[0] == a[2].",
  },
  int: {
    label: "int[]",
    bytes: "4",
    loads: "1",
    eq: "true",
    nulls: "no",
    note: "the primitive array, for scale: the smallest and fastest, and it can't hold a null. a flattened Integer[] gets most of the way here while still being an array of objects you can put in a List<Integer>.",
  },
};

export function FlatArray() {
  const [mode, setMode] = useState<Mode>("today");
  const [ref, w] = useWidth();
  const uid = useId().replace(/:/g, "");
  const W = Math.max(320, w);
  const pad = 8;
  const hdr = Math.min(56, W * 0.12);
  const slotW = (W - pad * 2 - hdr) / 8;
  const sx = (i: number) => pad + hdr + i * slotW;
  const rowY = 24;
  const rowH = 40;
  const objY = 136;
  const objW = Math.min(64, slotW * 0.95);
  // scattered, but deterministic, positions for the boxed Integers
  const objX = [5, 1, 7, -1, -1, 3, 0, 6].map((p) => (p < 0 ? 0 : pad + hdr + (p / 8) * (W - pad * 2 - hdr - objW) * 1.14));
  const H = mode === "today" ? 196 : 92;
  const info = INFO[mode];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="layout">
        {(Object.keys(INFO) as Mode[]).map((m) => (
          <button key={m} className="word" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {INFO[m].label}
          </button>
        ))}
      </div>
      <div ref={ref} className="min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block transition-[height] duration-200" style={{ fontFamily: "var(--font-code)" }} role="img"
          aria-label={`${info.label}: ${info.bytes} bytes per element`}>
          <defs>
            <marker id={`${uid}-r`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
            </marker>
          </defs>
          <text x={pad} y={14} fontSize={10} fill="var(--faint)">
            {mode === "int" ? "int[8]" : "Integer[8]"}
          </text>
          <rect x={pad} y={rowY} width={hdr - 2} height={rowH} rx={4} fill="color-mix(in srgb, var(--meta) 10%, var(--bg))" stroke="color-mix(in srgb, var(--meta) 50%, transparent)" />
          <text x={pad + (hdr - 2) / 2} y={rowY + rowH / 2 + 4} textAnchor="middle" fontSize={9.5} fill="var(--meta)">
            header
          </text>
          {VALS.map((v, i) => {
            const x = sx(i);
            const isNull = v === null;
            return (
              <g key={i}>
                <rect x={x + 1} y={rowY} width={slotW - 2} height={rowH} rx={3} fill="var(--bg)" stroke="var(--line-2)" />
                {mode === "today" && !isNull && <circle cx={x + slotW / 2} cy={rowY + rowH / 2} r={3} fill="var(--ref)" />}
                {mode === "today" && isNull && (
                  <text x={x + slotW / 2} y={rowY + rowH / 2 + 4} textAnchor="middle" fontSize={10} fill="var(--faint)">
                    null
                  </text>
                )}
                {mode === "flat" && (
                  <>
                    <text x={x + slotW / 2} y={rowY + rowH / 2 + 2} textAnchor="middle" fontSize={slotW < 44 ? 9.5 : 11} fill={isNull ? "var(--faint)" : "var(--hi)"}>
                      {isNull ? "null" : v}
                    </text>
                    <text x={x + slotW / 2} y={rowY + rowH - 5} textAnchor="middle" fontSize={8} fill="var(--faint)">
                      {isNull ? "flag 1" : "flag 0"}
                    </text>
                  </>
                )}
                {mode === "int" && (
                  <text x={x + slotW / 2} y={rowY + rowH / 2 + 4} textAnchor="middle" fontSize={slotW < 44 ? 9.5 : 11} fill="var(--hi)">
                    {isNull ? 0 : v}
                  </text>
                )}
              </g>
            );
          })}
          {mode === "today" &&
            VALS.map((v, i) => {
              if (v === null) return null;
              const x = objX[i];
              return (
                <g key={`o${i}`}>
                  <line x1={sx(i) + slotW / 2} y1={rowY + rowH / 2} x2={x + objW / 2} y2={objY - 3} stroke="var(--ref)" strokeWidth={1.1} markerEnd={`url(#${uid}-r)`} opacity={0.8} />
                  <rect x={x} y={objY} width={objW} height={40} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
                  <rect x={x} y={objY} width={objW} height={13} rx={3} fill="color-mix(in srgb, var(--meta) 10%, var(--bg))" />
                  <text x={x + objW / 2} y={objY + 10} textAnchor="middle" fontSize={8} fill="var(--meta)">
                    12 B header
                  </text>
                  <text x={x + objW / 2} y={objY + 30} textAnchor="middle" fontSize={10.5} fill="var(--hi)">
                    {v}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3 text-12 sm:grid-cols-4">
        <div>
          <div className="text-11 text-faint">bytes per element</div>
          <div className="text-hi tabular">{info.bytes}</div>
        </div>
        <div>
          <div className="text-11 text-faint">loads to read one</div>
          <div className="text-hi tabular">{info.loads}</div>
        </div>
        <div>
          <div className="text-11 text-faint">a[0] == a[2]</div>
          <div style={{ color: info.eq === "true" ? "var(--live)" : "var(--dead)" }}>{info.eq}</div>
        </div>
        <div>
          <div className="text-11 text-faint">can hold null</div>
          <div className="text-hi">{info.nulls}</div>
        </div>
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {info.note}
      </p>
    </div>
  );
}
