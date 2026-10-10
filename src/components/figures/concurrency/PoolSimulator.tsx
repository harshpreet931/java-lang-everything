"use client";

import { useRef, useState } from "react";
import { Narrate, Row, Slider, Words, useTicker } from "./ui";

// a ThreadPoolExecutor you can drive. the decision in execute() is the real one:
//   1. fewer than corePoolSize threads → start a new thread for this task
//   2. else, if the queue accepts it → queue it
//   3. else, fewer than maximumPoolSize threads → start a new (extra) thread for it
//   4. else → reject (the RejectedExecutionHandler decides what that means)
// idle threads above corePoolSize die after keepAliveTime. time is simulated.

type Policy = "abort" | "caller-runs" | "discard" | "discard-oldest";
type Task = { id: number; left: number };
type Worker = { n: number; extra: boolean; task: Task | null; idle: number; born: number };
type St = {
  t: number;
  acc: number;
  next: number;
  workers: Worker[];
  queue: Task[];
  rejected: number[];
  done: number;
  largest: number;
  threadNo: number;
  caller: Task | null;
  note: string;
  flash: string;
};

const KEEP_ALIVE = 3;
const DT = 0.1;
const INF = 9;

const fresh = (): St => ({
  t: 0,
  acc: 0.999,
  next: 1,
  workers: [],
  queue: [],
  rejected: [],
  done: 0,
  largest: 0,
  threadNo: 0,
  caller: null,
  note: "an empty pool: no threads yet. they're created lazily, one per task, until there are corePoolSize of them.",
  flash: "",
});

type Cfg = { core: number; max: number; cap: number; dur: number; rate: number; policy: Policy };

function execute(s: St, cfg: Cfg): St {
  const id = s.next;
  const task: Task = { id, left: cfg.dur };
  const out: St = { ...s, next: id + 1, workers: s.workers.map((w) => ({ ...w })), queue: [...s.queue], rejected: [...s.rejected] };
  const busy = out.workers.filter((w) => w.task).length;
  const cap = cfg.cap >= INF ? Infinity : cfg.cap;
  const spawn = (extra: boolean) => {
    out.threadNo += 1;
    out.workers.push({ n: out.threadNo, extra, task, idle: 0, born: out.t });
    out.largest = Math.max(out.largest, out.workers.length);
    return out.threadNo;
  };

  if (out.workers.length < cfg.core) {
    const n = spawn(false);
    out.note = `task ${id}: only ${out.workers.length - 1} of ${cfg.core} core threads exist, so a new thread (thread-${n}) is started just for it. even if other threads are idle.`;
    out.flash = `w${n}`;
  } else if (out.queue.length < cap) {
    out.queue.push(task);
    out.note = `task ${id}: the core threads exist, so it goes into the queue (${out.queue.length}/${cap === Infinity ? "∞" : cap}). ${busy < out.workers.length ? "an idle thread will pick it up right away." : "every thread is busy, so it waits."}`;
    out.flash = `q${id}`;
  } else if (out.workers.length < cfg.max) {
    const n = spawn(true);
    const waiting = out.queue.map((q) => q.id);
    out.note = `task ${id}: the queue is full, and there's room below maximumPoolSize, so an extra thread (thread-${n}) starts and runs task ${id} right now. ${waiting.length ? `tasks ${waiting.join(", ")} arrived earlier and are still waiting. newest first.` : ""}`;
    out.flash = `w${n}`;
  } else {
    if (cfg.policy === "caller-runs") {
      if (!out.caller) {
        out.caller = task;
        out.note = `task ${id}: queue full, pool at max. CallerRunsPolicy: the thread that called execute() runs it itself. while it's busy, it can't submit anything else. that's backpressure for free.`;
        out.flash = "caller";
      } else {
        out.rejected.push(id);
        out.note = `task ${id}: the caller is busy running a task itself.`;
      }
    } else if (cfg.policy === "discard-oldest" && out.queue.length) {
      const old = out.queue.shift()!;
      out.queue.push(task);
      out.rejected.push(old.id);
      out.note = `task ${id}: queue full, pool at max. DiscardOldestPolicy drops task ${old.id}, the oldest one in the queue, silently, and queues ${id} instead.`;
      out.flash = `q${id}`;
    } else {
      out.rejected.push(id);
      out.note =
        cfg.policy === "abort"
          ? `task ${id}: queue full, pool at max. AbortPolicy (the default) throws RejectedExecutionException back at the caller.`
          : `task ${id}: queue full, pool at max. DiscardPolicy drops it. no exception, no log. it just never runs.`;
      out.flash = "rej";
    }
  }
  return out;
}

