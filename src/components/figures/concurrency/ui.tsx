"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// small shared bits for the concurrency figures. colours only from tokens,
// and each semantic colour keeps its one meaning:
//   hot  = the thread acting right now / what just changed
//   live = correct result, lock acquired, running
//   dead = race, lost update, deadlock, exception
//   meta = locks, monitors, the runtime's own machinery
//   ref  = references / pointers

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";
export type ToneOrMute = Tone | "mute";

export const tv = (k?: ToneOrMute | null) => (!k ? "var(--ink)" : k === "mute" ? "var(--mute)" : `var(--${k})`);
export const tint = (k: Tone, pct = 12) => `color-mix(in srgb, var(--${k}) ${pct}%, transparent)`;

/** a config-file style row: `key =` on the left, controls on the right. */
export function Row({ k, children, w = "11ch" }: { k: ReactNode; children: ReactNode; w?: string }) {
  return (
    <div className="grid items-center gap-x-3 border-b border-line py-2" style={{ gridTemplateColumns: `${w} minmax(0,1fr)` }}>
      <span className="text-12 text-faint">{k}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** lowercase option words, selected one inverted. */
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

/** a slider with its value printed on the right. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <input
        type="range"
        className="slider min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="w-[7ch] text-right text-13 text-hi tabular">{format ? format(value) : value}</span>
    </div>
  );
}

/** a small framed box: the "well" used for memory cells, queues, deques. */
export function Well({ children, className = "", tone, dashed }: { children?: ReactNode; className?: string; tone?: Tone; dashed?: boolean }) {
  return (
    <div
      className={`rounded-md bg-well ${className}`}
      style={{
        boxShadow: dashed ? undefined : `inset 0 0 0 1px ${tone ? `var(--${tone})` : "var(--line-2)"}`,
        border: dashed ? `1px dashed ${tone ? `var(--${tone})` : "var(--line-2)"}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** a label above a group, like the "stack" / "heap" pane titles. */
export function PaneTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1.5 text-11 text-faint">
      <span>{children}</span>
      {right && <span className="tabular">{right}</span>}
    </div>
  );
}

/** narration line under a figure. */
export function Narrate({ children, min = "3.4em" }: { children: ReactNode; min?: string }) {
  return (
    <p className="mt-4 font-serif text-17 leading-[1.6] text-ink" style={{ minHeight: min }} aria-live="polite">
      {children}
    </p>
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

/**
 * calls fn every `ms` while `running`, but only while the element is on screen.
 * returns a ref to put on the figure root.
 */
export function useTicker(running: boolean, ms: number, fn: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => visible.current && cb.current(), ms);
    return () => clearInterval(t);
  }, [running, ms]);
  return ref;
}

/** a tiny seeded random, so "shuffle" and simulations are repeatable per seed. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
