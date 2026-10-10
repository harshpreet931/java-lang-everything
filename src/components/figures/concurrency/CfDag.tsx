"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "./ui";

// a CompletableFuture graph, stage by stage: what completes when, with what value,
// and on which thread. dependent stages without "Async" run on whichever thread
// completed the stage they depend on. failures flow down the edges until something handles them.

type Id = "A" | "B" | "C" | "D" | "E" | "X" | "J";
type Status = "pending" | "running" | "waiting" | "done" | "failed" | "skipped";
type NodeSt = { s: Status; v?: string; th?: string };
type Snap = { nodes: Record<Id, NodeSt>; note: string; hot?: Id[] };

const NODES: { id: Id; code: string; row: number; col: number }[] = [
  { id: "A", code: "supplyAsync(fetchUser)", row: 0, col: 0 },
  { id: "B", code: "supplyAsync(fetchPrice)", row: 0, col: 2 },
  { id: "D", code: ".thenCompose(fetchOrders)", row: 1, col: 0 },
  { id: "C", code: ".thenApply(User::name)", row: 1, col: 1 },
  { id: "E", code: ".thenCombine(price, render)", row: 2, col: 2 },
  { id: "X", code: ".exceptionally(fallback)", row: 3, col: 2 },
  { id: "J", code: "allOf(orders, page).join()", row: 4, col: 1 },
];
const EDGES: [Id, Id][] = [
  ["A", "D"],
  ["A", "C"],
  ["C", "E"],
  ["B", "E"],
  ["E", "X"],
  ["D", "J"],
  ["X", "J"],
];

const W1 = "worker-1";
const W2 = "worker-2";
const W3 = "worker-3";

function build(fail: boolean, handle: boolean): Snap[] {
  const n = (o: Partial<Record<Id, NodeSt>>, prev?: Record<Id, NodeSt>): Record<Id, NodeSt> => ({
    ...(prev ?? {
      A: { s: "pending" },
      B: { s: "pending" },
      C: { s: "pending" },
      D: { s: "pending" },
      E: { s: "pending" },
      X: { s: "pending" },
      J: { s: "pending" },
    }),
    ...o,
  });
  const steps: Snap[] = [];
  let cur = n({});
  const push = (o: Partial<Record<Id, NodeSt>>, note: string, hot?: Id[]) => {
    cur = n(o, cur);
    steps.push({ nodes: cur, note, hot });
  };
  push({}, "main builds the whole graph first. building it is instant: nothing has run yet, each box is a future that will complete later.");
  push(
    { A: { s: "running", th: W1 }, B: { s: "running", th: W2 } },
    "the two supplyAsync calls hand their lambdas to the common ForkJoinPool. fetchUser and fetchPrice run at the same time, on two pool threads.",
    ["A", "B"],
  );
  push(
    { A: { s: "done", v: "User(ada)", th: W1 }, C: { s: "done", v: '"ada"', th: W1 } },
    "fetchUser finishes on worker-1. thenApply isn't Async, so worker-1 runs User::name itself, right after, before going back to the pool.",
    ["A", "C"],
  );
  push(
    { D: { s: "waiting", th: W1 } },
    "thenCompose calls fetchOrders(user), which returns another future (now running on worker-3). D completes when that inner future does. no future of a future.",
    ["D"],
  );
  if (!fail) {
    push(
      { B: { s: "done", v: "42.00", th: W2 }, E: { s: "done", v: "Page(ada, 42.00)", th: W2 } },
      "fetchPrice finishes on worker-2. thenCombine needed both inputs; the name was already there, so whoever completes the last input (worker-2) runs render.",
      ["B", "E"],
    );
    push({ X: { s: "done", v: "Page(ada, 42.00)", th: W2 } }, "exceptionally only runs on failure. on success the value just passes through untouched.", ["X"]);
  } else {
    push(
      { B: { s: "failed", v: "IOException", th: W2 } },
      "fetchPrice throws. the future B completes exceptionally: the exception is stored in it, nothing is printed, nothing crashes.",
      ["B"],
    );
    push(
      { E: { s: "skipped", v: "CompletionException" } },
      "thenCombine never calls render: one input failed, so E fails too, with the IOException wrapped in a CompletionException.",
      ["E"],
    );
    if (handle) {
      push(
        { X: { s: "done", v: "Page(ada, no price)", th: W2 } },
        "exceptionally catches it and turns it back into a normal value: a page without a price. everything downstream sees success.",
        ["X"],
      );
    } else {
      push(
        { X: { s: "skipped", v: "CompletionException" } },
        "with no exceptionally (or handle), the failure keeps flowing down the edges to everything that depends on it.",
        ["X"],
      );
    }
  }
  push(
    { D: { s: "done", v: "[3 orders]", th: W3 } },
    "the inner fetchOrders future completes on worker-3, and D completes with it, on that same thread.",
    ["D"],
  );
  const ok = !fail || handle;
  push(
    { J: ok ? { s: "done", v: "both done", th: "main" } : { s: "failed", v: "throws CompletionException", th: "main" } },
    ok
      ? "allOf completes once both inputs are done, and main's join() returns. total time: the slowest branch, not the sum."
      : "allOf completes exceptionally, so join() throws CompletionException in main. the IOException is its cause.",
    ["J"],
  );
  return steps;
}