function tick(s: St, cfg: Cfg): St {
  let out: St = { ...s, t: s.t + DT, workers: s.workers.map((w) => ({ ...w, task: w.task ? { ...w.task } : null })), queue: [...s.queue], flash: "" };
  // run tasks
  for (const w of out.workers) {
    if (w.task) {
      w.task.left -= DT;
      if (w.task.left <= 1e-9) {
        w.task = null;
        out.done += 1;
        w.idle = 0;
      }
    }
    if (!w.task && out.queue.length) {
      w.task = out.queue.shift()!;
      w.idle = 0;
    }
  }
  if (out.caller) {
    const c = { ...out.caller, left: out.caller.left - DT };
    if (c.left <= 1e-9) {
      out.caller = null;
      out.done += 1;
    } else out.caller = c;
  }
  // idle threads above core time out
  for (const w of out.workers) if (!w.task) w.idle += DT;
  let alive = out.workers.length;
  out.workers = out.workers.filter((w) => {
    if (!w.task && w.idle >= KEEP_ALIVE && alive > cfg.core) {
      alive -= 1;
      out.note = `thread-${w.n} sat idle for keepAliveTime (${KEEP_ALIVE} s) while the pool was above corePoolSize, so it exits. the pool shrinks back toward ${cfg.core}.`;
      return false;
    }
    return true;
  });
  // threads are interchangeable: the oldest corePoolSize of them count as "core"
  out.workers.forEach((w, i) => (w.extra = i >= cfg.core));
  // arrivals (the submitting thread is stuck while it runs a task itself)
  if (!out.caller && cfg.rate > 0) {
    out.acc += cfg.rate * DT;
    while (out.acc >= 1) {
      out.acc -= 1;
      out = execute(out, cfg);
    }
  }
  return out;
}

