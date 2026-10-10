"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { useState } from "react";
import { Heads, Legend, Readout, Row, Words, useWidth } from "./kit";

// tri-color marking while the app keeps running, and the lost object problem.
// white = not seen yet, grey = seen but fields not scanned, black = done.
// the app does two things at the worst possible moment:
//   A.x = B.next   (a black object now points at a white one)
//   B.next = null  (the last grey → white path disappears)
// with no barrier, C gets freed while A still points at it. a barrier fixes it,
// either by greying the new target (incremental update) or by logging the old value (SATB).

type Mode = "none" | "satb" | "iu";
type Color = "white" | "grey" | "black" | "freed";
type Id = "A" | "B" | "C" | "D";

type Step = {
  actor: "gc" | "app";
  colors: Record<Id, Color>;
  edges: { bc: "on" | "gone" | "cut"; ac: "off" | "new" | "on" };
  queue: string[];
  hot?: Id;
  note: string;
};

const W0: Record<Id, Color> = { A: "white", B: "white", C: "white", D: "white" };

function script(mode: Mode): Step[] {
  const s: Step[] = [];
  s.push({
    actor: "gc",
    colors: { ...W0 },
    edges: { bc: "on", ac: "off" },
    queue: [],
    note: "concurrent marking starts, and the app keeps running alongside it. every object starts white: not seen yet.",
  });
  s.push({
    actor: "gc",
    colors: { ...W0, A: "grey" },
    edges: { bc: "on", ac: "off" },
    queue: [],
    hot: "A",
    note: "a short pause scans the roots. A is reachable, so it turns grey: seen, but its fields haven't been scanned.",
  });
  s.push({
    actor: "gc",
    colors: { A: "black", B: "grey", C: "white", D: "grey" },
    edges: { bc: "on", ac: "off" },
    queue: [],
    hot: "A",
    note: "the GC scans A: B and D turn grey, and A turns black. black means done. the GC will never look at A again.",
  });
  s.push({
    actor: "gc",
    colors: { A: "black", B: "grey", C: "white", D: "black" },
    edges: { bc: "on", ac: "off" },
    queue: [],
    hot: "D",
    note: "scan D. no fields, so it's black. B is still waiting its turn.",
  });
  const c4: Color = mode === "iu" ? "grey" : "white";
  s.push({
    actor: "app",
    colors: { A: "black", B: "grey", C: c4, D: "black" },
    edges: { bc: "on", ac: "new" },
    queue: [],
    hot: "A",
    note:
      mode === "iu"
        ? "the app runs A.x = B.next. a black object now points at a white one, but the incremental-update barrier on that store greys C right away."
        : "the app runs A.x = B.next. black A now points at white C. the GC already finished with A, so it won't see this new arrow.",
  });
  const c5: Color = mode === "none" ? "white" : "grey";
  s.push({
    actor: "app",
    colors: { A: "black", B: "grey", C: c5, D: "black" },
    edges: { bc: "cut", ac: "on" },
    queue: mode === "satb" ? ["C"] : [],
    hot: "B",
    note:
      mode === "satb"
        ? "then B.next = null. the SATB barrier runs before the store and logs the old value, C, into the SATB queue. anything in the queue counts as live this cycle."
        : mode === "iu"
          ? "then B.next = null. C is already grey thanks to the earlier barrier, so this doesn't matter."
          : "then B.next = null. that was the only path from a grey object to C. nobody notices.",
  });
  s.push({
    actor: "gc",
    colors: { A: "black", B: "black", C: c5, D: "black" },
    edges: { bc: "gone", ac: "on" },
    queue: mode === "satb" ? ["C"] : [],
    hot: "B",
    note: "the GC scans B. its only field is null now, so B turns black with nothing to grey.",
  });
  s.push({
    actor: "gc",
    colors: { A: "black", B: "black", C: mode === "none" ? "white" : "black", D: "black" },
    edges: { bc: "gone", ac: "on" },
    queue: [],
    hot: mode === "none" ? undefined : "C",
    note:
      mode === "none"
        ? "no grey objects left, so marking is done. C is still white."
        : mode === "satb"
          ? "the GC drains the SATB queue: C gets scanned and turns black."
          : "the GC scans C, grey since the barrier: black.",
  });
  s.push({
    actor: "gc",
    colors: { A: "black", B: "black", C: mode === "none" ? "freed" : "black", D: "black" },
    edges: { bc: "gone", ac: "on" },
    queue: [],
    note:
      mode === "none"
        ? "white means garbage, so C's memory is freed. but A.x still points at it. the app now holds a pointer into reclaimed memory. that's the lost object problem, and it's why a concurrent collector can't exist without barriers."
        : mode === "satb"
          ? "C survives. SATB (snapshot at the beginning) keeps everything that was reachable when marking started, plus anything new. G1 and Shenandoah mark this way."
          : "C survives. incremental update re-greys whatever a black object starts pointing at. the old CMS collector used a variant of it.",
  });
  return s;
}

