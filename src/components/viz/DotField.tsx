"use client";

import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { at, rng, tv, type DotTone, type Field } from "./dots";

export { dotField, at, tv, walk, type Field, type Dot, type DotTone, type Tone, type Pt } from "./dots";

// a field of dots: the instrument every flagship figure is drawn on.
//
// the server renders the first frame (every dot, its tone, its shape), so there is
// never a blank canvas. the reader changes `look` (per group) and the dots move to
// the new state with css transitions; `wave` staggers that change along each
// group's order, so it travels. `comets` run a bright head along a path when their
// key changes: a reference being followed. comets need js and motion; with reduced
// motion they are skipped and the state change alone carries the step.

export type Look = {
  /** recolour the group (live after marking, hot while looked at) */
  tone?: DotTone;
  /** "ring" drains the fill and keeps the outline: garbage, removed */
  kind?: "fill" | "ring";
  /** pushed back, context only */
  dim?: boolean;
  /** not there (yet, or any more). keeps its place in the grid */
  off?: boolean;
  /** ms between consecutive dots of the group when this look arrives (a wave) */
  wave?: number;
  /** run the wave from the last dot back to the first */
  back?: boolean;
  /** ms before the change starts (e.g. until a comet lands) */
  delay?: number;
};

export type Comet = {
  /** a path id from the field */
  path: string;
  /** change it to fire the comet again */
  k: string | number;
  tone?: DotTone;
  /** total travel time; default scales with the path length */
  ms?: number;
  /** travel the path backwards */
  back?: boolean;
};

type Props = {
  field: Field;
  /** svg units per cell */
  pitch?: number;
  look?: Record<string, Look | undefined>;
  comets?: Comet[];
  /** comets hop cell to cell like a dot-matrix display (default), or glide */
  glide?: boolean;
  /** draw the unlit address space */
  grid?: boolean | ((x: number, y: number) => boolean);
  seed?: number;
  label: string;
  className?: string;
  style?: CSSProperties;
  /** svg drawn under the dots (cards, bands) */
  under?: ReactNode;
  /** svg drawn over the dots (labels) */
  children?: ReactNode;
  /** extra room around the field, in svg units: [top, right, bottom, left] */
  pad?: readonly [number, number, number, number];
};

const R = { fill: 0.28, hot: 0.32, small: 0.17, end: 0.27, ring: 0.27 } as const;

