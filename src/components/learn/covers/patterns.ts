// the cover patterns, written in the dot language of the figures.
//
// java covers use the circle family (dots, rings, half dots, stripes inside dots, dot grids);
// sql covers use rules and cells made of dot rows (ledger ruling, grids, hatching, checks, plaid).
// both families live here so the two books can share one renderer and the og images.
//
// a pattern is a list of planes. a plane is a stack of css background layers, optionally cut by
// a stack of mask layers. every length is a multiple of one pitch `u`, so the same pattern draws a
// 280px cover, a 180px shelf cover and a 16px swatch. pure data: no dom, no react.

export type JavaPattern = "dots" | "sdots" | "rings" | "fine" | "half" | "ddots" | "polka";
export type SqlPattern = "ruled" | "grid" | "hatch" | "check" | "plaid" | "rows" | "cells";
export type Pattern = JavaPattern | SqlPattern;

export type Layer = { image: string; size: string; position?: string; repeat?: string };
/** `compose`: how several mask layers combine. "add" is a union, "intersect" cuts. */
export type Plane = { layers: Layer[]; mask?: Layer[]; compose?: "add" | "intersect"; opacity?: number };

/**
 * how lengths are written. `"var"` emits `calc(var(--u) * m)` so css can rescale a cover per
 * breakpoint; a number emits plain px for renderers that can't do calc (satori, canvas).
 */
export type Unit = number | "var";