const NODE_W = 46;
const NODE_H = 34;

const nodeStyle = (c: Color, hot: boolean) => {
  switch (c) {
    case "white":
      return { stroke: hot ? "var(--hot)" : "var(--line-2)", fill: "var(--bg)", text: "var(--ink)", dash: undefined };
    case "grey":
      return { stroke: "var(--hot)", fill: "color-mix(in srgb, var(--hot) 14%, var(--bg))", text: "var(--hot)", dash: "4 2" };
    case "black":
      return { stroke: "var(--live)", fill: "color-mix(in srgb, var(--live) 16%, var(--bg))", text: "var(--live)", dash: undefined };
    case "freed":
      return { stroke: "var(--dead)", fill: "color-mix(in srgb, var(--dead) 10%, var(--bg))", text: "var(--dead)", dash: "3 2" };
  }
};

const WORD: Record<Color, string> = { white: "white", grey: "grey", black: "black", freed: "freed!" };

export function TriColor() {
  const [mode, setMode] = useState<Mode>("none");
  const steps = script(mode);
  const s = useStepper(steps.length, { interval: 2200 });
  const st = steps[s.i];
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const H = 258;
  const pos: Record<Id | "root", { x: number; y: number }> = {
    root: { x: 4, y: 22 },
    A: { x: W * 0.3, y: 22 },
    B: { x: W * 0.1, y: 112 },
    D: { x: W * 0.48, y: 112 },
    C: { x: W * 0.24, y: 204 },
  };
  const ctr = (id: Id) => ({ x: pos[id].x + NODE_W / 2, y: pos[id].y + NODE_H / 2 });
  const qx = W * 0.68;
  const qw = W - qx - 2;

  const edge = (from: Id, to: Id) => {
    const a = ctr(from);
    const b = ctr(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    // leave/enter at the box border
    const t1 = Math.min(NODE_W / 2 / Math.abs(ux || 1e-6), NODE_H / 2 / Math.abs(uy || 1e-6));
    const t2 = t1 + 3;
    return `M ${a.x + ux * t1} ${a.y + uy * t1} L ${b.x - ux * t2} ${b.y - uy * t2}`;
  };

  const a = ctr("A");
  const c = ctr("C");
  const acPath = edge("A", "C");

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="tri-color marking step-through">
      <Row k="barrier" last>
        <Words
          options={[
            { v: "none", label: "none" },
            { v: "satb", label: "SATB" },
            { v: "iu", label: "incremental update" },
          ] as const}
          value={mode}
          onChange={setMode}
          label="write barrier"
        />
      </Row>

      <div ref={ref} className="relative min-w-0">
        <div className="mb-1 flex items-center gap-2 text-11">
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
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label={`objects: ${(Object.keys(st.colors) as Id[]).map((k) => `${k} ${st.colors[k]}`).join(", ")}`}>
          <Heads id="tc" tones={["ref", "hot", "dead"]} />

          {/* root */}
          <rect x={pos.root.x} y={pos.root.y + 8} width={44} height={18} rx={3} fill="var(--bg)" stroke="var(--ref)" />
          <text x={pos.root.x + 22} y={pos.root.y + 21} textAnchor="middle" fontSize={10} fill="var(--ref)">
            root
          </text>
          <path d={`M ${pos.root.x + 44} ${pos.root.y + 17} L ${pos.A.x - 3} ${pos.A.y + NODE_H / 2}`} stroke="var(--ref)" strokeWidth={1.3} markerEnd="url(#tc-ref)" />

          {/* references */}
          <path d={edge("A", "B")} stroke="var(--ref)" strokeWidth={1.3} markerEnd="url(#tc-ref)" />
          <path d={edge("A", "D")} stroke="var(--ref)" strokeWidth={1.3} markerEnd="url(#tc-ref)" />
          {st.edges.bc !== "gone" && (
            <path
              d={edge("B", "C")}
              stroke={st.edges.bc === "cut" ? "var(--hot)" : "var(--ref)"}
              strokeWidth={1.3}
              strokeDasharray={st.edges.bc === "cut" ? "3 3" : undefined}
              opacity={st.edges.bc === "cut" ? 0.7 : 1}
              markerEnd={`url(#tc-${st.edges.bc === "cut" ? "hot" : "ref"})`}
            />
          )}
          {st.edges.bc === "cut" && (
            <text x={pos.B.x} y={pos.C.y + NODE_H + 16} fontSize={10} fill="var(--hot)">
              B.next = null
            </text>
          )}
          {st.edges.ac !== "off" && (
            <>
              <path
                d={acPath}
                fill="none"
                stroke={st.colors.C === "freed" ? "var(--dead)" : st.edges.ac === "new" ? "var(--hot)" : "var(--ref)"}
                strokeWidth={1.5}
                markerEnd={`url(#tc-${st.colors.C === "freed" ? "dead" : st.edges.ac === "new" ? "hot" : "ref"})`}
              />
              <text x={(a.x + c.x) / 2 + 8} y={(a.y + c.y) / 2 + 4} fontSize={10} fill={st.edges.ac === "new" ? "var(--hot)" : "var(--faint)"}>
                A.x
              </text>
            </>
          )}

          {/* nodes */}
          {(["A", "B", "C", "D"] as Id[]).map((id) => {
            const ns = nodeStyle(st.colors[id], st.hot === id);
            return (
              <g key={id} transform={`translate(${pos[id].x}, ${pos[id].y})`}>
                <rect width={NODE_W} height={NODE_H} rx={4} fill={ns.fill} stroke={ns.stroke} strokeWidth={st.hot === id ? 1.8 : 1.3} strokeDasharray={ns.dash} style={{ transition: "fill 200ms, stroke 200ms" }} />
                <text x={NODE_W / 2} y={15} textAnchor="middle" fontSize={12} fill={ns.text}>
                  {id}
                </text>
                <text x={NODE_W / 2} y={28} textAnchor="middle" fontSize={9} fill={ns.text} opacity={0.85}>
                  {WORD[st.colors[id]]}
                </text>
              </g>
            );
          })}

          {/* the SATB queue: GC machinery */}
          {mode === "satb" && (
            <g transform={`translate(${qx}, 104)`}>
              <text x={0} y={-6} fontSize={10} fill="var(--meta)">
                SATB queue
              </text>
              <rect width={qw} height={30} rx={4} fill="none" stroke="var(--meta)" strokeDasharray="3 3" />
              {st.queue.map((q, i) => (
                <g key={q} transform={`translate(${6 + i * 30}, 5)`}>
                  <rect width={24} height={20} rx={3} fill="color-mix(in srgb, var(--meta) 14%, var(--bg))" stroke="var(--meta)" />
                  <text x={12} y={14} textAnchor="middle" fontSize={11} fill="var(--meta)">
                    {q}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>

      <Readout minLines={4}>{st.note}</Readout>
      <Legend
        items={[
          ["mute", "white: not seen"],
          ["hot", "grey: seen, fields pending"],
          ["live", "black: scanned"],
          ["dead", "freed"],
          ["meta", "barrier machinery"],
        ]}
      />
      <StepControls s={s} />
    </div>
  );
}
