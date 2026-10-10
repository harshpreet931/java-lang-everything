"use client";

// small shared pieces for the part 07 (functional) and part 08 (modern) figures.
// same patterns as the reference figures: config-file rows, .word options, .act
// actions, wells with inset hairlines, colours only from tokens.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";
export type ToneOrMute = Tone | "mute" | "faint" | "ink" | "hi";

/** css colour for a tone. */
export const tv = (k?: ToneOrMute | null) => (k ? `var(--${k})` : "var(--ink)");
/** a faint wash of a tone, for backgrounds. */
export const tint = (k: Tone, pct = 12) => `color-mix(in srgb, var(--${k}) ${pct}%, transparent)`;
/** an inset hairline in a tone. */
export const ring = (k?: ToneOrMute | null, pct = 100) =>
  `inset 0 0 0 1px ${!k ? "var(--line-2)" : pct === 100 ? tv(k) : `color-mix(in srgb, ${tv(k)} ${pct}%, transparent)`}`;

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

/** the width of an element, kept up to date. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---- config-file rows: `key =` on the left ------------------------------------ */

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
      className={`grid gap-x-3 gap-y-1 py-2.5 text-13 ${last ? "" : "border-b border-line"} ${align === "center" ? "items-center" : "items-start"}`}
      style={{ gridTemplateColumns: `${w} minmax(0,1fr)` }}
    >
      <span className={`text-faint ${align === "start" ? "pt-1.5" : ""}`}>{k}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
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
  options: readonly ({ v: T; label: ReactNode } | T)[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => {
        const v = (typeof o === "object" ? o.v : o) as T;
        const l = typeof o === "object" ? o.label : String(o);
        return (
          <button key={String(v)} className="word" aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

/* ---- wells ---------------------------------------------------------------------- */

export function Well({
  children,
  className = "",
  label,
  right,
}: {
  children: ReactNode;
  className?: string;
  label?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={`rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {label && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-4 text-12">
          <span className="text-ink">{label}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/** the little terminal under a figure. */
export function Console({
  children,
  label = "stdout",
  minH = "3.4em",
  className = "",
}: {
  children: ReactNode;
  label?: ReactNode;
  minH?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-md bg-well-2/60 px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {label && <div className="mb-1 text-11 text-faint">{label}</div>}
      <pre className="overflow-x-auto text-12 leading-[1.7] whitespace-pre" style={{ minHeight: minH }} aria-live="polite">
        {children}
      </pre>
    </div>
  );
}

/** a small pill: a value, a type, a status. */
export function Chip({
  children,
  tone,
  solid,
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: ToneOrMute;
  solid?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 text-11 leading-[20px] whitespace-nowrap ${className}`}
      style={{
        color: solid ? "var(--bg)" : tone ? tv(tone) : "var(--ink)",
        background: solid ? tv(tone ?? "ink") : undefined,
        boxShadow: solid ? undefined : ring(tone && tone !== "ink" ? tone : null, tone && tone !== "ink" ? 55 : 100),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---- tiny java highlighter (client side) ----------------------------------------
   same colours as the shiki themes in src/mdx/themes.mjs (night, paper), emitted as
   --shiki-dark / --shiki-light so globals.css picks the right one per theme. */

const C = {
  kw: ["#a3b8c4", "#4f6878"],
  ty: ["#dcc6ad", "#6e5444"],
  fn: ["#e8d2b8", "#6a4f3c"],
  lit: ["#d9b285", "#8b6237"],
  str: ["#b3c49a", "#55704a"],
  cmt: ["#857e73", "#a09888"],
  punc: ["#a0968a", "#8a7e72"],
  fg: ["#e4ded3", "#3a332c"],
} as const;

const KW = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for " +
    "goto if implements import instanceof int interface long native new package private protected public return short static strictfp super " +
    "switch synchronized this throw throws transient try void volatile while var record yield sealed permits non-sealed true false null module when"
  ).split(" "),
);

type Tok = { t: string; k: keyof typeof C };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re =
    /(\/\/.*$)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[lLfFdD]?\b|\b0[xXbB][\da-fA-F_]+[lL]?\b)|(non-sealed|[A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'])/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [s, cmt, str, chr, num, word, ws] = m;
    if (cmt) out.push({ t: s, k: "cmt" });
    else if (str) out.push({ t: s, k: "str" });
    else if (chr || num) out.push({ t: s, k: "lit" });
    else if (word) {
      const next = src.slice(re.lastIndex).match(/^\s*\(/);
      out.push({ t: s, k: KW.has(word) ? "kw" : /^[A-Z]/.test(word) ? "ty" : next ? "fn" : "fg" });
    } else if (ws) out.push({ t: s, k: "fg" });
    else out.push({ t: s, k: "punc" });
  }
  return out;
}

export const tokStyle = (k: keyof typeof C): CSSProperties =>
  ({
    ["--shiki-dark" as string]: C[k][0],
    ["--shiki-light" as string]: C[k][1],
    fontStyle: k === "cmt" ? "italic" : undefined,
  }) as CSSProperties;

/** one line (or a few) of java, coloured like the code blocks. */
export function Java({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span className={className}>
      {tokenize(code).map((x, i) => (
        <span key={i} style={tokStyle(x.k)}>
          {x.t}
        </span>
      ))}
    </span>
  );
}

/** a code panel: file tab + numbered lines, lines can be toned. */
export function CodePanel({
  file,
  code,
  hot = [],
  dead = [],
  live = [],
  dim = [],
  nolines,
  className = "",
  right,
  notes,
}: {
  file?: ReactNode;
  code: string;
  hot?: number[];
  dead?: number[];
  live?: number[];
  /** lines to fade out */
  dim?: number[];
  nolines?: boolean;
  className?: string;
  right?: ReactNode;
  /** a short note pinned to the end of a line, by line number */
  notes?: Record<number, { text: ReactNode; tone?: Tone }>;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className={`overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {file && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-4 text-12">
          <span className="text-ink">{file}</span>
          {right}
        </div>
      )}
      <div className="overflow-x-auto py-3">
        <ol className="min-w-max text-13 leading-[1.75]">
          {lines.map((l, i) => {
            const n = i + 1;
            const tone: Tone | null = hot.includes(n) ? "hot" : dead.includes(n) ? "dead" : live.includes(n) ? "live" : null;
            const note = notes?.[n];
            return (
              <li
                key={i}
                className={`grid border-l-2 pr-5 transition-[background-color,border-color,opacity] duration-200 ease-jle ${
                  nolines ? "grid-cols-[1fr] pl-4" : "grid-cols-[4ch_1fr] gap-x-3.5"
                }`}
                style={{
                  borderColor: tone ? `var(--${tone})` : "transparent",
                  background: tone ? tint(tone, 10) : undefined,
                  opacity: dim.includes(n) ? 0.35 : 1,
                }}
              >
                {!nolines && (
                  <span className="text-right tabular" style={{ color: tone ? `var(--${tone})` : undefined, opacity: tone ? 1 : 0.6 }}>
                    <span className={tone ? "" : "text-faint"}>{n}</span>
                  </span>
                )}
                <span className="whitespace-pre">
                  <Java code={l || " "} />
                  {note && (
                    <span className="ml-3 text-11" style={{ color: tv(note.tone ?? "faint") }}>
                      {note.text}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** a compiler verdict line: "✓ compiles" or the real javac error. */
export function Verdict({ ok, children, label }: { ok: boolean; children?: ReactNode; label?: ReactNode }) {
  return (
    <div
      className="rounded-md px-4 py-3 text-12 leading-[1.7]"
      style={{ boxShadow: ring(ok ? "live" : "dead", 55), background: tint(ok ? "live" : "dead", 6) }}
      aria-live="polite"
    >
      <div style={{ color: ok ? "var(--live)" : "var(--dead)" }}>{label ?? (ok ? "compiles" : "compile error")}</div>
      {children && <div className="mt-1 whitespace-pre-wrap text-ink">{children}</div>}
    </div>
  );
}

/** narration inside a figure: people read it, so it's serif. */
export function Narrate({ children, className = "", minH = "3.4em" }: { children: ReactNode; className?: string; minH?: string }) {
  return (
    <p className={`font-serif text-17 leading-[1.6] text-ink ${className}`} style={{ minHeight: minH }} aria-live="polite">
      {children}
    </p>
  );
}
