import type { CSSProperties } from "react";
import { markShapes, type MarkKind, type Tone } from "@/lib/marks";

/**
 * the marks sit on a three by three dot grid (src/lib/marks.ts).
 * java: one ink slot, a stroke, and the object it points at, lit in the book colour. the faint
 * dots are the rest of the heap. the series mark (nine dots, each row smaller) never takes a colour.
 */
const BOOK: MarkKind = "java";
const PREFIX = "java.lang.";

const tones: Record<Tone, string> = { ink: "currentColor", faint: "var(--line-2)", book: "var(--book)" };

export function Mark({
  size = 20,
  kind = BOOK,
  className,
  style,
}: {
  size?: number;
  kind?: MarkKind;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      className={className}
      style={{ color: "var(--hi)", flex: "none", display: "block", ...style }}
    >
      {markShapes(kind).map((s, i) =>
        s.t === "dot" ? (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={tones[s.tone]} />
        ) : s.t === "pill" ? (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.h / 2} fill={tones[s.tone]} />
        ) : (
          <path key={i} d={`M${s.x1} ${s.y1}L${s.x2} ${s.y2}`} stroke={tones[s.tone]} strokeWidth={s.w} strokeLinecap="round" />
        ),
      )}
    </svg>
  );
}

/**
 * the wordmark: the address half is set as code (geist mono at 0.66em, mute), "everything" is set
 * as a book title (redaction). `size` is the size of "everything" in px; the mark matches it.
 * `bare` drops the code half, for tight spots (the 390 bar, if it needs it).
 */
export function Wordmark({ className, size = 20, bare = false }: { className?: string; size?: number; bare?: boolean }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.48) }}>
      <Mark size={size} />
      <span
        style={{
          fontFamily: "var(--font-title)",
          fontSize: size,
          lineHeight: 1,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          color: "var(--hi)",
          whiteSpace: "pre",
        }}
      >
        {!bare && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.66em", color: "var(--mute)", letterSpacing: "-0.01em", marginRight: "0.08em" }}>
            {PREFIX}
          </span>
        )}
        everything
      </span>
    </span>
  );
}

/**
 * the big lockup, for a brand card or a title page: the address on its own line, then an eroded
 * "everything" in redaction 20. 40px and up only, once a page.
 */
export function Lockup({ className, size = 52 }: { className?: string; size?: number }) {
  return (
    <span className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: Math.round(size * 0.2) }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <Mark size={Math.round(size * 0.38)} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: Math.max(13, Math.round(size * 0.29)), color: "var(--mute)", letterSpacing: "-0.01em", whiteSpace: "pre" }}>
          {PREFIX}
        </span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-title-eroded)",
          fontSize: size,
          lineHeight: 0.9,
          letterSpacing: "-0.025em",
          color: "var(--hi)",
        }}
      >
        everything
      </span>
    </span>
  );
}
