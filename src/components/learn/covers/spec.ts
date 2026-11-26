// one cover per part, generated from data. the covers are the one place on the site with lots of
// colour, so their grounds live here as print colours, not as theme tokens: a cover is a printed
// object and looks the same in both themes (the dark theme dims it, it doesn't recolour it).
//
// the rule that holds the shelf together: the covers get darker as the book goes further down.
// parts 01 to 12 are light grounds printed in a dark ink. from 13 on (inside the JVM, gc and
// the rest of the internals) the grounds turn dark and the dots are lit, in both themes.
//
// `ink` is the dot colour at rest, `lit` is the colour a dot turns when the cover lights up.
// inks are tonal (a deep shade of the ground's own family) so no cover reads as one of the
// five semantic colours.

import { parts, type Part } from "@/content/curriculum";
import { patternPlanes, type Pattern, type Plane, type Unit } from "./patterns";

export type CoverSpec = {
  book: "java" | "sql";
  slug: string;
  n: number;
  title: string;
  blurb: string;
  chapters: number;
  pattern: Pattern;
  /** the cover's ground */
  ground: string;
  /** dot colour at rest */
  ink: string;
  /** dot colour when lit (hover, focus) */
  lit: string;
  /** dark ground, lit dots */
  deep: boolean;
};

type Print = [pattern: Pattern, ground: string, ink: string, lit: string];

// java: warm grounds, the circle family.
const PRINT: Record<string, Print> = {
  start: ["dots", "#dcc39f", "#3a2919", "#cf5a1c"],
  basics: ["sdots", "#eee0a6", "#363c6b", "#4a55d6"],
  oop: ["rings", "#efcec5", "#7b2a3d", "#da2f5e"],
  "core-api": ["fine", "#cfd9be", "#33472a", "#6d8f12"],
  generics: ["half", "#dcd3e6", "#45366b", "#9a48d2"],
  collections: ["ddots", "#c8dae7", "#1f3f5e", "#1a84c0"],
  functional: ["polka", "#f1c9a1", "#62301a", "#dc5418"],
  modern: ["dots", "#c7e0d4", "#1b564f", "#0c9a80"],
  concurrency: ["sdots", "#ecc3d0", "#72244f", "#d22a7c"],
  io: ["ddots", "#ddd6c8", "#2e2a25", "#a8541e"],
  meta: ["fine", "#e2dca2", "#454019", "#a58600"],
  tooling: ["half", "#d6ab60", "#3a2710", "#fff1c8"],
  jvm: ["rings", "#30241a", "#e0b07a", "#ffdcaa"],
  gc: ["sdots", "#1e2840", "#e6d496", "#fff1c0"],
  performance: ["fine", "#1b2a1d", "#b6d98f", "#e2ffc2"],
  "effective-java": ["dots", "#361521", "#eea7bd", "#ffd4e1"],
  "deep-dives": ["half", "#121a2c", "#9dcbee", "#d6edff"],
  future: ["polka", "#1a1230", "#c9b3f0", "#eee3ff"],
};

const FALLBACK: Pattern[] = ["dots", "sdots", "rings", "fine", "half", "ddots", "polka"];

/** relative luminance of a #rrggbb colour, 0 to 1 */
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function specFor(p: Part): CoverSpec {
  const [pattern, ground, ink, lit] = PRINT[p.slug] ?? [FALLBACK[p.n % FALLBACK.length], "#ddd6c8", "#2e2a25", "#a8541e"];
  return {
    book: "java",
    slug: p.slug,
    n: p.n,
    title: p.title,
    blurb: p.blurb,
    chapters: p.chapters.length,
    pattern,
    ground,
    ink,
    lit,
    deep: luminance(ground) < 0.12,
  };
}

/**
 * the cover for a part, as pure data. og images and anything else that draws a cover read this.
 * pass a slug or a part number.
 */
export function coverSpec(part: string | number): CoverSpec | undefined {
  const p = typeof part === "number" ? parts.find((x) => x.n === part) : parts.find((x) => x.slug === part);
  return p && specFor(p);
}

export const covers: CoverSpec[] = parts.map(specFor);

/**
 * the planes of a cover's pattern with real px lengths and a literal ink, ready for a renderer
 * without css variables (satori). `u` is the pattern pitch: about 22 on a 180px cover.
 */
export function coverPlanes(spec: CoverSpec, u: number, ink: "ink" | "lit" = "ink"): Plane[] {
  return patternPlanes(spec.pattern, u as Unit, spec[ink]);
}
