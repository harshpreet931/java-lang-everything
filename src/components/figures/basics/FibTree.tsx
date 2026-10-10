"use client";

import { useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "@/components/figures/basics/kit";

// every call fib(5) makes, as a tree, in the order java makes them. the live call stack is the
// path from the root to the current node. call counts match a real run on jdk 25:
// naive fib(5) = 15 calls, memoized = 9 (cache hits counted as calls).

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

  return (
    <div {...s.keys} className="mt-4 outline-none">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ maxWidth: width, minWidth: Math.min(width, 320) }}
          className="mx-auto block"
          fontFamily="var(--font-code), monospace"
          role="img"
          aria-label={`the call tree of fib(5)${memo ? " with a cache" : ""}`}
        >
          {nodes.map((nd) =>
            nd.kids.map((k) => (
              <line
                key={`${nd.id}-${k.id}`}
                x1={px(nd)}
                y1={py(nd) + 11}
                x2={px(k)}
                y2={py(k) - 11}
                stroke={state.get(k.id) === "active" ? "var(--hot)" : "var(--line-2)"}
                strokeWidth={state.get(k.id) === "active" ? 1.5 : 1}
              />
            )),
          )}
          {nodes.map((nd) => {
            const st = state.get(nd.id);
            const top = stack[stack.length - 1]?.id === nd.id;
            const stroke = top ? "var(--hot)" : st === "active" ? "var(--hot)" : st === "done" ? (nd.cached ? "var(--meta)" : "var(--line-2)") : "var(--line)";
            return (
              <g key={nd.id} opacity={st ? 1 : 0.35}>
                <rect x={px(nd) - 19} y={py(nd) - 11} width={38} height={22} rx={4} fill={top ? "color-mix(in srgb, var(--hot) 16%, var(--well))" : "var(--well)"} stroke={stroke} strokeDasharray={nd.cached ? "3 2" : undefined} />
                <text x={px(nd)} y={py(nd) + 4} textAnchor="middle" fontSize={11} fill={st ? "var(--hi)" : "var(--faint)"}>
                  f({nd.n})
                </text>
                {vals.has(nd.id) && (
                  <text x={px(nd) + 22} y={py(nd) - 8} fontSize={10} fill={nd.cached ? "var(--meta)" : "var(--mute)"}>
                    {vals.get(nd.id)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-1 text-11 text-faint">call stack right now (bottom → top)</div>
          <div className="flex min-h-[26px] flex-wrap items-center gap-1 text-12">
            <span className="text-faint">main</span>
            {stack.map((nd, i) => (
              <span key={nd.id} className="flex items-center gap-1">
                <span className="text-faint">→</span>
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
