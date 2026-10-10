"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Heads, Legend, Readout, useWidth } from "./kit";

// Shenandoah's concurrent evacuation. since java 13 the forwarding pointer lives in the
// old copy's mark word (no extra word per object), and every reference load goes through a
// load reference barrier (LRB) that follows it. the GC and app threads can race to copy the
// same object: both copy, both CAS the forwarding pointer, one copy wins.

type Obj = { header: "normal" | "fwd" | "none"; show: boolean; hot?: boolean; dim?: boolean };
type Step = {
  actor: "app" | "gc" | "both";
  x: Obj;
  x2: Obj;
  y: Obj;
  y2a: Obj;
  y2b: Obj;
  field: "X" | "X'";
  lrb?: string;
  note: string;
};

const hid: Obj = { header: "none", show: false };
const norm: Obj = { header: "normal", show: true };

const STEPS: Step[] = [
  {
    actor: "gc",
    x: norm,
    x2: hid,
    y: norm,
    y2a: hid,
    y2b: hid,
    field: "X",
    note: "the region on the left is in the collection set: its live objects are about to move. X and Y have normal headers. the app's field points at X.",
  },
  {
    actor: "gc",
    x: { header: "fwd", show: true },
    x2: { header: "normal", show: true, hot: true },
    y: norm,
    y2a: hid,
    y2b: hid,
    field: "X",
    note: "a GC thread copies X into a free region, then uses a CAS to swap X's mark word for a forwarding pointer: \"I live at X' now\". no extra word per object is needed, the old copy's header is free real estate.",
  },
  {
    actor: "app",
    x: { header: "fwd", show: true, hot: true },
    x2: norm,
    y: norm,
    y2a: hid,
    y2b: hid,
    field: "X",
    lrb: "in cset? yes. forwarded? yes → X'",
    note: "the app loads the field and gets X. the load reference barrier checks: is X in the collection set? yes. is its header a forwarding pointer? yes. so the app gets X', never the stale copy.",
  },
  {
    actor: "app",
    x: { header: "fwd", show: true },
    x2: norm,
    y: norm,
    y2a: hid,
    y2b: hid,
    field: "X'",
    lrb: "heal the field → X'",
    note: "and the barrier writes X' back into the field it was loaded from, so the next load skips the lookup.",
  },
  {
    actor: "both",
    x: { header: "fwd", show: true, dim: true },
    x2: norm,
    y: { header: "normal", show: true, hot: true },
    y2a: { header: "normal", show: true },
    y2b: { header: "normal", show: true },
    field: "X'",
    lrb: "Y not forwarded yet → copy it",
    note: "now a race. the app loads a reference to Y before the GC got to it, so the barrier evacuates Y itself, at the same moment a GC thread does. two copies exist for an instant.",
  },
  {
    actor: "both",
    x: { header: "fwd", show: true, dim: true },
    x2: norm,
    y: { header: "fwd", show: true },
    y2a: { header: "normal", show: true, hot: true },
    y2b: { header: "normal", show: true, dim: true },
    field: "X'",
    lrb: "CAS lost → use the winner's copy",
    note: "both try to CAS their copy's address into Y's header. exactly one CAS wins. the loser throws its copy away (it was only a bump in a thread-local buffer) and uses the winner's. no locks, and everyone agrees on one Y'.",
  },
  {
    actor: "gc",
    x: { header: "fwd", show: true, dim: true },
    x2: norm,
    y: { header: "fwd", show: true, dim: true },
    y2a: norm,
    y2b: hid,
    field: "X'",
    note: "update references: GC threads walk the heap and rewrite every remaining pointer to an old copy, concurrently. then the collection set's regions are freed in one go.",
  },
];

