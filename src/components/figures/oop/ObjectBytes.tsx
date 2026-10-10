"use client";

import { useState } from "react";

// what one object costs, byte by byte. measured on jdk 25 (temurin 25.0.4, macOS aarch64, -Xint)
// with com.sun.management.ThreadMXBean#getThreadAllocatedBytes over 1,000,000 allocations:
//   new Object()  16 B default, 8 B with -XX:+UseCompactObjectHeaders
//   new Dog(..)   24 B default, 16 B compact   (Dog = String name + int age)
// default 64-bit HotSpot: 8 B mark word + 4 B compressed class pointer, 4 B compressed references,
// objects aligned to 8 B.

type Seg = { label: string; bytes: number; kind: "meta" | "ref" | "prim" | "pad"; note: string };

const LAYOUTS: Record<string, Record<string, Seg[]>> = {
  Dog: {
    default: [
      { label: "mark word", bytes: 8, kind: "meta", note: "identity hash, lock state, GC age bits." },
      { label: "class", bytes: 4, kind: "meta", note: "a (compressed) pointer to the class. it's how getClass() and method calls find Dog." },
      { label: "name", bytes: 4, kind: "ref", note: "a reference to a String. 4 bytes, because compressed oops are on for heaps under 32 GB." },
      { label: "age", bytes: 4, kind: "prim", note: "the int itself. primitives live inline in the object." },
      { label: "pad", bytes: 4, kind: "pad", note: "objects are 8-byte aligned, so 20 bytes rounds up to 24." },
    ],
    compact: [
      { label: "header", bytes: 8, kind: "meta", note: "jdk 25's compact headers squeeze the mark word and the class pointer into one 8-byte word (JEP 519)." },
      { label: "name", bytes: 4, kind: "ref", note: "a reference to a String. 4 bytes, because compressed oops are on for heaps under 32 GB." },
      { label: "age", bytes: 4, kind: "prim", note: "the int itself. primitives live inline in the object." },
    ],
  },
  Object: {
    default: [
      { label: "mark word", bytes: 8, kind: "meta", note: "identity hash, lock state, GC age bits." },
      { label: "class", bytes: 4, kind: "meta", note: "a (compressed) pointer to java.lang.Object's class." },
      { label: "pad", bytes: 4, kind: "pad", note: "no fields at all, and it still rounds up to 16 bytes." },
    ],
    compact: [{ label: "header", bytes: 8, kind: "meta", note: "the whole object is its header. 8 bytes." }],
  },
};

const MAX = 24;

const fill = (k: Seg["kind"]) =>
  k === "meta"
    ? "color-mix(in srgb, var(--meta) 22%, transparent)"
    : k === "ref"
      ? "color-mix(in srgb, var(--ref) 22%, transparent)"
      : k === "prim"
        ? "var(--well-2)"
        : "repeating-linear-gradient(135deg, var(--line-2) 0 1px, transparent 1px 6px)";
const edge = (k: Seg["kind"]) => (k === "meta" ? "var(--meta)" : k === "ref" ? "var(--ref)" : "var(--line-2)");

export function ObjectBytes() {
  const [obj, setObj] = useState<"Dog" | "Object">("Dog");
  const [hdr, setHdr] = useState<"default" | "compact">("default");
  const [hover, setHover] = useState<number | null>(null);
  const segs = LAYOUTS[obj][hdr];
  const total = segs.reduce((a, s) => a + s.bytes, 0);
  let at = 0;

  return (
    <div className="grid gap-5 text-13">
      <div>
        <div className="grid grid-cols-[10ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">object =</span>
          <div className="flex flex-wrap gap-1">
            {(["Dog", "Object"] as const).map((o) => (
              <button key={o} className="word" aria-pressed={obj === o} onClick={() => (setObj(o), setHover(null))}>
                {o === "Dog" ? 'new Dog("rex", 3)' : "new Object()"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[10ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">headers =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={hdr === "default"} onClick={() => (setHdr("default"), setHover(null))}>
              default
            </button>
            <button className="word" aria-pressed={hdr === "compact"} onClick={() => (setHdr("compact"), setHover(null))}>
              -XX:+UseCompactObjectHeaders
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="relative h-14" role="img" aria-label={`${obj} takes ${total} bytes: ${segs.map((s) => `${s.label} ${s.bytes}`).join(", ")}`}>
          {segs.map((s, i) => {
            const left = (at / MAX) * 100;
            at += s.bytes;
            return (
              <button
                key={`${hdr}-${obj}-${s.label}`}
                className="absolute inset-y-0 flex flex-col items-center justify-center rounded-[1px] text-center transition-[left,width] duration-300 ease-jle"
                style={{
                  left: `${left}%`,
                  width: `calc(${(s.bytes / MAX) * 100}% - 2px)`,
                  background: fill(s.kind),
                  boxShadow: `inset 0 0 0 1px ${hover === i ? "var(--hi)" : edge(s.kind)}`,
                }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)}
                aria-label={`${s.label}, ${s.bytes} bytes`}
              >
                <span className={`truncate px-1 text-11 ${s.kind === "meta" ? "text-meta" : s.kind === "ref" ? "text-ref" : s.kind === "pad" ? "text-faint" : "text-hi"}`}>
                  {s.label}
                </span>
                <span className="text-[10px] text-faint tabular">{s.bytes}</span>
              </button>
            );
          })}
        </div>
        {/* byte ruler */}
        <div className="relative mt-1.5 h-4 text-[10px] text-faint tabular">
          {[0, 8, 16, 24].map((b) => (
            <span key={b} className="absolute -translate-x-1/2" style={{ left: `${(b / MAX) * 100}%` }}>
              <span className="mx-auto mb-0.5 block h-1.5 w-px bg-line-2" />
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line pt-3">
        <p className="min-h-[3.4em] max-w-[60ch] font-serif text-15 leading-[1.6] text-mute" aria-live="polite">
          {hover !== null && segs[hover] ? segs[hover].note : "hover a slice. purple is the JVM's own bookkeeping, blue is a reference, grey is a primitive, hatched is padding."}
        </p>
        <span className="text-15 text-hi tabular">
          {total} <span className="text-12 text-faint">bytes</span>
        </span>
      </div>
    </div>
  );
}
