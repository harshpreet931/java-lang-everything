"use client";

import { useState } from "react";

// reserved vs committed, per area, on a log scale.
// numbers: NMT summary (-XX:NativeMemoryTracking=summary -XX:+PrintNMTStatistics) of javac
// compiling three files on jdk 25.0.4, macOS aarch64, -Xmx512m. MB = 2^20 bytes.

type Row = { label: string; reserved: number; committed: number; meta?: boolean; note: string };

const ROWS: Row[] = [
  { label: "java heap", reserved: 520, committed: 386, note: "-Xmx512m reserves the whole range. G1 committed 386 MB of it." },
  { label: "class space", reserved: 1024, committed: 1.5, meta: true, note: "1 GB of address space for 32-bit class pointers. 1.5 MB actually used." },
  { label: "code cache", reserved: 245.4, committed: 9.2, meta: true, note: "room for 240 MB of compiled code. javac's run needed 9." },
  { label: "metaspace", reserved: 64, committed: 9.0, meta: true, note: "3,056 classes' worth of metadata." },
  { label: "GC structures", reserved: 64.7, committed: 62.3, meta: true, note: "G1's bitmaps, card table and queues. committed up front, for a 512 MB heap." },
  { label: "thread stacks", reserved: 30, committed: 0.3, note: "14 threads × 2 MB reserved. stacks are committed only as deep as they get." },
  { label: "CDS archive", reserved: 16, committed: 13.6, meta: true, note: "the JDK's pre-parsed classes, mapped from a file." },
];

const MIN = 0.1;
const MAX = 2048;
// rounded, so the server and the browser agree on the exact same css string
const pos = (v: number) =>
  Math.round(((Math.log10(Math.max(MIN, v)) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN))) * 1000) / 1000;
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(v < 1 ? 2 : 1));

export function ReservedCommitted() {
  const [hover, setHover] = useState<number | null>(null);
  const totalR = 1977.8;
  const totalC = 495.4;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[13ch_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-12 sm:grid-cols-[14ch_minmax(0,1fr)_auto]">
        {ROWS.map((r, i) => (
          <div
            key={r.label}
            className="contents"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="truncate" style={{ color: r.meta ? "var(--meta)" : "var(--ink)" }}>
              {r.label}
            </span>
            <button
              className="relative h-[16px] w-full text-left"
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${r.label}: ${fmt(r.reserved)} MB reserved, ${fmt(r.committed)} MB committed`}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-xs bg-bg"
                style={{
                  width: `${(pos(r.reserved) * 100).toFixed(1)}%`,
                  boxShadow: `inset 0 0 0 1px ${hover === i ? "var(--hot)" : "var(--line-2)"}`,
                }}
              />
              <span
                className="absolute inset-y-[3px] left-[3px] rounded-[2px] bg-mute"
                style={{ width: `calc(${(pos(r.committed) * 100).toFixed(1)}% - 6px)`, minWidth: 2, opacity: 0.75 }}
              />
            </button>
            <span className="col-span-2 -mt-1 mb-1 text-right text-11 text-mute tabular sm:col-span-1 sm:mt-0 sm:mb-0">
              {fmt(r.committed)} <span className="text-faint">of {fmt(r.reserved)} MB</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-11 text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-[1px] bg-bg shadow-[inset_0_0_0_1px_var(--line-2)]" /> reserved: address space, a promise
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-[1px] bg-mute opacity-75" /> committed: backed by real memory
        </span>
        <span>log scale</span>
      </div>
      <p className="min-h-[3.2em] font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {hover !== null ? (
          ROWS[hover].note
        ) : (
          <>
            whole process: <span className="text-hi tabular">{totalR.toLocaleString("en-US")} MB</span> reserved,{" "}
            <span className="text-hi tabular">{totalC} MB</span> committed. hover a row.
          </>
        )}
      </p>
    </div>
  );
}