export function ForwardingPtr() {
  const s = useStepper(STEPS.length, { interval: 2500 });
  const st = STEPS[s.i];
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const narrow = W < 520;
  const H = 210;
  const rw = W * 0.44;
  const fromX = 0;
  const toX = W - rw;
  const top = 22;
  const rh = 128;
  const ow = Math.min(120, rw - 24);
  const pos = {
    x: { x: fromX + 12, y: top + 14 },
    y: { x: fromX + 12, y: top + 70 },
    x2: { x: toX + 12, y: top + 14 },
    y2a: { x: toX + 12, y: top + 70 },
    y2b: { x: toX + rw - ow * 0.55 - 12, y: top + 70 },
  };

  const box = (o: Obj, p: { x: number; y: number }, name: string, small = false) => {
    if (!o.show) return null;
    const bw = small ? ow * 0.55 : ow;
    const stroke = o.hot ? "var(--hot)" : o.header === "fwd" ? "var(--line-2)" : "var(--live)";
    return (
      <g opacity={o.dim ? 0.45 : 1} style={{ transition: "opacity 200ms" }}>
        <rect x={p.x} y={p.y} width={bw} height={44} rx={4} fill="var(--bg)" stroke={stroke} strokeWidth={o.hot ? 1.6 : 1.2} />
        <rect
          x={p.x + 4}
          y={p.y + 4}
          width={bw - 8}
          height={16}
          rx={2}
          fill={o.header === "fwd" ? "color-mix(in srgb, var(--meta) 16%, var(--bg))" : "var(--well-2)"}
          stroke={o.header === "fwd" ? "var(--meta)" : "var(--line)"}
        />
        <text x={p.x + 8} y={p.y + 15} fontSize={9} fill={o.header === "fwd" ? "var(--meta)" : "var(--faint)"}>
          {o.header === "fwd" ? `→ ${name}'` : "header"}
        </text>
        <text x={p.x + 8} y={p.y + 36} fontSize={11} fill={o.header === "fwd" ? "var(--faint)" : "var(--live)"}>
          {name}
        </text>
      </g>
    );
  };

  const target = st.field === "X" ? pos.x : pos.x2;

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="Shenandoah evacuation step-through">
      <div className="flex items-center gap-2 text-11">
        {(st.actor === "both" ? (["gc", "app"] as const) : [st.actor]).map((a) => (
          <span
            key={a}
            className="rounded-xs px-1.5 py-0.5"
            style={{ color: a === "gc" ? "var(--meta)" : "var(--hot)", boxShadow: `inset 0 0 0 1px ${a === "gc" ? "var(--meta)" : "var(--hot)"}` }}
          >
            {a === "gc" ? "GC thread" : "app thread"}
          </span>
        ))}
        <span className="text-faint">{st.actor === "both" ? "are both running" : "is running this step"}</span>
      </div>
      <div ref={ref} className="min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label={`the field points at ${st.field}`}>
          <Heads id="fp" tones={["ref"]} />
          <text x={fromX} y={top - 8} fontSize={10} fill="var(--faint)">
            {narrow ? "collection set" : "region in the collection set"}
          </text>
          <rect x={fromX} y={top} width={rw} height={rh} rx={6} fill="var(--well-2)" stroke="var(--hot)" strokeDasharray="4 3" />
          <text x={toX} y={top - 8} fontSize={10} fill="var(--faint)">
            {narrow ? "free region" : "a free region (to-space)"}
          </text>
          <rect x={toX} y={top} width={rw} height={rh} rx={6} fill="var(--well-2)" stroke="var(--line-2)" />
          {box(st.x, pos.x, "X")}
          {box(st.y, pos.y, "Y")}
          {box(st.x2, pos.x2, "X'")}
          {box(st.y2a, pos.y2a, "Y'", !!st.y2b.show)}
          {box(st.y2b, pos.y2b, "Y'", true)}

          {/* the app's field */}
          <g transform={`translate(${W / 2 - 46}, ${top + rh + 22})`}>
            <rect width={92} height={22} rx={3} fill="var(--bg)" stroke="var(--ref)" />
            <text x={8} y={15} fontSize={10} fill="var(--ink)">
              field → <tspan fill="var(--ref)">{st.field}</tspan>
            </text>
          </g>
          <path
            d={
              st.field === "X"
                ? `M ${W / 2} ${top + rh + 22} C ${W / 2} ${target.y + 22}, ${target.x + ow + 40} ${target.y + 22}, ${target.x + ow + 3} ${target.y + 22}`
                : `M ${W / 2} ${top + rh + 22} C ${W / 2} ${target.y + 22}, ${target.x - 40} ${target.y + 22}, ${target.x - 3} ${target.y + 22}`
            }
            fill="none"
            stroke="var(--ref)"
            strokeWidth={1.3}
            markerEnd="url(#fp-ref)"
          />
          {st.lrb && (
            <text x={W / 2 + 56} y={top + rh + 37} fontSize={10} fill="var(--hot)">
              {narrow ? "LRB" : `LRB: ${st.lrb}`}
            </text>
          )}
        </svg>
      </div>
      <Readout minLines={3}>
        {st.lrb && narrow ? <span className="text-hot">LRB: {st.lrb}. </span> : null}
        {st.note}
      </Readout>
      <Legend
        items={[
          ["live", "an object"],
          ["meta", "a forwarding pointer in the old header"],
          ["hot", "what this step touches"],
          ["ref", "the app's reference"],
        ]}
      />
      <StepControls s={s} />
    </div>
  );
}
