"use client";

import { useState } from "react";
import { Row, Words } from "./ui";

// "do these two calls block each other?" pick a call for each thread and see
// which monitor each one needs. same monitor: one waits. different: both run.

type Call = "a.inc()" | "b.inc()" | "Counter.reset()" | "a.get()";
const CALLS: Call[] = ["a.inc()", "b.inc()", "Counter.reset()", "a.get()"];
const LOCK: Record<Call, string | null> = {
  "a.inc()": "a",
  "b.inc()": "b",
  "Counter.reset()": "Counter.class",
  "a.get()": null,
};
const MONITORS = ["a", "b", "Counter.class"] as const;

function verdict(c1: Call, c2: Call): { k: "live" | "meta" | "dead"; text: string } {
  const l1 = LOCK[c1];
  const l2 = LOCK[c2];
  if (l1 && l1 === l2)
    return {
      k: "meta",
      text: `both need the monitor of ${l1}. T1 gets it, T2 is BLOCKED until T1 leaves. this is the only case where synchronized does anything.`,
    };
  if (!l1 || !l2) {
    const other = !l1 ? c2 : c1;
    if (other === "a.inc()" || (c1 === "a.get()" && c2 === "a.get()"))
      return c1 === c2
        ? { k: "live", text: "two reads, no writes, no lock. harmless." }
        : {
            k: "dead",
            text: "get() takes no lock, so it never waits for inc(). worse: without the lock there's no happens-before, so get() may not even see inc()'s writes. a data race.",
          };
    return { k: "live", text: "get() takes no lock, but it touches a and the other call doesn't. nothing shared, nothing to protect." };
  }
  if ((l1 === "Counter.class") !== (l2 === "Counter.class"))
    return {
      k: "live",
      text: "a static synchronized method locks Counter.class. an instance one locks the instance. different monitors, so they run at the same time and never exclude each other.",
    };
  return { k: "live", text: "two different objects, two different monitors. both run at the same time, which is fine: they don't share a counter." };
}

export function WhichLock() {
  const [c1, setC1] = useState<Call>("a.inc()");
  const [c2, setC2] = useState<Call>("b.inc()");
  const l1 = LOCK[c1];
  const l2 = LOCK[c2];
  const same = !!l1 && l1 === l2;
  const v = verdict(c1, c2);

  return (
    <div>
      <pre className="mb-5 overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
        {`class Counter {
    private int n;
    synchronized void inc()          { n++; }      // locks this
    static synchronized void reset() { ... }       // locks Counter.class
    int get()                        { return n; } // locks nothing
}
Counter a = new Counter(), b = new Counter();`}
      </pre>
      <div className="text-13">
        <Row k="T1 calls =" w="10ch">
          <Words options={CALLS} value={c1} onChange={setC1} label="T1 calls" />
        </Row>
        <Row k="T2 calls =" w="10ch">
          <Words options={CALLS} value={c2} onChange={setC2} label="T2 calls" />
        </Row>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {MONITORS.map((m) => {
          const t1 = l1 === m;
          const t2 = l2 === m;
          return (
            <div
              key={m}
              className="flex flex-col rounded-md bg-well px-3 py-2.5"
              style={{ boxShadow: `inset 0 0 0 1px ${t1 || t2 ? "var(--meta)" : "var(--line)"}` }}
            >
              <span className="text-11 text-faint">monitor of</span>
              <span className={`text-13 ${t1 || t2 ? "text-meta" : "text-mute"}`}>{m}</span>
              <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
                {t1 && <Who name="T1" state="owner" />}
                {t2 && <Who name="T2" state={same ? "blocked" : "owner"} />}
              </div>
            </div>
          );
        })}
        <div className="flex flex-col rounded-xs px-3 py-2.5" style={{ border: "1px dashed var(--line-2)" }}>
          <span className="text-11 text-faint">no lock at all</span>
          <span className="text-13 text-mute">get()</span>
          <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
            {!l1 && <Who name="T1" state="free" />}
            {!l2 && <Who name="T2" state="free" />}
          </div>
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-17 leading-[1.6]" style={{ color: `var(--${v.k})` }} aria-live="polite">
        {v.text}
      </p>
    </div>
  );
}

function Who({ name, state }: { name: string; state: "owner" | "blocked" | "free" }) {
  return (
    <span
      className="inline-flex h-7 items-center rounded-xs px-2 text-12"
      style={{
        color: state === "owner" ? "var(--live)" : state === "blocked" ? "var(--mute)" : "var(--ink)",
        boxShadow: state === "blocked" ? undefined : `inset 0 0 0 1px ${state === "owner" ? "var(--live)" : "var(--line-2)"}`,
        border: state === "blocked" ? "1px dashed var(--line-2)" : undefined,
      }}
    >
      {name}
      <span className="ml-1.5 text-11 opacity-75">{state === "owner" ? "inside" : state === "blocked" ? "BLOCKED" : "no lock"}</span>
    </span>
  );
}
