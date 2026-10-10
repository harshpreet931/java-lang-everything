"use client";

// small shared pieces for the part 12 (tooling) and part 15 (performance) figures.
// performance/kit.tsx re-exports this file. nothing here is generic enough for viz/.

import { useEffect, useState, type ReactNode } from "react";

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";

/* ---- motion ------------------------------------------------------------------ */

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

/* ---- controls ----------------------------------------------------------------- */

/** a config-file row: `key =` on the left, controls on the right. */
export function Row({ k, children, w = "10ch", last }: { k: ReactNode; children: ReactNode; w?: string; last?: boolean }) {
  // key on the left from 480px up; above the controls on a phone, so long options don't wrap badly.
  return (
    <div className={`@container ${last ? "" : "border-b border-line"}`}>
      <div
        className="grid items-center gap-x-3 gap-y-1 py-2.5 text-13 @[480px]:grid-cols-[var(--rw)_minmax(0,1fr)]"
        style={{ ["--rw" as string]: w }}
      >
        <span className="text-faint">{k}</span>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/** a row of .word options. */
export function Words<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { v: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} className="word" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** an on/off word, for flags. */
export function Toggle({ on, onChange, children, label }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; label?: string }) {
  return (
    <button className="word" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)}>
      {children}
    </button>
  );
}

/* ---- wells ------------------------------------------------------------------------ */

/** a nested panel inside a figure (the figure itself is the well): paper on paper, one hairline. */
export const PANEL = "rounded-md bg-bg shadow-[inset_0_0_0_1px_var(--line-2)]";

export function Well({ children, className = "", label, right }: { children: ReactNode; className?: string; label?: ReactNode; right?: ReactNode }) {
  return (
    <div className={`font-mono ${PANEL} ${className}`}>
      {label && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-line-2 px-4 text-12">
          <span className="text-ink">{label}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * a terminal transcript. lines starting with "$ " are commands (bright), the rest is
 * output (muted). `marks` colours substrings: { "forRemoval=true": "dead" }.
 */
export function Term({
  text,
  marks = {},
  label = "terminal",
  className = "",
  minH,
  wrap,
}: {
  text: string;
  marks?: Record<string, Tone>;
  label?: ReactNode;
  className?: string;
  minH?: string;
  wrap?: boolean;
}) {
  const lines = text.replace(/\n$/, "").split("\n");
  const keys = Object.keys(marks).sort((a, b) => b.length - a.length);
  const paint = (s: string, base: string) => {
    if (!keys.length) return <span className={base}>{s}</span>;
    const out: ReactNode[] = [];
    let rest = s;
    let n = 0;
    while (rest.length) {
      let best = -1;
      let key = "";
      for (const k of keys) {
        const i = rest.indexOf(k);
        if (i >= 0 && (best < 0 || i < best)) {
          best = i;
          key = k;
        }
      }
      if (best < 0) {
        out.push(
          <span key={n++} className={base}>
            {rest}
          </span>,
        );
        break;
      }
      if (best > 0)
        out.push(
          <span key={n++} className={base}>
            {rest.slice(0, best)}
          </span>,
        );
      out.push(
        <span key={n++} style={{ color: `var(--${marks[key]})` }}>
          {key}
        </span>,
      );
      rest = rest.slice(best + key.length);
    }
    return out;
  };
  return (
    <Well label={label} className={className}>
      <pre
        className={`overflow-x-auto px-4 py-3 text-12 leading-[1.7] ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}
        style={{ minHeight: minH }}
      >
        {lines.map((l, i) => (
          <div key={i}>
            {l.startsWith("$ ") ? (
              <>
                <span className="text-faint select-none">$ </span>
                {paint(l.slice(2), "text-hi")}
              </>
            ) : (
              paint(l || " ", "text-mute")
            )}
          </div>
        ))}
      </pre>
    </Well>
  );
}

/** a small outlined label. */
export function Chip({ children, tone, className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={`inline-block rounded-sm px-1.5 font-mono text-11 leading-[20px] ${className}`}
      style={{
        color: tone ? `var(--${tone})` : "var(--ink)",
        boxShadow: `inset 0 0 0 1px ${tone ? `color-mix(in srgb, var(--${tone}) 45%, transparent)` : "var(--line-2)"}`,
      }}
    >
      {children}
    </span>
  );
}

/** svg arrowhead marker. give each figure its own id. */
export function Arrowhead({ id, color = "var(--ref)" }: { id: string; color?: string }) {
  return (
    <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={color} />
    </marker>
  );
}

/** format numbers the same way everywhere. */
export const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