// let long stage names wrap after "(" and "," instead of mid-word
function Code({ text }: { text: string }) {
  const parts = text.split(/(?<=[(,])/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <wbr />}
        </span>
      ))}
    </>
  );
}

const TONE: Record<Status, string> = {
  pending: "var(--line-2)",
  running: "var(--hot)",
  waiting: "var(--hot)",
  done: "var(--live)",
  failed: "var(--dead)",
  skipped: "var(--dead)",
};

export function CfDag() {
  const [fail, setFail] = useState(false);
  const [handle, setHandle] = useState(true);
  const steps = useMemo(() => build(fail, handle), [fail, handle]);
  const s = useStepper(steps.length, { interval: 2200 });
  const snap = steps[Math.min(s.i, steps.length - 1)];
  const box = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; k: string; from: Id; to: Id }[]>([]);
  const id = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const rb = el.getBoundingClientRect();
      const out: { d: string; k: string; from: Id; to: Id }[] = [];
      for (const [a, b] of EDGES) {
        const na = el.querySelector<HTMLElement>(`[data-n="${a}"]`);
        const nb = el.querySelector<HTMLElement>(`[data-n="${b}"]`);
        if (!na || !nb) continue;
        const ra = na.getBoundingClientRect();
        const rbb = nb.getBoundingClientRect();
        const x1 = ra.left + ra.width / 2 - rb.left;
        const y1 = ra.bottom - rb.top;
        const x2 = rbb.left + rbb.width / 2 - rb.left;
        const y2 = rbb.top - rb.top - 3;
        const my = (y1 + y2) / 2;
        out.push({ d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`, k: `${a}${b}`, from: a, to: b });
      }
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [snap, handle]);

  const edgeTone = (from: Id, to: Id) => {
    const f = snap.nodes[from].s;
    const t = snap.nodes[to].s;
    if ((f === "failed" || f === "skipped") && t !== "pending") return t === "done" ? "var(--live)" : "var(--dead)";
    if (f === "done" && t !== "pending") return "var(--live)";
    return "var(--line-2)";
  };

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 text-13">
        <Row k="fetchPrice =" w="15ch">
          <Words
            options={[
              { v: "ok", label: "succeeds" },
              { v: "fail", label: "throws" },
            ]}
            value={fail ? "fail" : "ok"}
            onChange={(v) => (setFail(v === "fail"), s.go(0))}
            label="fetchPrice outcome"
          />
        </Row>
        <Row k="exceptionally =" w="15ch">
          <Words
            options={[
              { v: "on", label: "there" },
              { v: "off", label: "missing" },
            ]}
            value={handle ? "on" : "off"}
            onChange={(v) => (setHandle(v === "on"), s.go(0))}
            label="exceptionally stage"
          />
        </Row>
      </div>

      <div ref={box} className="relative">
        <div className="grid grid-cols-3 gap-x-2 gap-y-7 sm:gap-x-4" style={{ gridTemplateRows: "repeat(5, auto)" }}>
          {NODES.map((nd) => {
            const st = snap.nodes[nd.id];
            const hot = snap.hot?.includes(nd.id);
            const off = nd.id === "X" && !handle;
            return (
              <div key={nd.id} className="flex justify-center" style={{ gridRow: nd.row + 1, gridColumn: nd.col + 1 }}>
                <div
                  data-n={nd.id}
                  className={`w-full max-w-[220px] min-w-0 rounded-md bg-well px-2 py-1.5 text-center ${hot ? "flash" : ""}`}
                  style={{
                    boxShadow: off ? undefined : `inset 0 0 0 ${hot ? 1.5 : 1}px ${TONE[st.s]}`,
                    border: off ? "1px dashed var(--line-2)" : undefined,
                    opacity: off ? 0.6 : 1,
                  }}
                >
                  <div className="text-[11px] leading-[1.35] break-words text-ink">{off ? "(no exceptionally)" : <Code text={nd.code} />}</div>
                  <div className="mt-0.5 min-h-[1.3em] text-[11px] leading-[1.3] break-words" style={{ color: st.s === "pending" ? "var(--faint)" : TONE[st.s] }}>
                    {st.s === "pending" ? "pending" : st.s === "running" ? "running" : st.s === "waiting" ? "waiting on inner future" : st.v}
                  </div>
                  {st.th && <div className="text-[10px] leading-3 text-faint">{st.th}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            {["line-2", "live", "dead"].map((c) => (
              <marker key={c} id={`${id}-${c}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={`var(--${c})`} />
              </marker>
            ))}
          </defs>
          {paths.map((p) => {
            const c = edgeTone(p.from, p.to);
            const m = c.includes("live") ? "live" : c.includes("dead") ? "dead" : "line-2";
            return <path key={p.k} d={p.d} fill="none" stroke={c} strokeWidth={1.3} markerEnd={`url(#${id}-${m})`} style={{ transition: "stroke 200ms var(--ease)" }} />;
          })}
        </svg>
      </div>

      <p className="mt-5 min-h-[4.8em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {snap.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
