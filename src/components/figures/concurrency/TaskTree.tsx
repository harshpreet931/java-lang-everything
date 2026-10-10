"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "./ui";

// a parent task with three subtasks, as a timeline. fetchOrder fails at 300 ms.
//   ExecutorService: the parent only notices when it gets around to calling get() on the
//     failed future, and the other subtasks keep running after the parent has given up.
//   StructuredTaskScope: the first failure cancels the scope, siblings are interrupted,
//     join() throws right away, and nothing outlives the parent.

type Mode = "executor" | "scope";
type Bar = { from: number; to: number; end: "ok" | "fail" | "cancelled" | "leak" | "running" };
const T = 1300;
const CHILDREN = ["findUser", "fetchOrder", "fetchWeather"];

// times (ms) for each scenario
function plan(mode: Mode, fail: boolean) {
  if (!fail) {
    return {
      parentEnd: 1200,
      parentNote: "joined, all three succeeded",
      parentOk: true,
      bars: [
        { from: 0, to: 800, end: "ok" },
        { from: 0, to: 500, end: "ok" },
        { from: 0, to: 1200, end: "ok" },
      ] as Bar[],
      marks: [500, 800, 1200],
    };
  }
  if (mode === "executor") {
    return {
      parentEnd: 800,
      parentNote: "user.get() returned at 800, then order.get() threw",
      parentOk: false,
      bars: [
        { from: 0, to: 800, end: "ok" },
        { from: 0, to: 300, end: "fail" },
        { from: 0, to: 1200, end: "leak" },
      ] as Bar[],
      marks: [300, 800, 1200],
    };
  }
  return {
    parentEnd: 300,
    parentNote: "join() threw at 300: fetchOrder failed",
    parentOk: false,
    bars: [
      { from: 0, to: 300, end: "cancelled" },
      { from: 0, to: 300, end: "fail" },
      { from: 0, to: 300, end: "cancelled" },
    ] as Bar[],
    marks: [300],
  };
}

const NOTES: Record<string, string[]> = {
  "executor-fail": [
    "handle() submits three tasks to an ExecutorService and gets three Futures back. then it calls user.get() and waits.",
    "300 ms: fetchOrder throws. the exception is stored in its Future. nobody is looking at that Future yet, so nobody notices.",
    "800 ms: findUser finishes. handle() moves on to order.get(), which finally throws. handle() fails, 500 ms after the failure actually happened.",
    "1200 ms: fetchWeather is still running and finishes now, 400 ms after the request it was for already failed. its thread was busy for nothing, and if it had side effects, they happened anyway. a leak.",
  ],
  "scope-fail": [
    "handle() opens a StructuredTaskScope and forks three subtasks, each in its own virtual thread. then it calls scope.join().",
    "300 ms: fetchOrder throws. the scope cancels itself: findUser and fetchWeather are interrupted, and join() throws right away with fetchOrder's exception as the cause. when the try block closes, every subtask has finished. nothing outlives handle().",
  ],
  "executor-ok": [
    "handle() submits three tasks and gets three Futures back.",
    "500 ms: fetchOrder is done.",
    "800 ms: findUser is done.",
    "1200 ms: fetchWeather is done, and handle() has all three results.",
  ],
  "scope-ok": [
    "handle() opens a scope and forks three subtasks.",
    "500 ms: fetchOrder is done.",
    "800 ms: findUser is done.",
    "1200 ms: fetchWeather is done. join() returns, and handle() reads the three results.",
  ],
};

