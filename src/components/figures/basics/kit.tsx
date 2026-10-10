"use client";

// small shared pieces for the part 01 + 02 figures. nothing here is generic enough
// for src/components/viz, it just keeps the bespoke figures consistent with each other.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { darkTheme, lightTheme } from "@/mdx/themes.mjs";

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

/* ---- numbers, printed the way java prints them --------------------------------- */

/** Double.toString: plain between 1e-3 and 1e7, otherwise 1.0E10 style. js and java agree on the digits. */
export function javaDouble(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) {
    const s = String(x);
    return s.includes(".") ? s : `${s}.0`;
  }
  const [m, e] = x.toExponential().split("e");
  return `${m.includes(".") ? m : `${m}.0`}E${Number(e)}`;
}


/* ---- config-file rows: `key =` on the left ------------------------------------ */

export function Row({ k, children, w = "9ch", last, center }: { k: ReactNode; children: ReactNode; w?: string; last?: boolean; center?: boolean }) {
  // wide labels stack above their options on phones, short ones stay inline
  const wide = parseFloat(w) > 12;
  return (
    <div
      className={`grid ${center ? "items-center" : "items-baseline"} gap-x-3 py-2.5 ${wide ? "gap-y-1 grid-cols-[minmax(0,1fr)] sm:grid-cols-[var(--kw)_minmax(0,1fr)]" : "grid-cols-[var(--kw)_minmax(0,1fr)]"} ${
        last ? "" : "border-b border-line"
      }`}
      style={{ ["--kw" as string]: w } as CSSProperties}
    >
      <span className="text-faint">{k}</span>
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
    <div className={`rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {label && <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">{label}</div>}
      {children}
    </div>
  );
}

/* ---- tiny java highlighter (client side) ----------------------------------------
   same colours as the shiki themes in src/mdx/themes.mjs (read from them, not copied),
   emitted as --shiki-light / --shiki-dark so globals.css picks the right one per theme. */

type ThemeRule = { scope?: string[]; settings: { foreground?: string; fontStyle?: string } };
type Theme = { colors: Record<string, string>; tokenColors: ThemeRule[] };

const pick = (t: Theme, scope: string) => {
  // the last rule mentioning the scope wins, like in a textmate theme
  const r = [...t.tokenColors].reverse().find((x) => x.scope?.includes(scope));
  return { fg: r?.settings.foreground ?? t.colors["editor.foreground"], italic: r?.settings.fontStyle === "italic" };
};

const KINDS = {
  kw: "keyword",
  ty: "entity.name.type",
  fn: "entity.name.function",
  lit: "constant.numeric",
  str: "string",
  cmt: "comment",
  punc: "punctuation",
} as const;

type Kind = keyof typeof KINDS | "fg";

const C = Object.fromEntries(
  (Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => [
    k,
    { dark: pick(darkTheme as Theme, KINDS[k]), light: pick(lightTheme as Theme, KINDS[k]) },
  ]),
) as Record<keyof typeof KINDS, { dark: { fg: string; italic: boolean }; light: { fg: string; italic: boolean } }>;

const FG = { dark: (darkTheme as Theme).colors["editor.foreground"], light: (lightTheme as Theme).colors["editor.foreground"] };

const KW = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for " +
    "goto if implements import instanceof int interface long native new package private protected public return short static strictfp super " +
    "switch synchronized this throw throws transient try void volatile while var record yield sealed permits module when"
  ).split(" "),
);
const CONST = new Set(["true", "false", "null"]);

type Tok = { t: string; k: Kind };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re =
    /(\/\/.*$)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[lLfFdD]?\b|\b0[xXbB][\da-fA-F_]+[lL]?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'])/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [s, cmt, str, chr, num, word, ws] = m;
    if (cmt) out.push({ t: s, k: "cmt" });
    else if (str || chr) out.push({ t: s, k: "str" });
    else if (num) out.push({ t: s, k: "lit" });
    else if (word) {
      const next = src.slice(re.lastIndex).match(/^\s*\(/);
      out.push({ t: s, k: CONST.has(word) ? "lit" : KW.has(word) ? "kw" : /^[A-Z]/.test(word) ? "ty" : next ? "fn" : "fg" });
    } else if (ws) out.push({ t: s, k: "fg" });
    else out.push({ t: s, k: "punc" });
  }
  return out;
}

export const tokStyle = (k: Kind): CSSProperties => {
  if (k === "fg") return { ["--shiki-dark" as string]: FG.dark, ["--shiki-light" as string]: FG.light } as CSSProperties;
  const c = C[k];
  return {
    ["--shiki-dark" as string]: c.dark.fg,
    ["--shiki-light" as string]: c.light.fg,
    ...(c.light.italic ? { ["--shiki-light-font-style" as string]: "italic", ["--shiki-dark-font-style" as string]: "italic" } : {}),
  } as CSSProperties;
};

/** one line (or a few) of java, coloured like the code blocks. */
export function Java({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span className={`font-mono ${className}`}>
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
