"use client";

// small shared pieces for the part 16 (effective java) and part 18 (future) figures.
// same patterns as the reference kit in figures/basics/kit.tsx, copied here so these
// figures never depend on another part's folder.
//
// the figure frame itself is a `well` panel, so panels inside a figure sit on `bg`
// (the paper) with a hairline. mono everywhere, serif for narration people read.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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

/* ---- config-file rows: `key =` on the left ------------------------------------ */

/** narration under a figure: serif, because people read it. */
export function Narration({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-serif text-[1.02rem] leading-[1.6] text-ink ${className}`} aria-live="polite">
      {children}
    </p>
  );
}

export function Row({ k, children, w = "9ch", last }: { k: ReactNode; children: ReactNode; w?: string; last?: boolean }) {
  return (
    <div
      className={`grid items-center gap-3 py-2.5 ${last ? "" : "border-b border-line"}`}
      style={{ gridTemplateColumns: `${w} minmax(0,1fr)` }}
    >
      <span className="text-12 text-faint">{k}</span>
      <div className="min-w-0">{children}</div>
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

/* ---- a terminal-ish well ------------------------------------------------------- */

export function Well({ children, className = "", label }: { children: ReactNode; className?: string; label?: ReactNode }) {
  return (
    <div className={`rounded-md bg-bg shadow-[inset_0_0_0_1px_var(--line-2)] ${className}`}>
      {label && <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">{label}</div>}
      {children}
    </div>
  );
}

/** a small outlined chip, optionally in a semantic tone. */
export function Chip({ children, tone, className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 font-mono text-11 leading-[20px] whitespace-nowrap ${className}`}
      style={{
        color: tone ? `var(--${tone})` : "var(--mute)",
        boxShadow: `inset 0 0 0 1px ${tone ? `color-mix(in srgb, var(--${tone}) 45%, transparent)` : "var(--line-2)"}`,
      }}
    >
      {children}
    </span>
  );
}

/* ---- tiny java highlighter (client side) ----------------------------------------
   same colours as the shiki themes in src/mdx/themes.mjs, emitted as --shiki-dark /
   --shiki-light so globals.css picks the right one per theme. */

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
    "switch synchronized this throw throws transient try void volatile while var record yield sealed permits true false null module when value with"
  ).split(" "),
);

type Tok = { t: string; k: keyof typeof C };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re =
    /(\/\/.*$)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[lLfFdD]?\b|\b0[xXbB][\da-fA-F_]+[lL]?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'])/gm;
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
    ...(k === "cmt" ? { fontStyle: "italic" } : {}),
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

/** a code panel: file tab + numbered lines, optional toned lines. */
export function CodePanel({
  file,
  code,
  hot = [],
  dead = [],
  live = [],
  nolines,
  className = "",
  right,
}: {
  file?: ReactNode;
  code: string;
  hot?: number[];
  dead?: number[];
  live?: number[];
  nolines?: boolean;
  className?: string;
  right?: ReactNode;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className={`overflow-hidden rounded-md bg-bg font-mono shadow-[inset_0_0_0_1px_var(--line-2)] ${className}`}>
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
            const tone = hot.includes(n) ? "hot" : dead.includes(n) ? "dead" : live.includes(n) ? "live" : null;
            return (
              <li
                key={i}
                className={`grid border-l-2 pr-5 transition-colors duration-200 ${nolines ? "grid-cols-[1fr] pl-4" : "grid-cols-[4ch_1fr] gap-x-3.5"}`}
                style={{
                  borderColor: tone ? `var(--${tone})` : "transparent",
                  background: tone ? `color-mix(in srgb, var(--${tone}) 10%, transparent)` : undefined,
                }}
              >
                {!nolines && (
                  <span className="text-right tabular" style={{ color: tone ? `var(--${tone})` : undefined, opacity: tone ? 1 : 0.6 }}>
                    <span className={tone ? "" : "text-faint"}>{n}</span>
                  </span>
                )}
                <span className="whitespace-pre">
                  <Java code={l || " "} />
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
