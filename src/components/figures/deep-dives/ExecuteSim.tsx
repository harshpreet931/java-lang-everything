"use client";

import { useState } from "react";
import { Narration } from "./kit";

// a ThreadPoolExecutor(core = 2, max = 4, keepAlive = 60s, ArrayBlockingQueue(2)), driven
// by the same three steps as execute() in jdk 25:
//   1. fewer than corePoolSize workers → addWorker(task, core = true)
//   2. else queue.offer(task) succeeds → queued
//   3. else addWorker(task, core = false) while under maximumPoolSize, else reject
// a finished worker calls getTask(): take from the queue, or wait. workers aren't marked
// core or non-core: whenever there are more than corePoolSize, any idle one may time out.
// checked against a real run: tasks 1-2 start threads, 3-4 queue, 5-6 start threads, 7 is rejected.

const CORE = 2;
const MAX = 4;
const CAP = 2;

type W = { id: number; task: number | null };
type St = { workers: W[]; queue: number[]; next: number; nextW: number; step: 0 | 1 | 2 | 3 | 4; note: string; rejected: number[] };

const INIT: St = { workers: [], queue: [], next: 1, nextW: 1, step: 0, rejected: [], note: "an empty pool: core 2, max 4, a queue that holds 2. no threads exist yet, they're created on demand." };

