"use client";

import { useState } from "react";

// the four VarHandle memory-order modes, weakest to strongest, with two classic litmus
// tests. the allowed outcomes follow the VarHandle javadoc and the java memory model
// (Doug Lea, "Using JDK 9 Memory Order Modes"): conceptual, not measured.

type Mode = "plain" | "opaque" | "acqrel" | "volatile";

const MODES: { id: Mode; label: string; read: string; write: string; adds: string; use: string }[] = [
  {
    id: "plain",
    label: "plain",
    read: "get",
    write: "set",
    adds: "nothing beyond a normal field. the compiler and CPU may reorder it, cache it in a register, hoist it out of a loop. long and double may even tear.",
    use: "single-threaded access, or anything already protected by a lock.",
  },
  {
    id: "opaque",
    label: "opaque",
    read: "getOpaque",
    write: "setOpaque",
    adds: "every access really happens, atomically, and each variable's writes are seen in one order. a write eventually becomes visible. but no ordering with any other variable.",
    use: "a progress flag or a counter someone glances at, where only that one value matters.",
  },
  {
    id: "acqrel",
    label: "acquire / release",
    read: "getAcquire",
    write: "setRelease",
    adds: "causality: everything the writer did before setRelease is visible to a reader whose getAcquire sees that write. enough to hand a message from one thread to another.",
    use: "single-producer queues, publishing an object. AtomicXxx.lazySet is setRelease.",
  },
  {
    id: "volatile",
    label: "volatile",
    read: "getVolatile",
    write: "setVolatile",
    adds: "one total order of all volatile accesses that every thread agrees on. the same as a volatile field, and what compareAndSet and getAndAdd use.",
    use: "the default. pick a weaker mode only when a profiler tells you to.",
  },
];

const RANK: Record<Mode, number> = { plain: 0, opaque: 1, acqrel: 2, volatile: 3 };

function Litmus({ title, t1, t2, outcome, verdict, good }: { title: string; t1: string; t2: string; outcome: string; verdict: string; good: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="text-11 text-faint">{title}</div>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-11 leading-[1.6]">
        <pre className="min-w-0 overflow-x-auto whitespace-pre text-ink">
          <span className="text-faint">T1{"\n"}</span>
          {t1}
        </pre>
        <pre className="min-w-0 overflow-x-auto whitespace-pre text-ink">
          <span className="text-faint">T2{"\n"}</span>
          {t2}
        </pre>
      </div>
      <div className="mt-2 border-t border-line pt-2 text-12">
        <span className="text-faint">{outcome} </span>
        <span style={{ color: good ? "var(--live)" : "var(--dead)" }}>{verdict}</span>
      </div>
    </div>
  );
}

export function AccessModes() {
  const [mode, setMode] = useState<Mode>("acqrel");
  const r = RANK[mode];
  const m = MODES[r];
  const rd = m.read;
  const wr = m.write;

  const mp =
    r === 0
      ? { verdict: "allowed. it may even spin forever: the read can be hoisted out of the loop.", good: false }
      : r === 1
        ? { verdict: "allowed. the loop does end, but ready says nothing about data.", good: false }
        : { verdict: "impossible. seeing ready = true means seeing data = 42.", good: true };
  const sb = r < 3 ? { verdict: "allowed. each write can sit in a store buffer while the other thread reads.", good: false } : { verdict: "impossible. one total order: someone's write came first.", good: true };

  return (
    <div className="@container">
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="access mode">
        {MODES.map((x, i) => {
          const on = x.id === mode;
          return (
            <button
              key={x.id}
              role="radio"
              aria-checked={on}
              onClick={() => setMode(x.id)}
              className="grid grid-cols-[2ch_minmax(0,1fr)] items-baseline gap-x-2 rounded-md px-3 py-1.5 text-left text-13 transition-[box-shadow,background-color] duration-200 ease-jle @[520px]:grid-cols-[2ch_17ch_minmax(0,1fr)]"
              style={{
                boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line)"}`,
                background: i <= r ? "var(--well)" : "transparent",
              }}
            >
              <span className="text-faint tabular">{i + 1}</span>
              <span style={{ color: on ? "var(--hot)" : "var(--hi)" }}>{x.label}</span>
              <span className="col-start-2 text-11 text-mute @[520px]:col-start-3">
                {x.read} / {x.write}
              </span>
            </button>
          );
        })}
        <div className="pl-3 text-11 text-faint">↑ stronger, and potentially slower. each rung keeps everything below it.</div>
      </div>

      <p className="mt-4 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        <span className="text-hot">{m.label}</span> adds {m.adds}
      </p>

      <div className="mt-3 grid gap-3 @[620px]:grid-cols-2">
        <Litmus
          title="message passing: data is a plain field"
          t1={`data = 42;\nREADY.${wr}(this, true);`}
          t2={`while (!(boolean) READY.${rd}(this)) {}\nint r = data;`}
          outcome="r == 0?"
          verdict={mp.verdict}
          good={mp.good}
        />
        <Litmus
          title="store buffering: x and y start at 0"
          t1={`X.${wr}(this, 1);\nint r1 = (int) Y.${rd}(this);`}
          t2={`Y.${wr}(this, 1);\nint r2 = (int) X.${rd}(this);`}
          outcome="r1 == 0 && r2 == 0?"
          verdict={sb.verdict}
          good={sb.good}
        />
      </div>
      <p className="mt-3 text-12 text-mute">
        <span className="text-faint">use it for: </span>
        {m.use}
      </p>
    </div>
  );
}
