"use client";

import { useState } from "react";
import { BitStrip } from "./BitStrip";
import { Row, Words } from "./kit";

// ThreadPoolExecutor.ctl, straight from the jdk 25 source:
//   COUNT_BITS = 29, COUNT_MASK = (1 << 29) - 1
//   RUNNING = -1 << 29, SHUTDOWN = 0, STOP = 1 << 29, TIDYING = 2 << 29, TERMINATED = 3 << 29
//   runStateOf(c) = c & ~COUNT_MASK, workerCountOf(c) = c & COUNT_MASK, ctlOf(rs, wc) = rs | wc
// read live with reflection on jdk 25: a new pool is 0xe0000000, three workers 0xe0000003,
// shutdown() with three workers 0x00000003, shutdownNow() with one 0x20000001, done 0x60000000.

const STATES = [
  { k: "RUNNING", rs: -1 << 29, what: "accepts new tasks, runs queued ones" },
  { k: "SHUTDOWN", rs: 0, what: "no new tasks, still drains the queue" },
  { k: "STOP", rs: 1 << 29, what: "no new tasks, queue dropped, workers interrupted" },
  { k: "TIDYING", rs: 2 << 29, what: "no workers, no tasks. running the terminated() hook" },
  { k: "TERMINATED", rs: 3 << 29, what: "terminated() returned. awaitTermination wakes up" },
] as const;

type K = (typeof STATES)[number]["k"];

const EDGES: { from: K; to: K; when: string }[] = [
  { from: "RUNNING", to: "SHUTDOWN", when: "shutdown()" },
  { from: "RUNNING", to: "STOP", when: "shutdownNow()" },
  { from: "SHUTDOWN", to: "STOP", when: "shutdownNow()" },
  { from: "SHUTDOWN", to: "TIDYING", when: "queue and pool empty" },
  { from: "STOP", to: "TIDYING", when: "pool empty" },
  { from: "TIDYING", to: "TERMINATED", when: "terminated() done" },
];

const COUNT_MASK = (1 << 29) - 1;
const hex = (x: number) => "0x" + (x >>> 0).toString(16).padStart(8, "0");

export function CtlBits() {
  const [state, setState] = useState<K>("RUNNING");
  const [wc, setWc] = useState(3);
  const st = STATES.find((s) => s.k === state)!;
  const canHaveWorkers = state === "RUNNING" || state === "SHUTDOWN" || state === "STOP";
  const count = canHaveWorkers ? wc : 0;
  const cc = (st.rs | count) | 0;

  return (
    <div className="@container text-13">
      <Row k="runState =" w="11ch">
        <Words label="run state" value={state} onChange={setState} options={STATES.map((s) => ({ v: s.k, label: s.k }))} />
      </Row>
      <Row k="workers =" w="11ch" last>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={0}
            max={12}
            value={count}
            disabled={!canHaveWorkers}
            onChange={(e) => setWc(Number(e.target.value))}
            aria-label="worker count"
          />
          <span className="w-[4ch] text-right text-hi tabular">{count}</span>
        </div>
      </Row>

      <div className="mt-3 border-t border-line pt-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 text-12">
          <span className="text-ink">
            ctl <span className="text-faint">· one AtomicInteger</span>
          </span>
          <span className="tabular">
            <span className="text-hi">{hex(cc)}</span>
            <span className="text-faint"> = {cc}</span>
          </span>
        </div>
        <BitStrip value={cc} toneAt={(b) => (b >= 29 ? "meta" : b < 29 && (cc >>> b) & 1 ? "hot" : undefined)} label={`ctl bits for ${state} with ${count} workers`} />
        <div className="mt-1.5 flex justify-between text-11">
          <span className="text-meta">runState · 3 bits</span>
          <span className="text-hot">workerCount · 29 bits (max {COUNT_MASK.toLocaleString("en-US")})</span>
        </div>
      </div>

      <div className="mt-4 grid gap-1 border-t border-line pt-3 text-12 tabular" aria-live="polite">
        <div>
          <span className="text-faint">runStateOf(c)    = c &amp; ~COUNT_MASK = </span>
          <span className="text-meta">{hex(cc & ~COUNT_MASK)}</span>
          <span className="text-faint"> → {state}</span>
        </div>
        <div>
          <span className="text-faint">workerCountOf(c) = c &amp; COUNT_MASK  = </span>
          <span className="text-hot">{cc & COUNT_MASK}</span>
        </div>
        <div>
          <span className="text-faint">isRunning(c)     = c &lt; SHUTDOWN     = </span>
          <span style={{ color: cc < 0 ? "var(--live)" : "var(--mute)" }}>{String(cc < 0)}</span>
          <span className="text-faint"> (RUNNING is the only negative state)</span>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 text-11 text-faint">the run state only ever goes up</div>
        <div className="grid gap-2 @[620px]:grid-cols-5">
          {STATES.map((s) => {
            const on = s.k === state;
            const out = EDGES.filter((e) => e.from === s.k);
            return (
              <button
                key={s.k}
                onClick={() => setState(s.k)}
                className="rounded-md bg-bg px-2.5 py-2 text-left transition-[box-shadow] duration-200"
                style={{ boxShadow: `inset 0 0 0 1px ${on ? "var(--meta)" : "var(--line-2)"}` }}
                aria-pressed={on}
              >
                <div className={`text-12 ${on ? "text-meta" : "text-hi"}`}>{s.k}</div>
                <div className="mt-0.5 text-[10px] leading-[1.4] text-faint">{s.what}</div>
                {out.length > 0 && (
                  <div className="mt-1.5 grid gap-0.5 border-t border-line pt-1 text-[10px] leading-[1.4] text-mute">
                    {out.map((e) => (
                      <span key={e.to}>
                        → {e.to} <span className="text-faint">on {e.when}</span>
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
