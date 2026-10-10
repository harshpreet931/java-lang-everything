"use client";

import { useMemo, useState } from "react";
import { useWidth } from "../meta/kit";
import { FLAME, type FlameNode } from "./flame.data";

// an interactive flame graph of a real JFR recording (see flame.data.ts). width = samples,
// bottom = the thread's entry point, top = where the CPU actually was. click to zoom.

type N = FlameNode & { id: string; parent?: N; kids: N[] };

function build(n: FlameNode, parent: N | undefined, id: string): N {
  const node: N = { ...n, id, parent, kids: [] };
  node.kids = (n.c ?? []).map((c, i) => build(c, node, `${id}.${i}`));
  return node;
}

const ROW = 19;
const TOTAL = FLAME.v;

export function FlameGraph() {
  const root = useMemo(() => build(FLAME, undefined, "0"), []);
  const [focusId, setFocusId] = useState("0");
  const [hover, setHover] = useState<N | null>(null);
  const [mine, setMine] = useState(true);
  const [box, W] = useWidth<HTMLDivElement>(640);

  const byId = useMemo(() => {
    const m = new Map<string, N>();
    const walk = (n: N) => (m.set(n.id, n), n.kids.forEach(walk));
    walk(root);
    return m;
  }, [root]);
  const focus = byId.get(focusId) ?? root;

  const ancestors: N[] = [];
  for (let a = focus.parent; a; a = a.parent) ancestors.unshift(a);

  const rects: { n: N; x: number; w: number; depth: number; ghost?: boolean }[] = [];
  ancestors.forEach((a, d) => rects.push({ n: a, x: 0, w: W, depth: d, ghost: true }));
  const lay = (n: N, x: number, w: number, depth: number) => {
    rects.push({ n, x, w, depth });
    let cx = x;
    for (const k of n.kids) {
      const kw = (k.v / n.v) * w;
      if (kw >= 0.5) lay(k, cx, kw, depth + 1);
      cx += kw;
    }
  };
  lay(focus, 0, W, ancestors.length);
  const maxDepth = Math.max(...rects.map((r) => r.depth)) + 1;
  const H = maxDepth * ROW;

  const info = hover ?? focus;
  const pct = (v: number) => `${((v / TOTAL) * 100).toFixed(1)}%`;

  return (
    <div className="@container">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-12">
        <button className="act" onClick={() => setFocusId("0")} disabled={focusId === "0"}>
          reset zoom
        </button>
        <button className="word" aria-pressed={mine} onClick={() => setMine(!mine)}>
          highlight Shop.* frames
        </button>
      </div>
      <div ref={box} className="relative overflow-hidden" style={{ height: H }} role="img" aria-label="flame graph of CPU samples; formatReport takes over half the width">
        {rects.map(({ n, x, w, depth, ghost }) => {
          const app = !n.j && n.n !== "all";
          const isHover = hover?.id === n.id;
          return (
            <button
              key={n.id + (ghost ? "g" : "")}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => setFocusId(n.id)}
              title={`${n.n}: ${n.v} samples (${pct(n.v)})`}
              className="absolute overflow-hidden rounded-[2px] px-1 text-left text-[10.5px] leading-[17px] whitespace-nowrap text-ink transition-[background-color,box-shadow] duration-100"
              style={{
                left: Math.round(x * 100) / 100,
                width: Math.max(0, Math.round((w - 1) * 100) / 100),
                bottom: depth * ROW,
                height: ROW - 2,
                background: app && mine ? "color-mix(in srgb, var(--hot) 26%, var(--well))" : "var(--well-2)",
                boxShadow: isHover ? "inset 0 0 0 1px var(--hi)" : "inset 0 0 0 1px var(--line-2)",
                opacity: ghost ? 0.55 : 1,
              }}
            >
              {w > 34 ? n.n : ""}
            </button>
          );
        })}
      </div>
      <div className="mt-3 min-h-[3.2em] rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div className="break-words text-hi">{info.n}</div>
        <div className="text-mute tabular">
          {info.v.toLocaleString("en-US")} samples · {pct(info.v)} of all
          {focus.id !== "0" && ` · ${((info.v / focus.v) * 100).toFixed(1)}% of ${focus.n}`}
          {info.kids.length > 0 && (() => {
            const self = info.v - info.kids.reduce((s, k) => s + k.v, 0);
            return self > 0 ? ` · ${self} in frames too small to draw or in itself` : "";
          })()}
        </div>
      </div>
    </div>
  );
}
