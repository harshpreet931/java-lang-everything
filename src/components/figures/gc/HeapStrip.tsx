"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { comet } from "@/components/viz/comet";
import type { ObjState, ObjView, View } from "./heap";
import { Heads } from "./kit";

// draws one View from heap.ts: roots on top, the heap as a strip of memory drawn in dots,
// references as dotted arcs underneath. the unlit grid dots are free address space; an
// object is a block of dots with a meta header column. marking turns its dots live in a
// wave, sweeping drains them to rings (garbage keeps its outline until the space is reused).
// when the marker reaches an object, a comet runs down the reference it followed.
// the layout is fixed per figure (lanes, pointer row, arc depth) so the height never jumps
// between frames. objects slide (css transform) when their address changes.

const STRIP_H = 42;
/** dot pitch inside the strip, and the three dot rows under the label */
const DP = 8;
const ROWS = [21, 29, 37];
const LANE_H = 18;
const RULER_H = 13;
const PTR_H = 16;

type Style = { tone: string; ring?: boolean; dim?: boolean; text: string; big?: boolean };

// each state is a tone and a shape: grey waits on the mark stack (hot, faint), hot is
// being scanned (hot, bigger), live is marked, dead is a ring, fwd is a forwarding stub.
const STYLES: Record<ObjState, Style> = {
  plain: { tone: "var(--dot)", text: "var(--ink)" },
  grey: { tone: "var(--hot)", dim: true, text: "var(--hot)" },
  hot: { tone: "var(--hot)", text: "var(--hot)", big: true },
  live: { tone: "var(--live)", text: "var(--live)" },
  dead: { tone: "var(--dead)", ring: true, text: "var(--dead)" },
  fwd: { tone: "var(--meta)", ring: true, dim: true, text: "var(--meta)" },
  new: { tone: "var(--hot)", text: "var(--hot)", big: true },
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

  // the marker reaching an object follows a reference: run a comet down every live
  // reference (or root) into an object the moment it turns hot
  const svgRef = useRef<SVGSVGElement>(null);
  const host = useRef<SVGGElement>(null);
  const hotNow = view.objs.filter((o) => o.state === "hot").map((o) => o.id).join(",");
  const lastHot = useRef<string | null>(null);
  useEffect(() => {
    const before = lastHot.current;
    lastHot.current = hotNow;
    if (before === null || !hotNow || before === hotNow || !svgRef.current || !host.current) return;
    const stops: (() => void)[] = [];
    for (const idh of hotNow.split(",")) {
      if (before.split(",").includes(idh)) continue;
      svgRef.current.querySelectorAll<SVGPathElement>(`path[data-to="${CSS.escape(idh)}"]`).forEach((el) => {
        const from = el.dataset.from;
        const src = from === "root" ? null : byId.get(from ?? "");
        if (src && src.state !== "live" && src.state !== "hot") return;
        stops.push(comet(el, host.current!, { r: 3.2, ms: 520 }));
      });
    }
    return () => stops.forEach((f) => f());
    // byId is derived from view; hotNow is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotNow]);

  return (
    <div className="min-w-0">
      {(label ?? view.label) && <div className="mb-1 text-11 text-faint">{label ?? view.label}</div>}
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block overflow-visible"
        style={{ fontFamily: "var(--font-code)" }}
        role="img"
        aria-label={describe(view)}
      >
        <Heads id={id} tones={["ref", "meta"]} />

        {/* the address space: unlit grid dots under the whole strip */}
        <g className="g-grid">
          {Array.from({ length: Math.floor(W / DP) }, (_, i) =>
            ROWS.map((ry) => <circle key={`g${i}-${ry}`} cx={i * DP + DP / 2} cy={sy + ry} r={0.95} fill="var(--grid)" />),
          )}
        </g>
        {/* cell boundaries: a faint tick per word of memory */}
        {Array.from({ length: cells + 1 }, (_, i) => (
          <line key={`t${i}`} x1={x(i)} x2={x(i)} y1={sy + 15} y2={sy + STRIP_H - 1} stroke="var(--line)" strokeWidth={1} />
        ))}

        {/* free list runs: GC machinery */}
        {view.free?.map(([a, n]) => (
          <g key={`f${a}`}>
            <rect x={x(a) + 1.5} y={sy + 14} width={n * cw - 3} height={STRIP_H - 15} rx={4} fill="var(--well)" />
            {Array.from({ length: Math.max(1, Math.floor((n * cw - 6) / DP)) }, (_, i) =>
              ROWS.map((ry) => <circle key={`${i}-${ry}`} cx={x(a) + 4 + i * DP + DP / 2} cy={sy + ry} r={1.6} fill="var(--meta)" opacity={0.75} />),
            )}
            {n * cw > 34 && (
              <text x={x(a) + (n * cw) / 2} y={sy + 10} textAnchor="middle" fontSize={10} fill="var(--meta)">
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
                data-from={o.id}
                data-to={t}
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
                <path d={path} data-from="root" data-to={r.to ?? ""} fill="none" stroke="var(--ref)" strokeWidth={1.2} markerEnd={`url(#${id}-ref)`} />
              )}
            </g>
          );
        })}

        {/* objects: a block of dots with a meta header column */}
        {view.objs.map((o) => {
          const st = STYLES[o.state];
          const w = o.size * cw;
          const style: CSSProperties = {
            transform: `translate(${x(o.addr)}px, ${sy}px)`,
            transition: "transform 450ms cubic-bezier(0.2,0,0,1)",
          };
          const showFwd = o.fwd !== undefined;
          const n = Math.max(2, Math.floor((w - 6) / DP));
          const x0 = (w - n * DP) / 2 + DP / 2;
          return (
            <g key={o.id} style={style}>
              <rect x={1.5} y={13} width={w - 3} height={STRIP_H - 14} rx={4} fill="var(--well)" />
              <g className="lit">
                {Array.from({ length: n }, (_, c) =>
                  ROWS.map((ry, r) => {
                    const head = c === 0;
                    const tone = head && o.state !== "dead" && o.state !== "fwd" ? "var(--meta)" : st.tone;
                    const rr = st.big && !head ? 2.75 : 2.45;
                    return (
                      <circle
                        key={`${c}-${r}`}
                        cx={x0 + c * DP}
                        cy={ry}
                        r={st.ring ? 2.2 : rr}
                        style={{
                          fill: tone,
                          stroke: tone,
                          strokeWidth: st.ring ? 1.1 : 0,
                          fillOpacity: st.ring ? 0 : 1,
                          opacity: (st.dim ? 0.42 : 1) * (0.82 + (((c * 7 + r * 3 + o.addr) % 5) * 0.045)),
                          transition: "fill 300ms, stroke 300ms, fill-opacity 300ms, opacity 300ms, r 200ms",
                          transitionDelay: `${c * 32}ms`,
                        }}
                      />
                    );
                  }),
                )}
              </g>
              <text x={4} y={10} fontSize={o.id.length > 2 ? 9.5 : 11.5} fontWeight={500} fill={st.text} style={{ transition: "fill 300ms" }}>
                {o.id === "new" ? "new" : o.id}
                {showFwd && <tspan fill="var(--meta)" fontWeight={400}>{` to ${o.fwd}`}</tspan>}
              </text>
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
              new({view.ghost.size}) {view.ghost.ok ? "fits" : "doesn't fit"}
            </text>
          </g>
        )}
        <g ref={host} className="lit" aria-hidden />
      </svg>
    </div>
  );
}

function describe(v: View) {
  const live = v.objs.filter((o) => o.state === "live").map((o) => o.id);
  const dead = v.objs.filter((o) => o.state === "dead").map((o) => o.id);
  return `heap with ${v.objs.length} objects${live.length ? `, marked live: ${live.join(" ")}` : ""}${dead.length ? `, garbage: ${dead.join(" ")}` : ""}`;
}
