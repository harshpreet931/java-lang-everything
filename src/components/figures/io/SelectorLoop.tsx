"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { NARR, Row, Words, ring, tint } from "./kit";

// 8 connections, 6 rounds of traffic (a fixed script, so both models see the same thing).
// thread-per-connection: 8 threads, each parked in read() until its own socket has data.
// selector: 1 thread; select() returns the set of ready keys, the loop handles exactly those.

const N = 8;
const ROUNDS: number[][] = [[], [2, 5], [0], [1, 2, 7], [], [3, 4, 5, 6], [6]];

type Model = "threads" | "selector";

export function SelectorLoop() {
  const [model, setModel] = useState<Model>("threads");
  const s = useStepper(ROUNDS.length, { interval: 1500 });
  const ready = ROUNDS[s.i];
  const handled = ROUNDS.slice(0, s.i + 1).reduce((a, r) => a + r.length, 0);

  return (
    <div {...s.keys} className="@container text-13 outline-none">
      <Row k="model =" w="8ch" last>
        <Words
          label="server model"
          options={[
            { v: "threads", label: "thread per connection" },
            { v: "selector", label: "one selector" },
          ]}
          value={model}
          onChange={setModel}
        />
      </Row>

      <div className="mt-4 grid gap-1.5">
        {Array.from({ length: N }, (_, i) => {
          const isReady = ready.includes(i);
          return (
            <div key={i} className="grid grid-cols-[7ch_minmax(0,1fr)] items-center gap-2 @[520px]:grid-cols-[8ch_minmax(0,1fr)_minmax(0,1.3fr)]">
              <span
                className="flex h-7 items-center justify-center rounded-md text-11 transition-[box-shadow,color,background-color] duration-200"
                style={{
                  boxShadow: isReady ? ring("hot") : ring("line-2"),
                  color: isReady ? "var(--hot)" : "var(--mute)",
                  background: isReady ? tint("hot", 10) : undefined,
                }}
              >
                conn {i}
              </span>
              <span className="truncate text-11 text-faint">{isReady ? "bytes arrived" : "quiet"}</span>
              {model === "threads" ? (
                <span
                  className="col-span-2 flex h-7 items-center gap-2 rounded-md px-2 text-11 transition-[box-shadow,color] duration-200 @[520px]:col-span-1"
                  style={{ boxShadow: isReady ? ring("live", 70) : ring("line"), color: isReady ? "var(--live)" : "var(--faint)" }}
                >
                  <span className="text-[9px]">{isReady ? "▶" : "❚❚"}</span>
                  thread-{i} {isReady ? "running" : "parked in read()"}
                </span>
              ) : (
                <span className="col-span-2 hidden h-7 @[520px]:col-span-1 @[520px]:block" />
              )}
            </div>
          );
        })}
      </div>

      {model === "selector" && (
        <div className="mt-4 rounded-md bg-well-2 p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-12">
            <span style={{ color: "var(--meta)" }}>selector thread</span>
            <span className="text-faint tabular">round {s.i}</span>
          </div>
          <div className="mt-2 text-12">
            <span className="text-faint">selector.select() → </span>
            {ready.length === 0 ? (
              <span className="text-mute">{s.i === 0 ? "(sleeping)" : "nothing ready, keeps sleeping"}</span>
            ) : (
              <span className="text-hot">{`{ ${ready.map((r) => `key ${r}`).join(", ")} }`}</span>
            )}
          </div>
          {ready.length > 0 && (
            <div className="mt-1 text-12 text-live">
              {ready.map((r) => `read conn ${r}`).join(" → ")} → select() again
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-12 tabular">
        <span className="text-faint">
          threads = <span className="text-hi">{model === "threads" ? N : 1}</span>
        </span>
        <span className="text-faint">
          busy right now = <span className="text-hi">{model === "threads" ? ready.length : ready.length ? 1 : 0}</span>
        </span>
        <span className="text-faint">
          parked doing nothing = <span className={model === "threads" ? "text-dead" : "text-hi"}>{model === "threads" ? N - ready.length : ready.length ? 0 : 1}</span>
        </span>
        <span className="text-faint">
          messages handled = <span className="text-hi">{handled}</span>
        </span>
      </div>

      <p className={`mt-3 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {model === "threads"
          ? ready.length
            ? `${ready.length} of ${N} threads have work. the other ${N - ready.length} each hold a stack and sit parked in read(). at 10,000 connections that's 10,000 platform threads.`
            : `nobody has data. ${N} threads, all parked. that's the shape of most servers most of the time.`
          : ready.length
            ? `one thread asks the OS which sockets are ready and gets exactly those back. it handles ${ready.length === 1 ? "it" : `all ${ready.length}`}, then asks again. quiet connections cost a key and a buffer, not a thread.`
            : "nothing ready: the one thread sleeps inside select(), and the OS wakes it when any socket gets data."}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
