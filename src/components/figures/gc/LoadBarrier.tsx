"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Heads, Legend, Readout, useWidth } from "./kit";

// ZGC moving an object while the app runs, and the load barrier that makes it safe.
// the object's old copy is never needed again after it's copied: ZGC keeps the
// "where did it go" information in a per-page forwarding table, off to the side.

type Step = {
  actor: "app" | "gc";
  ptr: { page: "A" | "B"; good: boolean };
  copied: boolean;
  fwdHot?: boolean;
  check?: "bad" | "good";
  freedA?: boolean;
  note: string;
};

const STEPS: Step[] = [
  { actor: "app", ptr: { page: "A", good: true }, copied: false, note: "X lives on page A. order.item points at it, and the pointer's color says it's good." },
  {
    actor: "gc",
    ptr: { page: "A", good: false },
    copied: false,
    note: "relocate start, a pause of a few microseconds: page A is picked for relocation and the GC flips which color counts as good. order.item wasn't touched, but it's stale now. so is every other pointer in the heap. that's the trick: invalidate everything without writing anything.",
  },
  {
    actor: "gc",
    ptr: { page: "A", good: false },
    copied: true,
    fwdHot: true,
    note: "GC threads copy page A's live objects to page B while the app keeps running. X becomes X', and the move goes into page A's forwarding table, outside the object.",
  },
  {
    actor: "app",
    ptr: { page: "A", good: false },
    copied: true,
    check: "bad",
    note: "the app runs var item = order.item. before the value is used, the load barrier tests its color: stale. slow path.",
  },
  {
    actor: "app",
    ptr: { page: "A", good: false },
    copied: true,
    check: "bad",
    fwdHot: true,
    note: "slow path: page A is being relocated, so look X up in its forwarding table. it's X' on page B now. (if the GC hadn't got to X yet, this app thread would copy it itself, right here.)",
  },
  {
    actor: "app",
    ptr: { page: "B", good: true },
    copied: true,
    check: "good",
    note: "self-healing: write the fixed pointer (page B, good color) back into order.item, then hand X' to the app. only this first load paid for the trip.",
  },
  {
    actor: "app",
    ptr: { page: "B", good: true },
    copied: true,
    check: "good",
    note: "the next load of order.item: good color, fast path. a test and a branch.",
  },
  {
    actor: "gc",
    ptr: { page: "B", good: true },
    copied: true,
    freedA: true,
    note: "as soon as everything live is out, page A's memory is reused. the forwarding table stays around until the next marking cycle has fixed up any stale pointers still left in the heap.",
  },
];

