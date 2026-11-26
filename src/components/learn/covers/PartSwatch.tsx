import { patternPlanes } from "./patterns";
import { coverSpec } from "./spec";
import { coverStyle } from "./Cover";
import s from "./covers.module.css";

/**
 * the part's cover as a tiny swatch (14 to 18px) for the chapter rail and the chapter meta row.
 * decorative: the part name always sits next to it in text.
 */
export function PartSwatch({ part, size = 16, className }: { part: string | number; size?: number; className?: string }) {
  const spec = coverSpec(part);
  if (!spec) return null;
  const n = patternPlanes(spec.pattern).length;
  return (
    <span
      aria-hidden
      className={`${s.swatch} ${className ?? ""}`}
      data-deep={spec.deep || undefined}
      style={{ ...coverStyle(spec), width: size, height: Math.round(size * 1.25), ["--u" as string]: `${(size / 3.4).toFixed(2)}px` }}
    >
      <span className={`${s.ink} ${s.rest}`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={s.plane} data-i={i} />
        ))}
      </span>
      <span className={s.spine} />
    </span>
  );
}