export function TaskTree() {
  const [mode, setMode] = useState<Mode>("scope");
  const [fail, setFail] = useState(true);
  const p = plan(mode, fail);
  const times = [0, ...p.marks];
  const notes = NOTES[`${mode}-${fail ? "fail" : "ok"}`];
  const s = useStepper(times.length, { interval: 1800 });
  const now = times[Math.min(s.i, times.length - 1)];
  const x = (ms: number) => `${(ms / T) * 100}%`;

  const color = (e: Bar["end"]) =>
    e === "ok" ? "var(--live)" : e === "fail" ? "var(--dead)" : e === "leak" ? "var(--dead)" : e === "cancelled" ? "var(--mute)" : "var(--hot)";

  const rows = [
    { label: "handle()", sub: mode === "scope" ? "scope.join()" : "get() each Future", bar: { from: 0, to: p.parentEnd, end: p.parentOk ? "ok" : "fail" } as Bar, parent: true },
    ...CHILDREN.map((c, i) => ({ label: c, sub: "", bar: p.bars[i], parent: false })),
  ];

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 text-13">
        <Row k="run them with =" w="16ch">
          <Words
            options={[
              { v: "executor", label: "ExecutorService" },
              { v: "scope", label: "StructuredTaskScope" },
            ]}
            value={mode}
            onChange={(v) => (setMode(v as Mode), s.go(0))}
            label="mode"
          />
        </Row>
        <Row k="fetchOrder =" w="16ch">
          <Words
            options={[
              { v: "fail", label: "throws at 300 ms" },
              { v: "ok", label: "succeeds" },
            ]}
            value={fail ? "fail" : "ok"}
            onChange={(v) => (setFail(v === "fail"), s.go(0))}
            label="fetchOrder outcome"
          />
        </Row>
      </div>

      <div className="grid grid-cols-[minmax(0,15ch)_minmax(0,1fr)] gap-x-2 text-11 sm:grid-cols-[18ch_minmax(0,1fr)] sm:gap-x-3 sm:text-12">
        <span />
        <div className="relative mb-1 h-4 text-[10px] text-faint">
          {[0, 300, 600, 900, 1200].map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular" style={{ left: x(t) }}>
              {t}
            </span>
          ))}
        </div>
        {rows.map((r, i) => {
          const b = r.bar;
          const shownTo = Math.min(now, b.to);
          const finished = now >= b.to;
          const tone = finished ? color(b.end) : "var(--hot)";
          const leaking = b.end === "leak" && now > p.parentEnd;
          return (
            <div key={r.label} className="contents">
              <div className={`flex min-w-0 flex-col justify-center border-b border-line py-2 ${r.parent ? "" : "pl-1.5 sm:pl-3"}`}>
                <span className={`truncate ${r.parent ? "text-hi" : "text-ink"}`}>
                  {r.parent ? "" : i === rows.length - 1 ? "└ " : "├ "}
                  {r.label}
                </span>
                {r.sub && <span className="truncate text-[10px] text-faint">{r.sub}</span>}
              </div>
              <div className="relative border-b border-line py-2">
                {now > 0 && <span aria-hidden className="absolute inset-y-0 w-px bg-hot/50" style={{ left: x(now) }} />}
                <div className="relative h-5">
                  <span
                    className="absolute top-0 h-5 rounded-xs transition-[width] duration-300 ease-jle"
                    style={{
                      left: x(b.from),
                      width: x(Math.max(0, shownTo - b.from)),
                      background: `color-mix(in srgb, ${tone} ${leaking ? 10 : 22}%, transparent)`,
                      boxShadow: leaking ? undefined : `inset 0 0 0 1px ${tone}`,
                      border: leaking ? `1px dashed ${tone}` : undefined,
                    }}
                  />
                  {finished && (
                    <span
                      className={`absolute top-0 flex h-5 items-center text-[10px] whitespace-nowrap ${b.to / T > 0.55 ? "pr-1.5" : "pl-1.5"}`}
                      style={b.to / T > 0.55 ? { right: `calc(100% - ${x(b.to)})`, color: color(b.end) } : { left: x(b.to), color: color(b.end) }}
                    >
                      {b.end === "ok" ? "done" : b.end === "fail" ? "throws" : b.end === "cancelled" ? "cancelled" : "done, for nobody"}
                    </span>
                  )}
                  {!finished && now > 0 && (
                    <span className="absolute top-0 flex h-5 items-center pl-1.5 text-[10px] text-hot" style={{ left: x(shownTo) }}>
                      {r.parent ? "waiting" : "running"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 min-h-[4.8em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {notes[Math.min(s.i, notes.length - 1)]}
      </p>
      <StepControls s={s} label="moment" className="mt-2" />
    </div>
  );
}
