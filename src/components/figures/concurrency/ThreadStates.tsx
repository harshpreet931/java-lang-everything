"use client";

import { useId } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// the six values of Thread.State as a state machine.
// click a numbered transition (or use the list / the stepper) to see the code that causes it.
// the stepper order follows the states program in the chapter: 1 → 8.

type S = "NEW" | "RUNNABLE" | "BLOCKED" | "WAITING" | "TIMED_WAITING" | "TERMINATED";

const BOX: Record<S, { x: number; y: number; w: number }> = {
  BLOCKED: { x: 160, y: 12, w: 100 },
  NEW: { x: 6, y: 112, w: 62 },
  RUNNABLE: { x: 160, y: 112, w: 100 },
  TERMINATED: { x: 330, y: 112, w: 88 },
  WAITING: { x: 62, y: 214, w: 84 },
  TIMED_WAITING: { x: 252, y: 214, w: 112 },
};
const H = 28;

type Edge = { from: S; to: S; d: string; bx: number; by: number; code: string; text: string };

const EDGES: Edge[] = [
  {
    from: "NEW",
    to: "RUNNABLE",
    d: "M 68 126 L 157 126",
    bx: 112,
    by: 126,
    code: "t.start();",
    text: "start() asks the OS for a real thread and schedules run() on it. call start() a second time and you get IllegalThreadStateException.",
  },
  {
    from: "RUNNABLE",
    to: "BLOCKED",
    d: "M 192 112 L 192 43",
    bx: 192,
    by: 78,
    code: "synchronized (lock) {   // another thread owns lock\n    ...\n}",
    text: "BLOCKED means exactly one thing: waiting to enter a synchronized block or method whose monitor someone else holds.",
  },
  {
    from: "BLOCKED",
    to: "RUNNABLE",
    d: "M 228 40 L 228 109",
    bx: 228,
    by: 78,
    code: "}   // the owner leaves its synchronized block",
    text: "the owner let go and this thread won the monitor. there's no queue order promised: the JVM picks a winner.",
  },
  {
    from: "RUNNABLE",
    to: "WAITING",
    d: "M 176 140 Q 170 186 130 211",
    bx: 162,
    by: 180,
    code: "lock.wait();\nother.join();\nLockSupport.park();",
    text: "parked with no deadline, until another thread does something: notify(), the joined thread ending, unpark(). ReentrantLock.lock() parks too, so a thread stuck on one shows WAITING, not BLOCKED.",
  },
  {
    from: "WAITING",
    to: "RUNNABLE",
    d: "M 86 214 Q 96 150 156 131",
    bx: 104,
    by: 162,
    code: "lock.notify();   // run by some other thread",
    text: "woken up. a thread coming back from wait() still has to win the monitor back first, so it actually passes through BLOCKED on the way.",
  },
  {
    from: "RUNNABLE",
    to: "TIMED_WAITING",
    d: "M 244 140 Q 252 186 296 211",
    bx: 258,
    by: 180,
    code: "Thread.sleep(50);\nlock.wait(50);\nother.join(50);",
    text: "the same kind of waiting, with a deadline attached.",
  },
  {
    from: "TIMED_WAITING",
    to: "RUNNABLE",
    d: "M 334 214 Q 322 150 263 131",
    bx: 318,
    by: 162,
    code: "// time's up, or notify(), or t.interrupt()",
    text: "the timeout ran out, it got notified, or it got interrupted (then sleep throws InterruptedException and the flag is cleared).",
  },
  {
    from: "RUNNABLE",
    to: "TERMINATED",
    d: "M 260 126 L 327 126",
    bx: 294,
    by: 126,
    code: "}   // run() returns, or throws",
    text: "run() finished, normally or with an exception. a terminated thread is done for good: it can't be started again.",
  },
];

export function ThreadStates() {
  const s = useStepper(EDGES.length, { interval: 2200 });
  const id = useId().replace(/:/g, "");
  const cur = EDGES[s.i];

  return (
    <div {...s.keys} className="outline-none">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 424 252" className="block w-full max-w-[560px]" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="the six thread states and the eight transitions between them">
          <defs>
            <marker id={`${id}-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--line-2)" />
            </marker>
            <marker id={`${id}-h`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--hot)" />
            </marker>
          </defs>

          {EDGES.map((e, i) => {
            const on = i === s.i;
            return (
              <path
                key={i}
                d={e.d}
                fill="none"
                stroke={on ? "var(--hot)" : "var(--line-2)"}
                strokeWidth={on ? 1.6 : 1.2}
                markerEnd={`url(#${id}-${on ? "h" : "a"})`}
                style={{ transition: "stroke 200ms var(--ease)" }}
              />
            );
          })}

          {(Object.keys(BOX) as S[]).map((k) => {
            const b = BOX[k];
            const isTo = cur.to === k;
            const isFrom = cur.from === k;
            return (
              <g key={k}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={H}
                  rx={2}
                  fill={isTo ? "color-mix(in srgb, var(--hot) 12%, var(--well))" : "var(--well)"}
                  stroke={isTo ? "var(--hot)" : isFrom ? "var(--ink)" : "var(--line-2)"}
                  style={{ transition: "stroke 200ms var(--ease), fill 200ms var(--ease)" }}
                />
                <text
                  x={b.x + b.w / 2}
                  y={b.y + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isTo ? "var(--hot)" : isFrom ? "var(--hi)" : "var(--mute)"}
                >
                  {k}
                </text>
              </g>
            );
          })}

          {EDGES.map((e, i) => {
            const on = i === s.i;
            return (
              <g
                key={`b${i}`}
                role="button"
                tabIndex={-1}
                aria-label={`transition ${i + 1}: ${e.from} to ${e.to}`}
                onClick={() => s.go(i)}
                className="cursor-pointer"
              >
                <circle cx={e.bx} cy={e.by} r={14} fill="transparent" />
                <circle
                  cx={e.bx}
                  cy={e.by}
                  r={8}
                  fill={on ? "var(--hot)" : "var(--well)"}
                  stroke={on ? "var(--hot)" : "var(--line-2)"}
                />
                <text x={e.bx} y={e.by + 3.6} textAnchor="middle" fontSize={10} fill={on ? "var(--bg)" : "var(--mute)"}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2 text-13">
            <span className="text-hot tabular">{s.i + 1}</span>
            <span className="text-hi">
              {cur.from} → {cur.to}
            </span>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-well px-3.5 py-2.5 text-12 leading-[1.7] whitespace-pre text-hi shadow-[inset_0_0_0_1px_var(--line)]">
            {cur.code}
          </pre>
          <p className="mt-3 min-h-[4.8em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
            {cur.text}
          </p>
          <div className="mt-3 grid gap-y-0.5 text-12" role="group" aria-label="transitions">
            {EDGES.map((e, i) => (
              <button
                key={i}
                className="word !min-h-7 !justify-start !px-1.5 !text-12"
                aria-pressed={i === s.i}
                onClick={() => s.go(i)}
              >
                <span className="mr-1.5 tabular opacity-70">{i + 1}</span>
                <span className="truncate">
                  {e.from.toLowerCase().replace("_", " ")} → {e.to.toLowerCase().replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <StepControls s={s} label="transition" className="mt-5" />
    </div>
  );
}
