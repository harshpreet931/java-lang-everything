"use client";

import { useState } from "react";
import { Row, Words, NARR } from "./kit";

// reading a 1 MiB file one byte at a time (while (in.read() != -1)), with and without
// a BufferedInputStream of each size.
//   calls: counted with a FilterInputStream that increments on every read into the source.
//   time: median of 9 runs on a 1 MiB temp file, jdk 25.0.4 (temurin), apple M4 Pro, macOS.
//   none 363 ms · 16 B 31 ms · 512 B 5.0 ms · 8 KiB 4.3 ms · 64 KiB 4.2 ms

const SIZES = [
  { v: 0, label: "none", calls: 1_048_577, ms: 363 },
  { v: 16, label: "16 B", calls: 65_537, ms: 31 },
  { v: 512, label: "512 B", calls: 2_049, ms: 5.0 },
  { v: 8192, label: "8 KiB", calls: 129, ms: 4.3, def: true },
  { v: 65536, label: "64 KiB", calls: 17, ms: 4.2 },
] as const;

const MAX_MS = 363;

export function BufferMeter() {
  const [sel, setSel] = useState<number>(8192);
  const x = SIZES.find((s) => s.v === sel)!;
  const chunks = x.calls - 1; // the last call is the one that returns -1
  const dense = chunks > 300;

  return (
    <div className="@container text-13">
      <Row k="buffer =" w="9ch">
        <Words
          label="buffer size"
          options={SIZES.map((s) => ({ v: s.v, label: s.label }))}
          value={sel}
          onChange={setSel}
        />
      </Row>

      <div className="mt-5 grid gap-5 @[560px]:grid-cols-[minmax(0,1fr)_16ch]">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between text-11 text-faint">
            <span>the 1 MiB file, cut into the chunks each read() fetches</span>
          </div>
          <div
            className="relative h-10 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line-2)]"
            role="img"
            aria-label={`${x.calls.toLocaleString("en-US")} reads into the file`}
          >
            <div
              className="absolute inset-0 transition-[background] duration-300"
              style={{
                background:
                  x.v === 0
                    ? `repeating-linear-gradient(90deg, color-mix(in srgb, var(--dead) 75%, transparent) 0 1px, transparent 1px 1.5px)`
                    : dense
                      ? `repeating-linear-gradient(90deg, var(--mute) 0 1px, transparent 1px 3px)`
                      : `repeating-linear-gradient(90deg, var(--mute) 0 1px, transparent 1px calc(100% / ${chunks}))`,
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-faint tabular">
            <span>0</span>
            <span>1,048,576 bytes</span>
          </div>
        </div>
        <div className="flex flex-col justify-center @[560px]:items-end">
          <span className="text-11 text-faint">read() calls on the file</span>
          <span className={`text-28 leading-tight font-light tabular ${x.v === 0 ? "text-dead" : "text-hi"}`}>
            {x.calls.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-12">
        {SIZES.map((s) => (
          <div key={s.v} className="contents">
            <button
              onClick={() => setSel(s.v)}
              className={`text-left transition-colors duration-150 ${s.v === sel ? "text-hi" : "text-mute hover:text-ink"}`}
            >
              {s.label}
              {"def" in s && s.def && <span className="text-faint"> (default)</span>}
            </button>
            <span className="relative h-[10px] bg-well-2">
              <span
                className="absolute inset-y-0 left-0 transition-[width,background-color] duration-300 ease-jle"
                style={{
                  width: `${Math.max(0.8, (s.ms / MAX_MS) * 100)}%`,
                  background: s.v === 0 ? "var(--dead)" : s.v === sel ? "var(--hot)" : "var(--mute)",
                }}
              />
            </span>
            <span className="text-right text-mute tabular">
              {s.ms} <span className="text-faint">ms</span>
            </span>
          </div>
        ))}
      </div>

      <p className={`mt-4 ${NARR}`} aria-live="polite">
        {x.v === 0 ? (
          <>every single byte is its own trip into the OS. that&apos;s a million system calls for one megabyte.</>
        ) : (
          <>
            one call fills {x.v.toLocaleString("en-US")} bytes, then {x.v === 16 ? "15" : (x.v - 1).toLocaleString("en-US")} read()s are
            served from memory. {x.ms < 6 ? "past a few hundred bytes the syscalls stop mattering, the per-byte loop is what's left." : ""}
          </>
        )}
      </p>
    </div>
  );
}
