"use client";

// small pieces shared by the part 05 (generics) and part 08 (modern) figures.
// builds on ../functional/kit (rows, words, code panels, the java highlighter).

import type { ReactNode } from "react";
import { ring, tint, tv, type Tone, type ToneOrMute } from "../functional/kit";

export type Line = { t: ReactNode; tone?: ToneOrMute };

/** a little terminal: a `$ command` tab and toned output lines. */
export function Terminal({
  cmd,
  lines,
  edge,
  dim,
  className = "",
  minH,
}: {
  cmd: ReactNode;
  lines: Line[];
  /** a tone for the frame, when this is where something happened */
  edge?: Tone;
  /** fade it out (never ran, not reached) */
  dim?: boolean;
  className?: string;
  minH?: string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-md transition-[opacity,box-shadow] duration-200 ease-jle ${className}`}
      style={{
        boxShadow: edge ? ring(edge, 55) : "inset 0 0 0 1px var(--line)",
        background: edge ? tint(edge, 5) : "var(--well)",
        opacity: dim ? 0.45 : 1,
      }}
    >
      <div className="flex h-8 items-center gap-2 border-b border-line px-3.5 text-12 text-ink">
        <span className="text-faint">$</span>
        <span className="truncate">{cmd}</span>
      </div>
      <pre className="overflow-x-auto px-3.5 py-2.5 text-12 leading-[1.7] whitespace-pre" style={{ minHeight: minH }} aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.tone ? tv(l.tone) : "var(--ink)" }}>
            {l.t === "" ? " " : l.t}
          </div>
        ))}
      </pre>
    </div>
  );
}

/** a small arrow between two stages, horizontal on wide screens, vertical on phones. */
export function StageArrow({ label }: { label?: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-11 text-faint" aria-hidden>
      <span className="@[620px]:hidden">↓</span>
      <span className="hidden @[620px]:inline">→</span>
      {label && <span>{label}</span>}
    </div>
  );
}

/** a tag that says "compile time" / "run time" etc. */
export function Phase({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className="text-11 tracking-wide" style={{ color: tone ? tv(tone) : "var(--faint)" }}>
      {children}
    </span>
  );
}
