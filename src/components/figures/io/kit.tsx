"use client";

// shared pieces for the part 10 (io) and part 11 (meta) figures.
// colours only from tokens, and each semantic colour keeps its one meaning:
//   ref  = a reference / pointer / "points at" (buffer pointers, handles, arrows)
//   live = valid, correct, the happy path, "it worked"
//   dead = bug, exception, the wrong way, garbage, attacker
//   meta = runtime machinery (the JVM, the OS, class metadata, loaders, javac)
//   hot  = look here: the current step, the thing that just changed

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";
export type ToneOrMute = Tone | "mute" | "faint";

export const tv = (k?: ToneOrMute | null) => (!k ? "var(--ink)" : `var(--${k})`);
export const tint = (k: Tone, pct = 12) => `color-mix(in srgb, var(--${k}) ${pct}%, transparent)`;
export const ring = (k?: Tone | "line" | "line-2" | "hi" | "mute", pct?: number) =>
  `inset 0 0 0 1px ${!k ? "var(--line-2)" : pct ? `color-mix(in srgb, var(--${k}) ${pct}%, transparent)` : `var(--${k})`}`;

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

export function Row({ k, children, w = "10ch", last }: { k: ReactNode; children: ReactNode; w?: string; last?: boolean }) {
  return (
    <div
      className={`grid items-center gap-x-3 gap-y-1 py-2 ${last ? "" : "border-b border-line"}`}
      style={{ gridTemplateColumns: `${w} minmax(0,1fr)` }}
    >
      <span className="text-12 text-faint">{k}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** a row of .word options, selected one inverted. */
export function Words<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (T | { v: T; label: ReactNode })[];
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

/* ---- wells, chips, labels ------------------------------------------------------- */

export function Well({
  children,
  className = "",
  label,
  right,
  tone,
  style,
}: {
  children: ReactNode;
  className?: string;
  label?: ReactNode;
  right?: ReactNode;
  tone?: Tone | "hi";
  style?: CSSProperties;
}) {
  return (
    <div
      className={`min-w-0 rounded-md bg-well transition-[box-shadow] duration-200 ease-jle ${className}`}
      style={{ boxShadow: tone ? ring(tone) : ring("line"), ...style }}
    >
      {label && (
        <div className="flex min-h-9 items-center justify-between gap-3 border-b border-line px-4 py-1.5 text-12 text-ink">
          <span className="min-w-0">{label}</span>
          {right && <span className="text-11 text-faint">{right}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Chip({ children, tone, className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-xs px-1.5 text-11 leading-[20px] whitespace-nowrap ${className}`}
      style={{
        color: tone ? tv(tone) : "var(--ink)",
        boxShadow: tone ? ring(tone, 45) : ring("line"),
      }}
    >
      {children}
    </span>
  );
}

/** the little faint label above a panel. */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-2 border-b border-line pb-1.5 text-11 text-faint ${className}`}>{children}</div>;
}

/** a terminal-ish output block. */
export function Out({ children, className = "", live }: { children: ReactNode; className?: string; live?: boolean }) {
  return (
    <pre
      className={`overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)] ${className}`}
      aria-live={live ? "polite" : undefined}
    >
      {children}
    </pre>
  );
}

/** narration and notes inside a figure: people read these, so they're serif. inline code stays mono. */
export const NARR =
  "font-serif text-[1.0625rem] leading-[1.6] text-ink [&_code]:font-mono [&_code]:text-[0.8em] [&_code]:text-hi [&_em]:italic";

export function Narration({ children, className = "", live = true }: { children: ReactNode; className?: string; live?: boolean }) {
  return (
    <p className={`${NARR} ${className}`} aria-live={live ? "polite" : undefined}>
      {children}
    </p>
  );
}

/* ---- bytes ------------------------------------------------------------------- */

export const hex2 = (b: number) => (b & 0xff).toString(16).padStart(2, "0");

/** one byte as a little cell. */
export function ByteCell({ b, tone, dim, title }: { b: number; tone?: Tone; dim?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-7 min-w-[2.6ch] items-center justify-center rounded-[1px] px-1 text-12 tabular transition-[background-color,box-shadow,opacity] duration-200 ${
        dim ? "opacity-35" : ""
      }`}
      style={{
        color: tone ? tv(tone) : "var(--hi)",
        boxShadow: tone ? ring(tone, 70) : ring("line-2"),
        background: tone ? tint(tone, 10) : undefined,
      }}
    >
      {hex2(b)}
    </span>
  );
}

/* ---- tiny java highlighter (client side) ----------------------------------------
   same colours as the shiki themes, emitted as --shiki-dark / --shiki-light so
   globals.css picks the right one per theme. */

// [night, paper], mirroring src/mdx/themes.mjs: slate keywords, sage strings, brown literals,
// italic comments. muted on purpose so the semantic colours in the figures stay loud.
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
    "switch synchronized this throw throws transient try void volatile while var record yield sealed permits true false null module when " +
    "SELECT FROM WHERE AND OR INSERT INTO VALUES UPDATE SET BEGIN COMMIT ROLLBACK"
  ).split(" "),
);

type Tok = { t: string; k: keyof typeof C };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re =
    /(\/\/.*$)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[lLfFdD]?\b|\b0[xXbB][\da-fA-F_]+[lL]?\b)|(@?[A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'])/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [s, cmt, str, chr, num, word, ws] = m;
    if (cmt) out.push({ t: s, k: "cmt" });
    else if (str) out.push({ t: s, k: "str" });
    else if (chr || num) out.push({ t: s, k: "lit" });
    else if (word) {
      const next = src.slice(re.lastIndex).match(/^\s*\(/);
      out.push({ t: s, k: KW.has(word) ? "kw" : /^@?[A-Z]/.test(word) ? "ty" : next ? "fn" : "fg" });
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

/** a code panel: file tab + numbered lines, optional highlighted lines. */
export function CodePanel({
  file,
  code,
  hot = [],
  dead = [],
  live = [],
  nolines,
  className = "",
  right,
  plain,
}: {
  file?: ReactNode;
  code: string;
  hot?: number[];
  dead?: number[];
  live?: number[];
  nolines?: boolean;
  className?: string;
  right?: ReactNode;
  /** no syntax colouring (terminal output, javap, sql) */
  plain?: boolean;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className={`min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {file && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-4 text-12">
          <span className="truncate text-ink">{file}</span>
          {right}
        </div>
      )}
      <div className="overflow-x-auto py-3">
        <ol className="min-w-max text-12 leading-[1.75] sm:text-13">
          {lines.map((l, i) => {
            const n = i + 1;
            const tone = hot.includes(n) ? "hot" : dead.includes(n) ? "dead" : live.includes(n) ? "live" : null;
            return (
              <li
                key={i}
                className={`grid border-l-2 pr-5 transition-colors duration-200 ${nolines ? "grid-cols-[1fr] pl-4" : "grid-cols-[3.5ch_1fr] gap-x-3"}`}
                style={{
                  borderColor: tone ? `var(--${tone})` : "transparent",
                  background: tone ? tint(tone, 10) : undefined,
                }}
              >
                {!nolines && (
                  <span className="text-right tabular" style={{ color: tone ? `var(--${tone})` : "var(--faint)", opacity: tone ? 1 : 0.6 }}>
                    {n}
                  </span>
                )}
                <span className="whitespace-pre">{plain ? <span className="text-ink">{l || " "}</span> : <Java code={l || " "} />}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** svg arrowhead marker. pass a unique id. */
export function Arrowhead({ id, tone = "ref" }: { id: string; tone?: ToneOrMute | "line-2" | "ink" }) {
  return (
    <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={`var(--${tone})`} />
    </marker>
  );
}
