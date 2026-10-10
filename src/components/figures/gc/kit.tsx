"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// small shared pieces for the gc figures. nothing here is part of the public
// viz api; it only exists so the 13 gc chapters look and behave the same.

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";

/** the css variable for a semantic tone */
export const tv = (t: Tone) => `var(--${t})`;

/** a faint fill of a semantic tone, for boxes that carry that meaning */
export const tint = (t: Tone, pct = 12) => `color-mix(in srgb, var(--${t}) ${pct}%, transparent)`;

/** width of an element, kept in sync with a ResizeObserver. svg figures lay out from this. */
export function useWidth<T extends HTMLElement = HTMLDivElement>(fallback = 680) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || fallback);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

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

/** a config-file row: `key =` on the left, controls on the right */
export function Row({ k, children, kw = "11ch", last }: { k: string; children: ReactNode; kw?: string; last?: boolean }) {
  return (
    <div
      className={`grid items-center gap-x-3 py-2 text-13 ${last ? "" : "border-b border-line"}`}
      style={{ gridTemplateColumns: `${kw} minmax(0,1fr)` }}
    >
      <span className="text-faint">{k} =</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** lowercase option words, selected one inverted */
export function Words<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (T | { v: T; label: string })[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.v : o;
        const text = typeof o === "object" ? o.label : String(o);
        return (
          <button key={String(v)} className="word" aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** a row of tone chips: what each colour means in this figure */
export function Legend({ items, className = "" }: { items: [Tone | "mute", string][]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint ${className}`}>
      {items.map(([t, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-[1px]"
            style={{ background: t === "mute" ? "var(--line-2)" : tv(t) }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

/** narration under a figure. announced to screen readers. */
export function Readout({ children, className = "", minLines = 2 }: { children: ReactNode; className?: string; minLines?: number }) {
  return (
    <p
      className={`font-serif text-[16px] leading-[1.6] text-ink ${className}`}
      style={{ minHeight: `${minLines * 1.6}em` }}
      aria-live="polite"
    >
      {children}
    </p>
  );
}

/** a small stat: faint label over a number */
export function Stat({ k, v, tone }: { k: string; v: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-11 text-faint">{k}</div>
      <div className="text-14 tabular" style={{ color: tone ? tv(tone) : "var(--hi)" }}>
        {v}
      </div>
    </div>
  );
}

/** svg arrowhead markers, one per tone. ids are prefixed so figures never clash. */
export function Heads({ id, tones = ["ref"] }: { id: string; tones?: (Tone | "mute")[] }) {
  return (
    <defs>
      {tones.map((t) => (
        <marker
          key={t}
          id={`${id}-${t}`}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={t === "mute" ? "var(--line-2)" : tv(t)} />
        </marker>
      ))}
    </defs>
  );
}

/** deterministic randomness, so a figure looks the same on every load (and in screenshots) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mb = (n: number, digits = 0) => `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} MB`;
