"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { comet } from "@/components/viz/comet";
import { Chevron, StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "@/components/figures/basics/kit";

// every call fib(5) makes, as a tree, in the order java makes them. the live call stack is the
// path from the root to the current node. call counts match a real run on jdk 25:
// naive fib(5) = 15 calls, memoized = 9 (cache hits counted as calls).
// drawn on the dot grid: calls are dotted runs, the frames on the stack are hot, the top
// frame is the bigger lit one. stepping a call sends a comet down to the new frame; stepping
// a return sends the value back up the same run, to the caller.

type N = { id: number; n: number; kids: N[]; depth: number; x: number; cached?: boolean };
type Ev = { kind: "call" | "return"; id: number; value?: number; cached?: boolean };

function build(n: number, memo: boolean) {
  let id = 0;
  let leaf = 0;
  const seen = new Set<number>();
  const events: Ev[] = [];
  const nodes: N[] = [];
  const value = (k: number): number => (k < 2 ? k : value(k - 1) + value(k - 2));
  const go = (k: number, depth: number): N => {
    const node: N = { id: id++, n: k, kids: [], depth, x: 0 };
    nodes.push(node);
    events.push({ kind: "call", id: node.id });
    if (k >= 2 && memo && seen.has(k)) {
      node.cached = true;
      node.x = leaf++;
      events.push({ kind: "return", id: node.id, value: value(k), cached: true });
      return node;
    }
    if (k < 2) {
      node.x = leaf++;
    } else {
      node.kids.push(go(k - 1, depth + 1));
      node.kids.push(go(k - 2, depth + 1));
      node.x = (node.kids[0].x + node.kids[1].x) / 2;
      if (memo) seen.add(k);
    }
    events.push({ kind: "return", id: node.id, value: value(k) });
    return node;
  };
  const root = go(n, 0);
  return { root, nodes, events, leaves: leaf };
}

export function FibTree() {
  const [memo, setMemo] = useState(false);
  const t = useMemo(() => build(5, memo), [memo]);
  return (
    <div className="font-mono text-13">
      <Row k="fib =" last>
        <Words
          options={[
            { v: "naive", label: "naive" },
            { v: "memo", label: "with a cache" },
          ]}
          value={memo ? "memo" : "naive"}
          onChange={(v) => setMemo(v === "memo")}
          label="version"
        />
      </Row>
      <Walk key={String(memo)} {...t} memo={memo} />
    </div>
  );
}

function Walk({ nodes, events, leaves, memo }: { nodes: N[]; events: Ev[]; leaves: number; memo: boolean }) {
  // step i shows the state after events[0..i]
  const s = useStepper(events.length + 1, { interval: 650 });
  const done = events.slice(0, s.i);
  const state = new Map<number, "active" | "done">();
  const vals = new Map<number, number>();
  for (const e of done) {
    if (e.kind === "call") state.set(e.id, "active");
    else {
      state.set(e.id, "done");
      vals.set(e.id, e.value!);
    }
  }
  const stack = nodes.filter((nd) => state.get(nd.id) === "active");
  const calls = done.filter((e) => e.kind === "call").length;
  const hits = done.filter((e) => e.kind === "return" && e.cached).length;
  const last = done[done.length - 1];
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));

  const W = 46;
  const H = 52;
  const width = leaves * W;
  const height = (Math.max(...nodes.map((nd) => nd.depth)) + 1) * H;
  const px = (nd: N) => nd.x * W + W / 2;
  const py = (nd: N) => nd.depth * H + 18;

  // a comet down the edge on a call, back up it on a return
  const svgRef = useRef<SVGSVGElement>(null);
  const host = useRef<SVGGElement>(null);
  const lastI = useRef(s.i);
  useEffect(() => {
    const prev = lastI.current;
    lastI.current = s.i;
    if (s.i !== prev + 1 || !last || !svgRef.current || !host.current) return;
    const el = svgRef.current.querySelector<SVGPathElement>(`path[data-kid="${last.id}"]`);
    if (!el) return;
    return comet(el, host.current, { colour: "var(--hot)", r: 3.4, ms: 380, back: last.kind === "return" });
  }, [s.i, last]);

  const edgeDots = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.round(len / 6));
    return Array.from({ length: n + 1 }, (_, k) => [x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n] as const);
  };

  return (
    <div {...s.keys} className="mt-4 outline-none">
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ maxWidth: width, minWidth: Math.min(width, 320) }}
          className="jle-dots mx-auto block"
          role="img"
          aria-label={`the call tree of fib(5)${memo ? " with a cache" : ""}`}
        >
          {nodes.map((nd) =>
            nd.kids.map((k) => {
              const on = state.get(k.id) === "active";
              const called = state.has(k.id);
              const x1 = px(nd);
              const y1 = py(nd) + 12;
              const x2 = px(k);
              const y2 = py(k) - 12;
              return (
                <g key={`${nd.id}-${k.id}`}>
                  <path data-kid={k.id} d={`M ${x1} ${y1} L ${x2} ${y2}`} fill="none" stroke="none" />
                  <g className={on ? "lit" : undefined}>
                    {edgeDots(x1, y1, x2, y2).map(([x, y], j) => (
                      <circle
                        key={j}
                        cx={x}
                        cy={y}
                        r={on ? 1.7 : 1.3}
                        style={{ fill: on ? "var(--hot)" : called ? "var(--edge)" : "var(--grid)", transition: "fill 300ms" }}
                      />
                    ))}
                  </g>
                </g>
              );
            }),
          )}
          {nodes.map((nd) => {
            const st = state.get(nd.id);
            const top = stack[stack.length - 1]?.id === nd.id;
            // on the stack = hot. the top frame is filled and a touch bigger. returned = neutral.
            // came from the cache = meta (machinery). not called yet = an unlit ring.
            const fill = top ? "var(--hot)" : st === "active" ? "var(--well)" : st === "done" ? "var(--well)" : "var(--well)";
            const stroke = top || st === "active" ? "var(--hot)" : st === "done" ? (nd.cached ? "var(--meta)" : "var(--dot)") : "var(--grid)";
            const w = top ? 42 : 38;
            const h = top ? 25 : 22;
            return (
              <g key={nd.id} opacity={st ? 1 : 0.6} className={top ? "lit" : undefined}>
                <rect
                  x={px(nd) - w / 2}
                  y={py(nd) - h / 2}
                  width={w}
                  height={h}
                  rx={h / 2}
                  style={{ fill, stroke, strokeWidth: st === "active" && !top ? 1.5 : 1.2, transition: "fill 300ms, stroke 300ms" }}
                  strokeDasharray={nd.cached ? "2 2.5" : undefined}
                />
                <text
                  x={px(nd)}
                  y={py(nd) + 4}
                  textAnchor="middle"
                  fontSize={11}
                  style={{ fill: top ? "var(--well)" : st ? "var(--hi)" : "var(--faint)", stroke: "none", fontWeight: top ? 600 : 400 }}
                >
                  f({nd.n})
                </text>
                {vals.has(nd.id) && (
                  <text x={px(nd) + 22} y={py(nd) - 9} fontSize={10.5} style={{ fill: nd.cached ? "var(--meta)" : "var(--mute)" }}>
                    {vals.get(nd.id)}
                  </text>
                )}
              </g>
            );
          })}
          <g ref={host} className="lit" aria-hidden />
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-1 font-ui text-12 text-faint">call stack right now, bottom to top</div>
          <div className="flex min-h-[26px] flex-wrap items-center gap-1 text-12">
            <span className="text-faint">main</span>
            {stack.map((nd, i) => (
              <span key={nd.id} className="flex items-center gap-1">
                <span className="text-faint">
                  <Chevron size={10} />
                </span>
                <span className={i === stack.length - 1 ? "text-hot" : "text-ink"}>fib({nd.n})</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-5 text-12 tabular sm:text-right">
          <span>
            <span className="text-faint">calls </span>
            <span className="text-hi">{calls}</span>
            <span className="text-faint">/{memo ? 9 : 15}</span>
          </span>
          {memo && (
            <span>
              <span className="text-faint">cache hits </span>
              <span style={{ color: "var(--meta)" }}>{hits}</span>
            </span>
          )}
          <span>
            <span className="text-faint">depth </span>
            <span className="text-hi">{stack.length}</span>
          </span>
        </div>
      </div>
      <p className="mt-3 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {!last
          ? `press step. ${memo ? "this version remembers every answer it has already computed." : "each call to fib(n) makes two more calls, until n is 0 or 1."}`
          : last.kind === "call"
            ? `fib(${byId.get(last.id)!.n}) is called and pushed on the stack.${byId.get(last.id)!.n < 2 ? " n < 2: a base case, it returns n straight away." : ""}`
            : last.cached
              ? `fib(${byId.get(last.id)!.n}) was already computed, so it comes straight from the cache: ${last.value}. no subtree this time.`
              : `fib(${byId.get(last.id)!.n}) returns ${last.value} and its frame is popped.${byId.get(last.id)!.id === 0 ? ` that's the answer, after ${calls} calls.` : ""}`}
      </p>
      <StepControls s={s} className="mt-1" />
    </div>
  );
}