export function PoolSimulator() {
  const [core, setCore] = useState(2);
  const [max, setMax] = useState(4);
  const [cap, setCap] = useState(2);
  const [dur, setDur] = useState(4);
  const [rate, setRate] = useState(1);
  const [policy, setPolicy] = useState<Policy>("abort");
  const [running, setRunning] = useState(false);
  const [s, setS] = useState<St>(fresh);
  const cfg: Cfg = { core, max: Math.max(core, max), cap, dur, rate, policy };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const ref = useTicker(running, 100, () => setS((cur) => tick(cur, cfgRef.current)));

  const reset = () => {
    setRunning(false);
    setS(fresh());
  };
  const burst = () =>
    setS((cur) => {
      let out = cur;
      for (let k = 0; k < 10; k++) out = execute(out, cfgRef.current);
      return out;
    });

  const capLabel = cap >= INF ? "∞" : String(cap);
  const qShown = s.queue.slice(0, 12);

  return (
    <div ref={ref}>
      <div className="mb-5 grid gap-x-8 text-13 md:grid-cols-2">
        <div>
          <Row k="corePoolSize =" w="16ch">
            <Slider value={core} min={1} max={6} onChange={(v) => (setCore(v), v > max && setMax(v))} label="core pool size" />
          </Row>
          <Row k="maxPoolSize =" w="16ch">
            <Slider value={Math.max(core, max)} min={1} max={8} onChange={(v) => setMax(Math.max(v, core))} label="maximum pool size" />
          </Row>
          <Row k="queue capacity =" w="16ch">
            <Slider value={cap} min={0} max={INF} onChange={setCap} label="queue capacity" format={(v) => (v >= INF ? "∞" : String(v))} />
          </Row>
        </div>
        <div>
          <Row k="task takes =" w="14ch">
            <Slider value={dur} min={0.5} max={8} step={0.5} onChange={setDur} label="task duration in seconds" format={(v) => `${v} s`} />
          </Row>
          <Row k="arrivals =" w="14ch">
            <Slider value={rate} min={0} max={4} step={0.25} onChange={setRate} label="arrivals per second" format={(v) => `${v}/s`} />
          </Row>
          <Row k="when full =" w="14ch">
            <select
              className="min-w-0 rounded-sm bg-bg px-2 py-1 text-12 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as Policy)}
              aria-label="rejection policy"
            >
              <option value="abort">AbortPolicy (default)</option>
              <option value="caller-runs">CallerRunsPolicy</option>
              <option value="discard">DiscardPolicy</option>
              <option value="discard-oldest">DiscardOldestPolicy</option>
            </select>
          </Row>
        </div>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-11 text-faint">
        <span>
          work queue · {s.queue.length}/{capLabel}
          {cap === 0 && " (SynchronousQueue: holds nothing)"}
        </span>
        <span>next to run is on the left</span>
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-md px-2 py-2" style={{ border: "1px dashed var(--line-2)" }}>
        {qShown.map((q) => (
            <span
              key={q.id}
              className={`obj-in flex h-8 min-w-9 items-center justify-center rounded-xs px-1.5 text-12 text-hi tabular shadow-[inset_0_0_0_1px_var(--ink)] ${s.flash === `q${q.id}` ? "flash" : ""}`}
            >
              {q.id}
            </span>
          ))}
        {s.queue.length > 12 && <span className="ml-1 text-12 text-dead tabular">+{s.queue.length - 12} more</span>}
        {cap < INF &&
          Array.from({ length: Math.max(0, cap - s.queue.length) }, (_, j) => (
            <span key={`e${j}`} className="flex h-8 w-9 items-center justify-center rounded-xs text-11 text-faint shadow-[inset_0_0_0_1px_var(--line)]">
              ·
            </span>
          ))}
        {cap === 0 && <span className="text-11 text-faint">nothing can wait here</span>}
      </div>

      <div className="mt-4 mb-1.5 flex items-baseline justify-between text-11 text-faint">
        <span>
          threads · {s.workers.length} (core {core}, max {Math.max(core, max)})
        </span>
        <span>keepAliveTime = {KEEP_ALIVE} s</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {s.workers.map((w) => (
          <div
            key={w.n}
            className={`obj-in rounded-md bg-well px-2.5 py-2 ${s.flash === `w${w.n}` ? "flash" : ""}`}
            style={{
              boxShadow: w.extra ? undefined : `inset 0 0 0 1px ${w.task ? "var(--live)" : "var(--line-2)"}`,
              border: w.extra ? `1px dashed ${w.task ? "var(--live)" : "var(--line-2)"}` : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-2 text-11">
              <span className="text-ink">thread-{w.n}</span>
              <span className="text-faint">{w.extra ? "extra" : "core"}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-[5ch] text-12 tabular" style={{ color: w.task ? "var(--live)" : "var(--faint)" }}>
                {w.task ? `#${w.task.id}` : "idle"}
              </span>
              <span className="relative h-1.5 flex-1 rounded-full bg-well-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: w.task ? `${(1 - w.task.left / dur) * 100}%` : w.extra ? `${Math.min(1, w.idle / KEEP_ALIVE) * 100}%` : "0%",
                    background: w.task ? "var(--live)" : "var(--line-2)",
                  }}
                />
              </span>
            </div>
          </div>
        ))}
        {Array.from({ length: Math.max(0, Math.max(core, max) - s.workers.length) }, (_, j) => (
          <div key={`slot${j}`} className="flex min-h-[54px] items-center justify-center rounded-md text-11 text-faint" style={{ border: "1px dashed var(--line)" }}>
            {s.workers.length + j < core ? "core slot" : "room for extra"}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 text-12 sm:grid-cols-4">
        <Stat k="submitted" v={s.next - 1} />
        <Stat k="completed" v={s.done} tone="live" />
        <Stat k={policy === "discard" || policy === "discard-oldest" ? "discarded" : "rejected"} v={s.rejected.length} tone={s.rejected.length ? "dead" : undefined} />
        <Stat k="largest pool" v={s.largest} />
      </div>
      {(s.rejected.length > 0 || s.caller) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-12">
          {s.caller && (
            <span className={`rounded-xs px-2 py-0.5 text-hot shadow-[inset_0_0_0_1px_var(--hot)] ${s.flash === "caller" ? "flash" : ""}`}>
              caller (main) is running #{s.caller.id}
            </span>
          )}
          {s.rejected.slice(-10).map((r) => (
            <span key={r} className="rounded-xs px-1.5 text-dead tabular line-through shadow-[inset_0_0_0_1px_var(--dead)]">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="act solid" onClick={() => setRunning((r) => !r)}>
          {running ? "pause" : s.t ? "resume" : "start arrivals"}
        </button>
        <button className="act" onClick={burst}>
          submit 10 at once
        </button>
        <button className="act" onClick={reset}>
          reset
        </button>
        <span className="ml-auto self-center text-11 text-faint tabular">t = {s.t.toFixed(1)} s</span>
      </div>
      <Narrate min="5.1em">{s.note}</Narrate>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: number; tone?: "live" | "dead" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
}
