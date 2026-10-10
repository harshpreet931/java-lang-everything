"use client";

import { useState } from "react";
import { Legend } from "./kit";

// a GC cycle on a time axis, from a real log: stop-the-world pauses on one lane,
// concurrent GC work on another. hover (or tap) a block to read the log line it came from.

export type Seg = { start: number; dur: number; label: string; line?: string };

export function PhaseTimeline({
  pauses,
  concurrent,
  from,
  to,
  ticks,
  unit = "ms",
  minPx = 2,
}: {
  pauses: Seg[];
  concurrent: Seg[];
  from: number;
  to: number;
  ticks: number[];
  unit?: string;
  minPx?: number;
}) {
  const [sel, setSel] = useState<Seg | null>(null);
  const pct = (t: number) => `${(((t - from) / (to - from)) * 100).toFixed(3)}%`;
  const wid = (d: number) => `max(${minPx}px, ${((d / (to - from)) * 100).toFixed(3)}%)`;

  const lane = (segs: Seg[], tone: "hot" | "meta", label: string) => (
    <div className="grid grid-cols-[11ch_minmax(0,1fr)] items-center gap-2">
      <span className="text-11 text-faint">{label}</span>
      <div className="relative h-7 rounded-[3px] bg-bg shadow-[inset_0_0_0_1px_var(--line)]">
        {segs.map((s, i) => (
          <button
            key={i}
            className="absolute inset-y-[4px] rounded-[2px] transition-opacity duration-150"
            style={{
              left: pct(s.start),
              width: wid(s.dur),
              background: tone === "hot" ? "var(--hot)" : "color-mix(in srgb, var(--meta) 55%, transparent)",
              opacity: sel && sel !== s ? 0.45 : 1,
              outline: sel === s ? "1px solid var(--hi)" : undefined,
              outlineOffset: 1,
            }}
            onMouseEnter={() => setSel(s)}
            onFocus={() => setSel(s)}
            onClick={() => setSel(s)}
            aria-label={`${s.label}, ${s.dur} ${unit}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2" onMouseLeave={() => setSel(null)}>
      {lane(pauses, "hot", "app stopped")}
      {lane(concurrent, "meta", "concurrent GC")}
      <div className="grid grid-cols-[11ch_minmax(0,1fr)] gap-2">
        <span />
        <div className="relative h-5">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute top-0 -translate-x-1/2 text-[10px] whitespace-nowrap text-faint tabular ${i % 2 ? "hidden sm:block" : ""}`}
              style={{ left: pct(t) }}
            >
              {t} {unit}
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-[3.4em] rounded-md bg-bg px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        {sel ? (
          <>
            <div className="text-12 text-hi">
              {sel.label} <span className="text-mute tabular">· {sel.dur} {unit}</span>
            </div>
            {sel.line && <div className="mt-0.5 truncate text-11 text-faint">{sel.line}</div>}
          </>
        ) : (
          <span className="text-12 text-faint">hover or tap a block to see its log line.</span>
        )}
      </div>
      <Legend
        items={[
          ["hot", "stop-the-world pause"],
          ["meta", "concurrent GC work, app keeps running"],
        ]}
      />
    </div>
  );
}
