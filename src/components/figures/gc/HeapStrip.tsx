"use client";

import type { CSSProperties } from "react";
import type { ObjState, ObjView, View } from "./heap";
import { Heads } from "./kit";

// draws one View from heap.ts: roots on top, the heap as a row of cells, references as
// arcs underneath. the layout is fixed per figure (lanes, pointer row, arc depth) so the
// height never jumps between frames. objects slide (css transform) when their address changes.

const STRIP_H = 30;
const LANE_H = 18;
const RULER_H = 13;
const PTR_H = 16;

type Style = { stroke: string; fill: string; text: string; dash?: string };

const STYLES: Record<ObjState, Style> = {
  plain: { stroke: "var(--line-2)", fill: "var(--well-2)", text: "var(--ink)" },
  grey: { stroke: "var(--hot)", fill: "transparent", text: "var(--hot)", dash: "3 2" },
  hot: { stroke: "var(--hot)", fill: "color-mix(in srgb, var(--hot) 22%, transparent)", text: "var(--hot)" },
  live: { stroke: "var(--live)", fill: "color-mix(in srgb, var(--live) 12%, transparent)", text: "var(--live)" },
  dead: { stroke: "var(--dead)", fill: "color-mix(in srgb, var(--dead) 10%, transparent)", text: "var(--dead)", dash: "3 2" },
  fwd: { stroke: "var(--meta)", fill: "transparent", text: "var(--meta)", dash: "2 2" },
  new: { stroke: "var(--hot)", fill: "color-mix(in srgb, var(--hot) 22%, transparent)", text: "var(--hot)" },
};

export type StripLayout = {
  cells: number;
  /** how many root lanes to reserve above the strip */
  rootSlots: number;
  /** reserve a row for scan/free/sweep pointers */
  ptrRow?: boolean;
  /** depth of the reference arcs area under the strip */
  arcDepth?: number;
  /** extra room above for a floating allocation */
  ghostRoom?: boolean;
};

export function stripHeight(l: StripLayout) {
  const lanes = Math.max(l.rootSlots * LANE_H + 8, l.ghostRoom ? 34 : 8);
  return lanes + STRIP_H + RULER_H + (l.ptrRow ? PTR_H : 0) + (l.arcDepth ?? 54) + 4;
}

