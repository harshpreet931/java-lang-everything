import type { CSSProperties } from "react";
import { pad2 } from "@/content/curriculum";
import { patternPlanes, type Plane } from "./patterns";
import type { CoverSpec } from "./spec";
import { CoverProgress } from "./CoverProgress";
import s from "./covers.module.css";

/**
 * the pattern's planes as custom properties on the cover root, so the three ink layers
 * (rest, lit, crest) share one copy and differ only by `color` (the planes draw in currentColor).
 */
export function planeVars(planes: Plane[]): Record<string, string | number> {
  const v: Record<string, string | number> = {};
  planes.forEach((p, i) => {
    const j = (ls: Plane["layers"], k: "image" | "size" | "position" | "repeat", d: string) =>
      ls.map((l) => l[k] ?? d).join(", ");
    v[`--p${i}i`] = j(p.layers, "image", "none");
    v[`--p${i}s`] = j(p.layers, "size", "auto");
    v[`--p${i}p`] = j(p.layers, "position", "0 0");
    v[`--p${i}r`] = j(p.layers, "repeat", "repeat");
    if (p.mask) {
      v[`--p${i}mi`] = j(p.mask, "image", "none");
      v[`--p${i}ms`] = j(p.mask, "size", "auto");
      v[`--p${i}mp`] = j(p.mask, "position", "0 0");
      v[`--p${i}mc`] = p.compose ?? "add";
    }
    if (p.opacity != null) v[`--p${i}a`] = p.opacity;
  });
  return v;
}

export function coverStyle(spec: CoverSpec): CSSProperties {
  return {
    "--cv-g": spec.ground,
    "--cv-k": spec.ink,
    "--cv-lit": spec.lit,
    ...planeVars(patternPlanes(spec.pattern)),
  } as CSSProperties;
}

function Ink({ planes, kind }: { planes: number; kind: "rest" | "lit" | "crest" }) {
  return (
    <div className={`${s.ink} ${s[kind]}`} aria-hidden>
      {Array.from({ length: planes }, (_, i) => (
        <div key={i} className={s.plane} data-i={i} />
      ))}
    </div>
  );
}

/** the printed board: ground, dots, spine. no text. */
export function CoverFace({ spec }: { spec: CoverSpec }) {
  const n = patternPlanes(spec.pattern).length;
  return (
    <div className={s.face}>
      <Ink planes={n} kind="rest" />
      <Ink planes={n} kind="lit" />
      <Ink planes={n} kind="crest" />
      <div className={s.spine} aria-hidden />
      <div className={s.finish} aria-hidden />
    </div>
  );
}

type Props = {
  spec: CoverSpec;
  /** shelf: a volume on /learn. large: the part opener. */
  size?: "shelf" | "large";
  /** chapter hrefs, for the progress rule on the label */
  hrefs?: string[];
  /** heading level of the title on the label, if it should be one */
  as?: "h2" | "div";
};

/** a part cover: the face plus a pasted paper label with number, chapter count, title and a progress rule. */
export function Cover({ spec, size = "shelf", hrefs, as: T = "div" }: Props) {
  return (
    <div className={`${s.cover} ${s[size]}`} data-deep={spec.deep || undefined} style={coverStyle(spec)}>
      <CoverFace spec={spec} />
      <div className={s.label}>
        <div className={s.n}>
          <span>{pad2(spec.n)}</span>
          <span aria-hidden>{spec.chapters} ch</span>
          <span className="sr-only">, {spec.chapters} chapters</span>
        </div>
        <T className={s.t}>{spec.title}</T>
        {hrefs && <CoverProgress hrefs={hrefs} />}
      </div>
    </div>
  );
}
