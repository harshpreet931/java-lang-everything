"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// small shared bits for the meta (part 11) and performance (part 15) figures.
// colours only from tokens, each semantic colour keeping its one meaning:
//   ref  = references, pointers, "points at", arrows
//   live = valid, found, correct, the answer
//   dead = exception, bug, the wrong way, garbage
//   meta = runtime machinery: Class objects, handlers, bootstraps, loaders
//   hot  = look here: the current step, the thing that changed

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";

export const tv = (k?: Tone | "mute" | null) => (!k ? "var(--ink)" : k === "mute" ? "var(--mute)" : `var(--${k})`);
export const tint = (k: Tone, pct = 12) => `color-mix(in srgb, var(--${k}) ${pct}%, transparent)`;

/** a config-file style row: `key =` on the left, controls on the right. */
export function Row({ k, children, w = "11ch" }: { k: ReactNode; children: ReactNode; w?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2">
      <span className="shrink-0 text-12 text-faint" style={{ width: w }}>
        {k}
      </span>
      <div className="flex min-w-[min(100%,17rem)] flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** option words; the selected one is a soft filled chip. */
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

/** narration under a figure, in the reading face. */
export function Narrate({ children, min = "3.4em" }: { children: ReactNode; min?: string }) {
  return (
    <p className="mt-4 font-serif text-17 leading-[1.6] text-ink" style={{ minHeight: min }} aria-live="polite">
      {children}
    </p>
  );
}

/** a small terminal-ish panel for real output. */
export function Out({ children, title, className = "" }: { children: ReactNode; title?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {title && <div className="mb-1 text-11 text-faint">{title}</div>}
      <pre className="overflow-x-auto rounded-md bg-well px-3 py-2.5 text-12 leading-[1.7] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
        {children}
      </pre>
    </div>
  );
}

/** a label above a group. */
export function PaneTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1.5 text-11 text-faint">
      <span>{children}</span>
      {right && <span className="tabular">{right}</span>}
    </div>
  );
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/** a legend swatch + label. */
export function Key({ tone, children, bar }: { tone: Tone | "ink" | "faint"; children: ReactNode; bar?: boolean }) {
  const c = tone === "ink" ? "var(--ink)" : tone === "faint" ? "var(--line-2)" : `var(--${tone})`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={bar ? "inline-block h-[3px] w-4" : "inline-block size-2.5 rounded-[2px]"} style={{ background: c }} />
      {children}
    </span>
  );
}

/** the rendered width of an element, for svgs that draw in real pixels so text stays readable on phones. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
