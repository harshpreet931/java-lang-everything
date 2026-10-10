"use client";

import { useState } from "react";
import { Memory } from "@/components/viz/Memory";
import type { Frame, HeapObject } from "@/lib/trace";
import { CodePanel, Row, Words } from "./kit";

// Integer a = v; Integer b = v;  →  Integer.valueOf(v) twice.
// valueOf hands out a shared object from IntegerCache for -128..127 (jdk 25 source, Integer.java),
// and a fresh `new Integer` for everything else. checked on temurin 25:
//   127 == 127 → true, 128 == 128 → false, equals → true for both.

const LO = -128;
const HI = 127;
const MIN = -200;
const MAX = 300;
const QUICK = [127, 128, -128, -129, 1000] as const;

export function IntegerCacheFig() {
  const [v, setV] = useState(127);
  const cached = v >= LO && v <= HI;
  const pct = (x: number) => ((Math.max(MIN, Math.min(MAX, x)) - MIN) / (MAX - MIN)) * 100;

  const heap: Record<string, HeapObject> = cached
    ? { c: { type: "Integer", value: String(v), tag: `cache[${v - LO}]` } }
    : { n1: { type: "Integer", value: String(v), tag: "new, for a" }, n2: { type: "Integer", value: String(v), tag: "new, for b" } };
  const frames: Frame[] = [{ name: "main", locals: { a: { ref: cached ? "c" : "n1" }, b: { ref: cached ? "c" : "n2" } } }];

  return (
    <div className="font-mono @container">
      <div className="text-13">
        <Row k="v =" w="6ch">
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="slider min-w-0 flex-1"
              min={MIN}
              max={MAX}
              value={Math.max(MIN, Math.min(MAX, v))}
              onChange={(e) => setV(Number(e.target.value))}
              aria-label="the int being boxed"
            />
            <span className="w-[6ch] text-right text-hi tabular">{v}</span>
          </div>
        </Row>
        <Row k="try =" w="6ch" last>
          <Words<number> label="quick values" options={QUICK.map((q) => ({ v: q, label: String(q) }))} value={v} onChange={setV} />
        </Row>
      </div>

      {/* where v sits relative to the cache */}
      <div className="relative mt-3 mb-7 h-6" aria-hidden>
        <div className="absolute inset-x-0 top-3 h-px bg-line-2" />
        <div
          className="absolute top-[7px] h-[11px] rounded-[1px]"
          style={{ left: `${pct(LO)}%`, width: `${pct(HI) - pct(LO)}%`, background: "color-mix(in srgb, var(--meta) 22%, transparent)", boxShadow: "inset 0 0 0 1px var(--meta)" }}
        />
        <span className="absolute top-6 -translate-x-1/2 text-[10px] text-meta tabular" style={{ left: `${pct(LO)}%` }}>
          -128
        </span>
        <span className="absolute top-6 -translate-x-1/2 text-[10px] text-meta tabular" style={{ left: `${pct(HI)}%` }}>
          127
        </span>
        <span
          className="absolute top-0 h-6 w-[2px] -translate-x-1/2 bg-hot transition-[left] duration-150 ease-jle"
          style={{ left: `${pct(v)}%` }}
        />
      </div>

      <div className="grid gap-6 @[640px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <CodePanel file="Main.java" code={`// both lines call Integer.valueOf(${v})\nInteger a = ${v};\nInteger b = ${v};`} />
          <div className="grid gap-1 text-13" aria-live="polite">
            <div className="flex items-baseline justify-between border-b border-line py-1.5">
              <span className="text-ink">a == b</span>
              <span style={{ color: cached ? "var(--live)" : "var(--dead)" }}>{String(cached)}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line py-1.5">
              <span className="text-ink">a.equals(b)</span>
              <span className="text-live">true</span>
            </div>
          </div>
          <p className="font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-mute">
            {cached ? (
              <>
                {v} is inside the <span className="text-meta">cache</span>, so both calls return the same object. <code>==</code>{" "}
                compares arrows, and the arrows match.
              </>
            ) : (
              <>
                {v} is outside the <span className="text-meta">cache</span>, so each <code>valueOf</code> makes a new object. equal values,
                different arrows, <code>==</code> says false.
              </>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <Memory frames={frames} heap={heap} />
        </div>
      </div>
    </div>
  );
}
