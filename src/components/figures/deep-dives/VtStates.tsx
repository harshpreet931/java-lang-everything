"use client";

import { useId, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration, Words } from "./kit";

// the park path of java.lang.VirtualThread in jdk 25, straight from the state constants and
// the transition table at the top of VirtualThread.java (NEW = 0, STARTED = 1, RUNNING = 2,
// PARKING = 3, PARKED = 4, PINNED = 5, UNPARKED = 9, TERMINATED = 99). the timed, blocking
// (monitor enter), waiting (Object.wait) and yielding paths have the same shape.

type S = "NEW" | "STARTED" | "RUNNING" | "PARKING" | "PARKED" | "UNPARKED" | "PINNED" | "TERMINATED";
const POS: Record<S, [number, number]> = {
  NEW: [0, 0],
  STARTED: [1, 0],
  RUNNING: [2, 0],
  TERMINATED: [3, 0],
  PARKING: [2, 1],
  PARKED: [1, 2],
  UNPARKED: [0, 1],
  PINNED: [3, 2],
};
const EDGES: [S, S][] = [
  ["NEW", "STARTED"],
  ["STARTED", "RUNNING"],
  ["RUNNING", "PARKING"],
  ["PARKING", "PARKED"],
  ["PARKED", "UNPARKED"],
  ["UNPARKED", "RUNNING"],
  ["PARKING", "PINNED"],
  ["PINNED", "RUNNING"],
  ["RUNNING", "TERMINATED"],
];
const MOUNTED = new Set<S>(["RUNNING", "PARKING", "PINNED"]);

type Step = { at: S; from?: S; code: string; note: string };

const NORMAL: Step[] = [
  { at: "NEW", code: "Thread.ofVirtual().unstarted(task)", note: "a VirtualThread object and its continuation exist. nothing is scheduled." },
  { at: "STARTED", from: "NEW", code: "start() → submitRunContinuation()", note: "start() hands a task to the scheduler (a ForkJoinPool). the thread waits in a queue like any other task." },
  { at: "RUNNING", from: "STARTED", code: "runContinuation() → mount(); cont.run()", note: "a carrier picks the task up and mounts it: Thread.currentThread() now returns the virtual thread, and its frames run on the carrier's stack." },
  { at: "PARKING", from: "RUNNING", code: "park(): setState(PARKING); yieldContinuation()", note: "socket.read() has no data, so it ends up in LockSupport.park(). park() marks the thread PARKING and asks the continuation to yield." },
  { at: "PARKED", from: "PARKING", code: "Continuation.yield → freeze → afterYield()", note: "the yield worked: the frames were frozen into a StackChunk on the heap, run() returned on the carrier, and afterYield() flips the state to PARKED. the carrier is free for other work." },
  { at: "UNPARKED", from: "PARKED", code: "unpark() → submitRunContinuation()", note: "the poller sees the socket is readable and calls unpark(). the thread goes back in the scheduler's queue, unmounted but runnable." },
  { at: "RUNNING", from: "UNPARKED", code: "runContinuation() → mount(); cont.run()", note: "any free carrier mounts it again and thaws the top frames. park() returns as if it had been a normal blocking call." },
  { at: "TERMINATED", from: "RUNNING", code: "run() returns → afterDone()", note: "the task finishes. the continuation is done, the carrier goes back to the pool." },
];

const PINNED_PATH: Step[] = [
  { at: "RUNNING", code: "mounted, inside Config.<clinit>", note: "the same thread, but this time the blocking call happens inside a class initializer. the JVM called <clinit> itself, so there's a VM frame on the stack." },
  { at: "PARKING", from: "RUNNING", code: "park(): setState(PARKING); yieldContinuation()", note: "park() tries to yield, exactly as before." },
  { at: "PINNED", from: "PARKING", code: "yield fails → parkOnCarrierThread()", note: "freeze can't move a VM frame to the heap, so yield returns false. the thread parks the carrier itself: PINNED. JFR records jdk.VirtualThreadPinned, reason \"VM call to Config.<clinit> on stack\"." },
  { at: "RUNNING", from: "PINNED", code: "unpark() → the carrier wakes up", note: "when it's unparked, it continues on the same carrier, which did nothing else the whole time. that's the cost of pinning: one carrier lost for as long as the block lasts." },
];

