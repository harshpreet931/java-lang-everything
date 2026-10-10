"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// small shared pieces for the collections figures. everything here follows the
// StackOverflowMeter pattern: config-file rows, words, acts, wells, tokens only.

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";

/** a `key =` row, like a line in a config file. */
export function Row({
  k,
  children,
  w = "9ch",
  last,
  align = "center",
}: {
  k: ReactNode;
  children: ReactNode;
  w?: string;
  last?: boolean;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`grid gap-x-3 py-2.5 ${last ? "" : "border-b border-line"} ${align === "center" ? "items-center" : "items-start"}`}
      style={{ gridTemplateColumns: `${w} minmax(0,1fr)` }}
    >
      <span className="text-faint">{k}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** the little terminal under a figure: what happened, in words. */
export function Console({ children, minH = "4.6em", label }: { children: ReactNode; minH?: string; label?: string }) {
  return (
    <div className="rounded-xs bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      {label && <div className="mb-1 text-11 text-faint">{label}</div>}
      <div
        className="overflow-x-auto text-12 leading-[1.7] whitespace-pre-wrap [&_.say]:font-serif [&_.say]:text-[0.98rem] [&_.say]:leading-[1.55]"
        style={{ minHeight: minH }}
        aria-live="polite"
      >
        {children}
      </div>
    </div>
  );
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

/** width of an element, kept up to date. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** String.hashCode(), exactly like java: s[0]*31^(n-1) + ... + s[n-1], with int overflow. */
export function javaHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** HashMap.hash(): the high 16 bits folded into the low 16. */
export const spread = (h: number) => (h ^ (h >>> 16)) | 0;

/** 32 bits as a string of 0s and 1s */
export const bits32 = (n: number) => (n >>> 0).toString(2).padStart(32, "0");

export const fmt = (n: number) => n.toLocaleString("en-US");

/** a run of timeouts you can cancel as one (for little scripted animations). */
export function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach((t) => clearTimeout(t)), []);
  return {
    after(ms: number, f: () => void) {
      ids.current.push(window.setTimeout(f, ms));
    },
    clear() {
      ids.current.forEach((t) => clearTimeout(t));
      ids.current = [];
    },
  };
}

/** colour for a tone, as a css var */
export const tv = (t?: Tone) => (t ? `var(--${t})` : undefined);