export function DotField({
  field,
  pitch: p = 12,
  look = {},
  comets = [],
  glide,
  grid = true,
  seed = 7,
  label,
  className = "",
  style,
  under,
  children,
  pad = [0, 0, 0, 0],
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glowId = `glow-${uid}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const cometRef = useRef<SVGGElement>(null);

  // per-dot brightness, seeded so the server and the client agree
  const ops = useMemo(() => {
    const r = rng(seed);
    return field.dots.map(() => (0.8 + r() * 0.2).toFixed(2));
  }, [field, seed]);

  const sizes = useMemo(() => {
    const n: Record<string, number> = {};
    for (const d of field.dots) n[d.g] = Math.max(n[d.g] ?? 0, d.i + 1);
    return n;
  }, [field]);

  const gridDots = useMemo(() => {
    if (!grid) return null;
    const lit = new Set(field.dots.map((d) => `${d.x},${d.y}`));
    const out: ReactNode[] = [];
    for (let y = 0; y < field.rows; y++)
      for (let x = 0; x < field.cols; x++) {
        if (lit.has(`${x},${y}`)) continue;
        if (typeof grid === "function" && !grid(x, y)) continue;
        out.push(<circle key={`${x},${y}`} cx={at(x, p)} cy={at(y, p)} r={p * 0.09} />);
      }
    return out;
  }, [field, grid, p]);

  /* ---- comets ---------------------------------------------------------------- */
  const lastKeys = useRef<Map<string, string | number> | null>(null);
  const running = useRef(new Map<string, number>());
  const visible = useRef(true);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    const runs = running.current;
    return () => {
      io.disconnect();
      runs.forEach((id) => cancelAnimationFrame(id));
    };
  }, []);

  useEffect(() => {
    const prev = lastKeys.current;
    const next = new Map(comets.map((c) => [c.path + (c.back ? "<" : ">"), c.k] as const));
    lastKeys.current = next;
    if (!prev) return; // the first frame is static: no comet on load
    const host = cometRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const c of comets) {
      const id = c.path + (c.back ? "<" : ">");
      if (prev.get(id) === c.k) continue;
      const cells = field.paths[c.path];
      if (!cells?.length) continue;
      const old = running.current.get(id);
      if (old) cancelAnimationFrame(old);
      host.querySelectorAll(`[data-c="${CSS.escape(id)}"]`).forEach((n) => n.remove());
      if (reduce || !visible.current || document.hidden) continue;
      const pts = c.back ? [...cells].reverse() : cells;
      const n = pts.length;
      const ms = c.ms ?? Math.min(1100, Math.max(320, n * 34));
      const colour = tv(c.tone ?? "ref");
      const NS = "http://www.w3.org/2000/svg";
      const tail = 4;
      const nodes = Array.from({ length: tail + 1 }, (_, k) => {
        const e = document.createElementNS(NS, "circle");
        e.setAttribute("r", String(p * (k === 0 ? 0.4 : 0.3 - k * 0.04)));
        e.setAttribute("fill", colour);
        e.setAttribute("data-c", id);
        e.style.opacity = "0";
        host.appendChild(e);
        return e;
      });
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const pos = t * (n - 1);
        nodes.forEach((e, k) => {
          const q = pos - k * (glide ? 0.9 : 1);
          if (q < 0) {
            e.style.opacity = "0";
            return;
          }
          let x: number, y: number;
          if (glide) {
            const a = Math.floor(q);
            const b = Math.min(n - 1, a + 1);
            const f = q - a;
            x = at(pts[a][0] + (pts[b][0] - pts[a][0]) * f, p);
            y = at(pts[a][1] + (pts[b][1] - pts[a][1]) * f, p);
          } else {
            const a = Math.round(q);
            x = at(pts[a][0], p);
            y = at(pts[a][1], p);
          }
          e.setAttribute("cx", x.toFixed(1));
          e.setAttribute("cy", y.toFixed(1));
          e.style.opacity = String((k === 0 ? 1 : 0.62 - k * 0.13) * (t === 1 ? 0 : 1));
        });
        if (t < 1) running.current.set(id, requestAnimationFrame(frame));
        else {
          running.current.delete(id);
          nodes.forEach((e) => e.remove());
        }
      };
      running.current.set(id, requestAnimationFrame(frame));
    }
  }, [comets, field, p, glide]);

  /* ---- render ------------------------------------------------------------------ */
  const [pt, pr, pb, pl] = pad;
  const W = field.cols * p;
  const H = field.rows * p;
  const sw = p * 0.09;

  return (
    <svg
      ref={svgRef}
      className={`jle-dots ${className}`}
      viewBox={`${-pl} ${-pt} ${W + pl + pr} ${H + pt + pb}`}
      role="img"
      aria-label={label}
      style={{ ["--jle-glow" as string]: `url(#${glowId})`, ...style } as CSSProperties}
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b" />
          <feComponentTransfer in="b" result="b2">
            <feFuncA type="linear" slope="0.85" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {under}
      {gridDots && <g className="g-grid">{gridDots}</g>}
      <g className="lit">
        {field.dots.map((d, n) => {
          const l = look[d.g];
          const tone = l?.tone && d.tone !== "meta" ? l.tone : d.tone;
          const ring = l?.kind ? l.kind === "ring" : d.kind === "ring";
          const base = d.kind === "small" ? R.small : d.kind === "end" ? R.end : tone === "hot" ? R.hot : R.fill;
          const r = ring ? p * R.ring - sw / 2 : p * base - (d.kind === "small" ? 0 : sw / 2);
          const order = l?.back ? (sizes[d.g] ?? 1) - 1 - d.i : d.i;
          const cls = `d${ring ? " ring" : ""}${l?.off ? " off" : ""}${l?.dim ? " dim" : ""}`;
          return (
            <circle
              key={`${d.x},${d.y}`}
              className={cls}
              cx={at(d.x, p)}
              cy={at(d.y, p)}
              r={r.toFixed(2)}
              strokeWidth={d.kind === "small" ? 0 : sw.toFixed(2)}
              style={
                {
                  "--c": tv(tone),
                  "--o": ops[n],
                  "--dl": l?.wave || l?.delay ? `${(l.delay ?? 0) + order * (l.wave ?? 0)}ms` : undefined,
                } as CSSProperties
              }
            />
          );
        })}
      </g>
      <g ref={cometRef} className="comet lit" aria-hidden />
      {children}
    </svg>
  );
}

/** the five shapes, for under a figure. pass only the ones the figure uses. */
export function DotLegend({ items }: { items: { k: "ref" | "live" | "dead" | "meta" | "hot" | "dot"; label: ReactNode }[] }) {
  return (
    <div className="jle-legend" aria-hidden>
      {items.map((it) => (
        <span key={String(it.k) + String(it.label)}>
          <i className={it.k === "dead" ? "ring" : it.k} style={{ ["--c" as string]: tv(it.k) } as CSSProperties} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