export function VtStates() {
  const [path, setPath] = useState<"normal" | "pinned">("normal");
  const steps = path === "normal" ? NORMAL : PINNED_PATH;
  const s = useStepper(steps.length, { interval: 2400 });
  const st = steps[Math.min(s.i, steps.length - 1)];
  const uid = useId().replace(/:/g, "");

  const W = 430;
  const H = 230;
  const bw = 92;
  const bh = 30;
  const cx = (c: number) => 16 + bw / 2 + c * ((W - 32 - bw) / 3);
  const cy = (r: number) => 18 + bh / 2 + r * 80;
  const p = (n: S) => ({ x: cx(POS[n][0]), y: cy(POS[n][1]) });

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="virtual thread states">
      <Words
        options={[
          { v: "normal", label: "a normal park" },
          { v: "pinned", label: "a pinned park" },
        ]}
        value={path}
        onChange={(v) => {
          setPath(v);
          s.go(0);
        }}
        label="which path"
      />
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[540px]" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label={`state ${st.at}`}>
          <defs>
            {["mute", "hot"].map((t) => (
              <marker key={t} id={`${uid}-${t}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={t === "hot" ? "var(--hot)" : "var(--line-2)"} />
              </marker>
            ))}
          </defs>
          {/* mounted zone */}
          <text x={W - 16} y={12} textAnchor="end" fontSize={9.5} fill="var(--faint)">
            boxed = mounted on a carrier
          </text>
          {EDGES.map(([a, b]) => {
            const A = p(a);
            const B = p(b);
            const on = st.from === a && st.at === b;
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const len = Math.hypot(dx, dy);
            const ox = (dx / len) * (Math.abs(dx) > Math.abs(dy) ? bw / 2 + 4 : 14);
            const oy = (dy / len) * (Math.abs(dy) >= Math.abs(dx) ? bh / 2 + 4 : 10);
            return (
              <line
                key={a + b}
                x1={A.x + ox}
                y1={A.y + oy}
                x2={B.x - ox}
                y2={B.y - oy}
                stroke={on ? "var(--hot)" : "var(--line-2)"}
                strokeWidth={on ? 2 : 1}
                markerEnd={`url(#${uid}-${on ? "hot" : "mute"})`}
                className="transition-[stroke] duration-200"
              />
            );
          })}
          {(Object.keys(POS) as S[]).map((n) => {
            const { x, y } = p(n);
            const on = st.at === n;
            const mounted = MOUNTED.has(n);
            return (
              <g key={n}>
                <rect
                  x={x - bw / 2}
                  y={y - bh / 2}
                  width={bw}
                  height={bh}
                  rx={mounted ? 4 : 15}
                  fill={on ? "color-mix(in srgb, var(--hot) 22%, var(--bg))" : "var(--bg)"}
                  stroke={on ? "var(--hot)" : n === "PINNED" ? "color-mix(in srgb, var(--dead) 60%, transparent)" : "var(--line-2)"}
                  strokeWidth={on ? 1.6 : 1}
                  className="transition-[fill,stroke] duration-200"
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill={n === "PINNED" && !on ? "var(--dead)" : on ? "var(--hi)" : "var(--ink)"}>
                  {n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="rounded-md bg-bg px-3 py-2 text-12 text-ink shadow-[inset_0_0_0_1px_var(--line)] [overflow-wrap:anywhere]">
        <span className="text-faint">VirtualThread · </span>
        {st.code}
      </div>
      <Narration>{st.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