export function HeapStrip({
  view,
  layout,
  width,
  id,
  label,
}: {
  view: View;
  layout: StripLayout;
  width: number;
  /** unique prefix for svg marker ids */
  id: string;
  label?: string;
}) {
  const { cells, rootSlots, ptrRow, arcDepth = 54, ghostRoom } = layout;
  const W = Math.max(200, width);
  const cw = W / cells;
  const lanesH = Math.max(rootSlots * LANE_H + 8, ghostRoom ? 34 : 8);
  const sy = lanesH;
  const rulerY = sy + STRIP_H;
  const ptrY = rulerY + RULER_H;
  const arcY = ptrY + (ptrRow ? PTR_H : 0);
  const H = stripHeight(layout);
  const x = (addr: number) => addr * cw;
  const byId = new Map(view.objs.map((o) => [o.id, o]));
  const center = (o: ObjView) => x(o.addr) + (o.size * cw) / 2;
  const every = cw >= 22 ? 1 : cw >= 12 ? 2 : 5;
  // x positions where reference arcs leave or enter the strip
  const stubs: number[] = [];
  for (const o of view.objs) {
    if (o.state === "fwd") continue;
    o.refs.forEach((t, k) => {
      const to = byId.get(t);
      if (!to) return;
      stubs.push(center(o) + (k - (o.refs.length - 1) / 2) * Math.min(8, cw * 0.3), center(to) + 2);
    });
  }

  // roots: the chip for the rightmost target sits in the top lane, so lines never cross
  const roots = [...view.roots]
    .map((r) => ({ ...r, t: r.to ? byId.get(r.to) : undefined }))
    .sort((a, b) => (b.t ? center(b.t) : -1) - (a.t ? center(a.t) : -1));

  return (
    <div className="min-w-0">
      {(label ?? view.label) && <div className="mb-1 text-11 text-faint">{label ?? view.label}</div>}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block overflow-visible"
        style={{ fontFamily: "var(--font-code)" }}
        role="img"
        aria-label={describe(view)}
      >
        <Heads id={id} tones={["ref", "meta"]} />

        {/* empty cells */}
        {Array.from({ length: cells }, (_, i) => (
          <rect
            key={`c${i}`}
            x={x(i) + 0.5}
            y={sy + 0.5}
            width={cw - 1}
            height={STRIP_H - 1}
            rx={1.5}
            fill="var(--bg)"
            stroke="var(--line-2)"
            strokeOpacity={0.6}
          />
        ))}

        {/* free list runs: GC machinery */}
        {view.free?.map(([a, n]) => (
          <g key={`f${a}`}>
            <rect
              x={x(a) + 1.5}
              y={sy + 1.5}
              width={n * cw - 3}
              height={STRIP_H - 3}
              rx={1.5}
              fill="color-mix(in srgb, var(--meta) 8%, transparent)"
              stroke="var(--meta)"
              strokeDasharray="2 3"
            />
            {n * cw > 34 && (
              <text x={x(a) + (n * cw) / 2} y={sy + 19} textAnchor="middle" fontSize={10} fill="var(--meta)">
                free {n}
              </text>
            )}
          </g>
        ))}

        {/* ruler. labels step aside where a reference stub passes */}
        {Array.from({ length: cells + 1 }, (_, i) =>
          i % every === 0 && !stubs.some((sx) => sx > x(i) - 4 && sx < x(i) + (i > 9 ? 15 : 9)) ? (
            <text key={`r${i}`} x={x(i) + 1} y={rulerY + 10} fontSize={9} fill="var(--faint)" className="tabular">
              {i}
            </text>
          ) : null,
        )}

        {/* references between objects: arcs under the strip */}
        {view.objs.map((o) =>
          o.refs.map((t, k) => {
            const to = byId.get(t);
            if (!to || o.state === "fwd") return null;
            const n = o.refs.length;
            const x1 = center(o) + (k - (n - 1) / 2) * Math.min(8, cw * 0.3);
            const x2 = center(to) + 2;
            const depth = Math.min(arcDepth - 8, 12 + Math.abs(x2 - x1) * 0.28);
            const deadSrc = o.state === "dead";
            return (
              <path
                key={`${o.id}-${t}-${k}`}
                d={`M ${x1} ${sy + STRIP_H} L ${x1} ${arcY} C ${x1} ${arcY + depth}, ${x2} ${arcY + depth}, ${x2} ${arcY} L ${x2} ${sy + STRIP_H + 2}`}
                fill="none"
                stroke="var(--ref)"
                strokeWidth={1.2}
                strokeDasharray={deadSrc ? "3 3" : undefined}
                opacity={deadSrc ? 0.4 : 0.9}
                markerEnd={`url(#${id}-ref)`}
                className="transition-opacity duration-200"
              />
            );
          }),
        )}

        {/* roots */}
        {roots.map((r, i) => {
          const y = 4 + i * LANE_H;
          const w = r.label.length * 6.6 + 12;
          const t = r.t;
          const tx = t ? center(t) : 0;
          const path = !t
            ? null
            : tx > w + 6
              ? `M ${w} ${y + 7} L ${tx} ${y + 7} L ${tx} ${sy - 1}`
              : `M ${tx} ${y + 14} L ${tx} ${sy - 1}`;
          return (
            <g key={r.id}>
              <rect x={0.5} y={y + 0.5} width={w} height={14} rx={2} fill="var(--bg)" stroke="var(--ref)" />
              <text x={6} y={y + 11} fontSize={10} fill="var(--ref)">
                {r.label}
              </text>
              {path && (
                <path d={path} fill="none" stroke="var(--ref)" strokeWidth={1.2} markerEnd={`url(#${id}-ref)`} />
              )}
            </g>
          );
        })}

        {/* objects */}
        {view.objs.map((o) => {
          const st = STYLES[o.state];
          const w = o.size * cw;
          const style: CSSProperties = {
            transform: `translate(${x(o.addr)}px, ${sy}px)`,
            transition: "transform 450ms cubic-bezier(0.2,0,0,1)",
          };
          const showFwd = o.fwd !== undefined;
          return (
            <g key={o.id} style={style}>
              <rect x={2} y={3} width={w - 4} height={STRIP_H - 6} rx={2} fill="var(--bg)" />
              <rect
                x={2}
                y={3}
                width={w - 4}
                height={STRIP_H - 6}
                rx={2}
                fill={st.fill}
                stroke={st.stroke}
                strokeWidth={o.state === "hot" || o.state === "new" ? 1.6 : 1.2}
                strokeDasharray={st.dash}
                style={{ transition: "fill 200ms, stroke 200ms" }}
              />
              <text
                x={w / 2}
                y={showFwd ? 14 : 19}
                textAnchor="middle"
                fontSize={o.id.length > 2 ? 9 : 12}
                fill={st.text}
              >
                {o.id === "new" ? "new" : o.id}
              </text>
              {showFwd && (
                <text x={w / 2} y={25} textAnchor="middle" fontSize={9} fill="var(--meta)">
                  →{o.fwd}
                </text>
              )}
            </g>
          );
        })}

        {/* pointers: scan, free, sweep, top */}
        {ptrRow &&
          view.ptrs?.map((p, i) => {
            const px = Math.min(W - 2, x(p.at));
            const right = px > W - 50;
            return (
              <g key={p.label} style={{ transform: `translate(${px}px, ${ptrY}px)`, transition: "transform 300ms cubic-bezier(0.2,0,0,1)" }}>
                <path d="M 0 0 L -4 7 L 4 7 z" fill="var(--meta)" />
                <text x={right ? -6 : 6} y={i % 2 ? 15 : 8} textAnchor={right ? "end" : "start"} fontSize={10} fill="var(--meta)">
                  {p.label}
                </text>
              </g>
            );
          })}

        {/* an allocation request, floating above */}
        {view.ghost && (
          <g transform={`translate(${W - view.ghost.size * cw - 2}, 4)`}>
            <rect
              width={view.ghost.size * cw}
              height={STRIP_H - 6}
              rx={2}
              fill="none"
              stroke={view.ghost.ok ? "var(--live)" : "var(--dead)"}
              strokeDasharray="4 3"
            />
            <text x={(view.ghost.size * cw) / 2} y={16} textAnchor="middle" fontSize={10} fill={view.ghost.ok ? "var(--live)" : "var(--dead)"}>
              new({view.ghost.size}) {view.ghost.ok ? "fits" : "✗"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function describe(v: View) {
  const live = v.objs.filter((o) => o.state === "live").map((o) => o.id);
  const dead = v.objs.filter((o) => o.state === "dead").map((o) => o.id);
  return `heap with ${v.objs.length} objects${live.length ? `, marked live: ${live.join(" ")}` : ""}${dead.length ? `, garbage: ${dead.join(" ")}` : ""}`;
}