export function LoadBarrier() {
  const s = useStepper(STEPS.length, { interval: 2400 });
  const st = STEPS[s.i];
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const H = 196;
  const bw = W * 0.3;
  const gap = (W - bw * 3) / 2;
  const cx = [0, bw + gap, 2 * (bw + gap)];
  const top = 26;
  const ph = 84;
  const X = { x: cx[1] + 10, y: top + 34 };
  const X2 = { x: cx[2] + 10, y: top + 34 };
  const objW = Math.min(64, bw - 20);
  const ptrTone = st.ptr.good ? "var(--live)" : "var(--dead)";
  const target = st.ptr.page === "A" ? X : X2;
  const fieldY = top + 52;
  const narrow = W < 520;

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="load barrier step-through">
      <div className="flex items-center gap-2 text-11">
        <span
          className="rounded-xs px-1.5 py-0.5"
          style={{
            color: st.actor === "gc" ? "var(--meta)" : "var(--hot)",
            boxShadow: `inset 0 0 0 1px ${st.actor === "gc" ? "var(--meta)" : "var(--hot)"}`,
          }}
        >
          {st.actor === "gc" ? "GC thread" : "app thread"}
        </span>
        <span className="text-faint">is running this step</span>
      </div>
      <div ref={ref} className="min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label={`order.item points at page ${st.ptr.page}, color ${st.ptr.good ? "good" : "stale"}`}>
          <Heads id="lb" tones={["ref", "meta"]} />
          {/* order object */}
          <text x={cx[0]} y={top - 8} fontSize={10} fill="var(--faint)">
            {narrow ? "order" : "order (page C)"}
          </text>
          <rect x={cx[0]} y={top} width={bw} height={ph} rx={5} fill="var(--well-2)" stroke="var(--line-2)" />
          <text x={cx[0] + 8} y={top + 20} fontSize={11} fill="var(--ink)">
            order
          </text>
          <rect x={cx[0] + 8} y={fieldY - 14} width={bw - 16} height={22} rx={3} fill="var(--bg)" stroke={ptrTone} />
          <text x={cx[0] + 14} y={fieldY + 1} fontSize={10} fill="var(--ink)">
            {narrow ? "" : "item: "}
            <tspan fill="var(--ref)">{st.ptr.page}</tspan>
            <tspan fill={ptrTone}> {st.ptr.good ? "good" : "stale"}</tspan>
          </text>

          {/* pages */}
          {[1, 2].map((i) => (
            <g key={i}>
              <text x={cx[i]} y={top - 8} fontSize={10} fill="var(--faint)">
                {i === 1 ? (st.freedA ? (narrow ? "A (free)" : "page A (free again)") : narrow ? "page A" : "page A, relocating") : "page B"}
              </text>
              <rect
                x={cx[i]}
                y={top}
                width={bw}
                height={ph}
                rx={5}
                fill={i === 1 && st.freedA ? "var(--bg)" : "var(--well-2)"}
                stroke={i === 1 && s.i > 0 && !st.freedA ? "var(--hot)" : "var(--line-2)"}
                strokeDasharray={i === 1 && st.freedA ? "4 3" : undefined}
              />
            </g>
          ))}
          {!st.freedA && (
            <g>
              <rect x={X.x} y={X.y} width={objW} height={24} rx={3} fill="var(--bg)" stroke={st.copied ? "var(--line-2)" : "var(--live)"} strokeDasharray={st.copied ? "3 2" : undefined} />
              <text x={X.x + objW / 2} y={X.y + 16} textAnchor="middle" fontSize={11} fill={st.copied ? "var(--faint)" : "var(--live)"}>
                X
              </text>
            </g>
          )}
          {st.copied && (
            <g>
              <rect x={X2.x} y={X2.y} width={objW} height={24} rx={3} fill="color-mix(in srgb, var(--live) 12%, var(--bg))" stroke="var(--live)" />
              <text x={X2.x + objW / 2} y={X2.y + 16} textAnchor="middle" fontSize={11} fill="var(--live)">
                X&apos;
              </text>
            </g>
          )}

          {/* the reference held in order.item */}
          <path
            d={`M ${cx[0] + bw - 8} ${fieldY - 3} C ${cx[0] + bw + 20} ${fieldY - 3}, ${target.x - 24} ${target.y + 12}, ${target.x - 3} ${target.y + 12}`}
            fill="none"
            stroke="var(--ref)"
            strokeWidth={1.3}
            strokeDasharray={st.ptr.good ? undefined : "4 3"}
            markerEnd="url(#lb-ref)"
          />

          {/* forwarding table */}
          {st.copied && (
            <g>
              <rect x={cx[1]} y={top + ph + 16} width={bw} height={44} rx={5} fill={st.fwdHot ? "color-mix(in srgb, var(--meta) 14%, var(--bg))" : "var(--bg)"} stroke="var(--meta)" />
              <text x={cx[1] + 8} y={top + ph + 32} fontSize={10} fill="var(--meta)">
                {narrow ? "forwarding" : "forwarding table, A"}
              </text>
              <text x={cx[1] + 8} y={top + ph + 49} fontSize={10} fill="var(--ink)">
                X → B: X&apos;
              </text>
            </g>
          )}

          {/* the barrier's verdict */}
          {st.check && (
            <g>
              <rect x={cx[0]} y={top + ph + 16} width={bw} height={44} rx={5} fill="var(--bg)" stroke={st.check === "good" ? "var(--live)" : "var(--dead)"} />
              <text x={cx[0] + 8} y={top + ph + 32} fontSize={10} fill="var(--hot)">
                load barrier
              </text>
              <text x={cx[0] + 8} y={top + ph + 49} fontSize={10} fill={st.check === "good" ? "var(--live)" : "var(--dead)"}>
                {st.check === "good" ? (narrow ? "fast path" : "good: fast path") : narrow ? "slow path" : "stale: slow path"}
              </text>
            </g>
          )}
        </svg>
      </div>
      <Readout minLines={3}>{st.note}</Readout>
      <Legend
        items={[
          ["ref", "the pointer in order.item"],
          ["live", "the live object / a good color"],
          ["dead", "a stale color"],
          ["meta", "GC bookkeeping"],
        ]}
      />
      <StepControls s={s} />
    </div>
  );
}