/** @param ink the dot colour. `currentColor` lets one set of planes be drawn in several inks. */
export function patternPlanes(pattern: Pattern, unit: Unit = "var", ink = "currentColor"): Plane[] {
  const L = (m: number) =>
    unit === "var" ? `calc(var(--u) * ${m})` : `${+(unit * m).toFixed(3)}px`;
  const soft = (r: string) => (unit === "var" ? `calc(${r} + .7px)` : `${parseFloat(r) + 0.7}px`);
  const dot = (x: string, y: string, r: string, c = ink) =>
    `radial-gradient(circle at ${x} ${y}, ${c} ${r}, transparent ${soft(r)})`;
  const sz = (w: number, h = w) => `${L(w)} ${L(h)}`;

  switch (pattern) {
    // ---- java: circles. objects, references, things you point at ----
    case "dots":
      return [{ layers: [{ image: dot(L(0.5), L(0.5), L(0.29)), size: sz(1) }] }];
    case "polka":
      return [
        {
          layers: [
            { image: dot(L(0.5), L(0.5), L(0.25)), size: sz(1) },
            { image: dot("0px", "0px", L(0.1)), size: sz(1) },
          ],
        },
      ];
    case "fine":
      return [{ layers: [{ image: dot(L(0.21), L(0.21), L(0.075)), size: sz(0.42) }] }];
    case "half":
      return [{ layers: [{ image: dot(L(0.5), L(0.64), L(0.43)), size: sz(1, 0.64) }] }];
    case "rings": {
      const c = L(0.62);
      const s = (a: number, b: number) => `${ink} ${L(a)} ${L(b)}`;
      const t = (a: number, b: number) => `transparent ${L(a)} ${L(b)}`;
      return [
        {
          layers: [
            {
              image: `radial-gradient(circle at ${c} ${c}, ${s(0, 0.1)}, ${t(0.11, 0.2)}, ${s(0.21, 0.28)}, ${t(0.29, 0.37)}, ${s(0.38, 0.44)}, transparent ${L(0.45)})`,
              size: sz(1.24),
            },
          ],
        },
      ];
    }
    case "sdots": {
      const w = unit === "var" ? `max(.7px, ${L(0.07)})` : `${Math.max(0.7, unit * 0.07)}px`;
      return [
        {
          layers: [
            {
              image: `repeating-linear-gradient(90deg, ${ink} 0 ${w}, transparent ${w} calc(${w} * 2.5))`,
              size: "auto",
            },
          ],
          mask: [{ image: dot(L(0.55), L(0.55), L(0.42), "#000"), size: sz(1.1) }],
        },
      ];
    }
    case "ddots": {
      const w = unit === "var" ? `max(.7px, ${L(0.065)})` : `${Math.max(0.7, unit * 0.065)}px`;
      return [
        {
          layers: [
            {
              image: `repeating-linear-gradient(45deg, ${ink} 0 ${w}, transparent ${w} calc(${w} * 2.7))`,
              size: "auto",
            },
          ],
          mask: [
            { image: dot(L(0.5), L(0.5), L(0.34), "#000"), size: sz(1) },
            { image: dot(L(0.5), L(0.5), L(0.34), "#000"), size: sz(1), position: `${L(0.5)} ${L(0.5)}` },
          ],
        },
      ];
    }

    // ---- sql: rules and cells, every line a row of dots ----
    case "ruled": {
      const p = 0.22;
      return [
        { layers: [{ image: dot(L(p / 2), L(p / 2), L(0.07)), size: sz(p, 0.6) }] },
        {
          opacity: 0.6,
          layers: [
            { image: dot(L(p / 2), L(p / 2), L(0.07)), size: sz(p), position: `${L(1.15)} 0`, repeat: "repeat-y" },
            { image: dot(L(p / 2), L(p / 2), L(0.07)), size: sz(p), position: `${L(1.4)} 0`, repeat: "repeat-y" },
          ],
        },
      ];
    }
    case "grid": {
      const p = 0.2;
      return [
        {
          layers: [
            { image: dot(L(p / 2), L(p / 2), L(0.068)), size: sz(p, 1) },
            { image: dot(L(p / 2), L(p / 2), L(0.068)), size: sz(1, p) },
          ],
        },
      ];
    }
    case "hatch":
      return [
        {
          layers: [0, 1, 2, 3, 4].map((i) => ({
            image: dot(L(0.1 + i * 0.2), L(0.9 - i * 0.2), L(0.075)),
            size: sz(1),
          })),
        },
      ];
    case "check":
      return [
        {
          layers: [{ image: dot(L(0.1), L(0.1), L(0.07)), size: sz(0.2) }],
          mask: [
            {
              image: "conic-gradient(#000 25%, transparent 0 50%, #000 0 75%, transparent 0)",
              size: sz(1.6),
            },
          ],
        },
      ];
    case "plaid": {
      const band = (deg: number) =>
        `repeating-linear-gradient(${deg}deg, #000 0 ${L(0.46)}, transparent ${L(0.46)} ${L(1.38)})`;
      const fill = { image: dot(L(0.1), L(0.1), L(0.068)), size: sz(0.2) };
      return [
        { opacity: 0.72, layers: [fill], mask: [{ image: band(0), size: "auto" }] },
        { opacity: 0.72, layers: [fill], mask: [{ image: band(90), size: "auto" }] },
        { opacity: 0.5, layers: [{ image: dot(L(0.1), L(0.1), L(0.05)), size: sz(0.2, 0.92) }] },
      ];
    }
    case "rows": {
      const p = 0.2;
      return [
        {
          layers: [{ image: dot(L(p / 2), L(p / 2), L(0.068)), size: sz(p, 0.46), position: `0 ${L(0.96)}` }],
          mask: [
            {
              image: `repeating-linear-gradient(90deg, #000 0 ${L(1.75)}, transparent ${L(1.75)} ${L(2.05)})`,
              size: "auto",
            },
            { image: `linear-gradient(transparent 0 ${L(0.86)}, #000 ${L(0.86)})`, size: "auto" },
          ],
          compose: "intersect",
        },
        {
          layers: [{ image: dot(L(p / 2), L(p / 2), L(0.075)), size: sz(p) }],
          mask: [{ image: `linear-gradient(#000 0 ${L(0.62)}, transparent ${L(0.62)})`, size: "auto" }],
        },
      ];
    }
    case "cells": {
      const p = 1 / 6;
      return [
        {
          layers: [{ image: dot(L(p / 2), L(p / 2), L(0.058)), size: sz(p) }],
          mask: [{ image: `conic-gradient(from 270deg at ${L(0.5)} ${L(0.5)}, #000 25%, transparent 0)`, size: sz(1) }],
        },
      ];
    }
  }
}

/** a plane as plain css declarations (for satori or any inline-style renderer). */
export function planeStyle(plane: Plane): Record<string, string | number> {
  const j = (k: keyof Layer, d: string) => plane.layers.map((l) => l[k] ?? d).join(", ");
  const s: Record<string, string | number> = {
    backgroundImage: j("image", "none"),
    backgroundSize: j("size", "auto"),
    backgroundPosition: j("position", "0 0"),
    backgroundRepeat: j("repeat", "repeat"),
  };
  if (plane.mask) {
    const m = (k: keyof Layer, d: string) => plane.mask!.map((l) => l[k] ?? d).join(", ");
    s.maskImage = m("image", "none");
    s.maskSize = m("size", "auto");
    s.maskPosition = m("position", "0 0");
    s.maskRepeat = m("repeat", "repeat");
    s.maskComposite = plane.compose ?? "add";
  }
  if (plane.opacity != null) s.opacity = plane.opacity;
  return s;
}