export function ExecuteSim() {
  const [st, setSt] = useState<St>(INIT);

  const execute = () =>
    setSt((s) => {
      const t = s.next;
      if (s.workers.length < CORE) {
        return {
          ...s,
          next: t + 1,
          nextW: s.nextW + 1,
          workers: [...s.workers, { id: s.nextW, task: t }],
          step: 1,
          note: `task ${t}: ${s.workers.length} workers < corePoolSize ${CORE}, so addWorker(task, true) starts a new thread with task ${t} as its first task. it never touches the queue.`,
        };
      }
      const idle = s.workers.find((w) => w.task === null);
      if (s.queue.length < CAP) {
        // an idle worker blocked in take() grabs it straight away
        if (idle && s.queue.length === 0) {
          return {
            ...s,
            next: t + 1,
            workers: s.workers.map((w) => (w === idle ? { ...w, task: t } : w)),
            step: 2,
            note: `task ${t}: the pool already has ${CORE}+ workers, so the task is offered to the queue. worker ${idle.id} was idle, blocked in take(), and picks it up at once.`,
          };
        }
        return {
          ...s,
          next: t + 1,
          queue: [...s.queue, t],
          step: 2,
          note: `task ${t}: at corePoolSize, so queue.offer(task). accepted, ${s.queue.length + 1} of ${CAP} slots used. no new thread: a pool only grows past core when the queue is full.`,
        };
      }
      if (s.workers.length < MAX) {
        return {
          ...s,
          next: t + 1,
          nextW: s.nextW + 1,
          workers: [...s.workers, { id: s.nextW, task: t }],
          step: 3,
          note: `task ${t}: the queue is full, so addWorker(task, false) starts thread ${s.workers.length + 1} of ${MAX}. notice task ${t} runs before the queued ones: it jumped the line.`,
        };
      }
      return {
        ...s,
        next: t + 1,
        rejected: [...s.rejected, t],
        step: 4,
        note: `task ${t}: ${MAX} workers and a full queue. the RejectedExecutionHandler runs; the default, AbortPolicy, throws RejectedExecutionException.`,
      };
    });

  const finish = () =>
    setSt((s) => {
      const busy = s.workers.find((w) => w.task !== null);
      if (!busy) return { ...s, step: 0, note: "nobody is busy. every worker is parked in getTask()." };
      const [head, ...rest] = s.queue;
      if (head !== undefined) {
        return {
          ...s,
          queue: rest,
          workers: s.workers.map((w) => (w === busy ? { ...w, task: head } : w)),
          step: 0,
          note: `worker ${busy.id} finished task ${busy.task}, looped back into getTask(), and took task ${head} off the head of the queue.`,
        };
      }
      return {
        ...s,
        workers: s.workers.map((w) => (w === busy ? { ...w, task: null } : w)),
        step: 0,
        note:
          s.workers.length > CORE
            ? `worker ${busy.id} finished task ${busy.task}. the queue is empty, and with ${s.workers.length} workers > core it waits in poll(60 s) instead of take(): if nothing arrives, it exits.`
            : `worker ${busy.id} finished task ${busy.task}. queue empty, so it blocks in take() and waits. core workers don't time out (unless allowCoreThreadTimeOut).`,
      };
    });

  const timeout = () =>
    setSt((s) => {
      let n = s.workers.length;
      const keep = s.workers.filter((w) => {
        if (w.task === null && n > CORE) {
          n--;
          return false;
        }
        return true;
      });
      const died = s.workers.length - keep.length;
      return {
        ...s,
        workers: keep,
        step: 0,
        note: died
          ? `60 s pass with nothing to do. ${died} idle worker${died > 1 ? "s" : ""} timed out in poll() and exited, until the pool was back at corePoolSize. which ones die is whoever times out first, not "the extra ones": workers aren't labelled core.`
          : "60 s pass. nobody can time out: either everyone is busy, or the pool is already at corePoolSize.",
      };
    });

  const steps = [
    { n: 1, label: "workers < corePoolSize → new thread", tone: "live" },
    { n: 2, label: "queue.offer(task) → queued", tone: "live" },
    { n: 3, label: "workers < maximumPoolSize → new thread", tone: "live" },
    { n: 4, label: "reject", tone: "dead" },
  ] as const;

  return (
    <div className="@container text-13">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="act solid" onClick={execute}>
          execute(task {st.next})
        </button>
        <button className="act" onClick={finish}>
          a task finishes
        </button>
        <button className="act" onClick={timeout}>
          60 s pass
        </button>
        <button className="act ml-auto" onClick={() => setSt(INIT)}>
          reset
        </button>
      </div>

      <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-1.5 flex justify-between text-11 text-faint">
            <span>workers</span>
            <span className="tabular">
              {st.workers.length} / max {MAX} · core {CORE}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: MAX }, (_, i) => {
              const w = st.workers[i];
              return (
                <div
                  key={i}
                  className={`flex h-16 flex-col items-center justify-center rounded-md text-11 ${w ? "obj-in bg-bg" : ""}`}
                  style={{ boxShadow: `inset 0 0 0 1px ${w ? (w.task ? "var(--meta)" : "var(--line-2)") : "var(--line)"}`, borderStyle: "dashed" }}
                >
                  {w ? (
                    <>
                      <span className="text-meta">thread {w.id}</span>
                      <span className={w.task ? "text-hi" : "text-faint"}>{w.task ? `task ${w.task}` : "idle"}</span>
                    </>
                  ) : (
                    <span className="text-faint">{i < CORE ? "·" : "·"}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 mb-1.5 flex justify-between text-11 text-faint">
            <span>workQueue · ArrayBlockingQueue({CAP})</span>
            {st.rejected.length > 0 && <span className="text-dead">rejected: {st.rejected.join(", ")}</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: CAP }, (_, i) => {
              const t = st.queue[i];
              return (
                <div
                  key={i}
                  className="flex h-9 items-center justify-center rounded-md text-11"
                  style={{ boxShadow: `inset 0 0 0 1px ${t ? "var(--line-2)" : "var(--line)"}`, background: t ? "var(--bg)" : undefined }}
                >
                  {t ? <span className="obj-in text-hi">task {t}</span> : <span className="text-faint">empty</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-11 text-faint">execute(), the three steps</div>
          <ol className="grid gap-1.5">
            {steps.map((x) => {
              const on = st.step === x.n;
              return (
                <li
                  key={x.n}
                  className="flex items-baseline gap-2 rounded-md px-2.5 py-1.5 text-12 transition-[box-shadow,background-color] duration-200"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${on ? `var(--${x.tone})` : "var(--line)"}`,
                    background: on ? `color-mix(in srgb, var(--${x.tone}) 10%, transparent)` : undefined,
                  }}
                >
                  <span className="text-faint tabular">{x.n === 4 ? "×" : x.n}</span>
                  <span style={{ color: on ? `var(--${x.tone})` : "var(--ink)" }}>{x.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <Narration className="mt-4">{st.note}</Narration>
    </div>
  );
}
