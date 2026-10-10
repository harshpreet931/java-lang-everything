"use client";

import { useState, type ReactNode } from "react";
import { Narrate } from "./ui";

// four synchronizers as gates. threads arrive, wait at the gate, and get let through
// according to each one's rule.
//   CountDownLatch(3): opens once the count hits 0, then stays open. one-shot.
//   CyclicBarrier(3):  opens when 3 threads are waiting, lets them all through, resets.
//   Semaphore(2):      a room with 2 permits. acquire takes one, release gives one back.
//   Phaser:            a reusable barrier where parties can register and leave as it runs.

type Kind = "latch" | "barrier" | "semaphore" | "phaser";

export function Gates() {
  const [k, setK] = useState<Kind>("latch");
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1" role="tablist">
        {(
          [
            ["latch", "CountDownLatch"],
            ["barrier", "CyclicBarrier"],
            ["semaphore", "Semaphore"],
            ["phaser", "Phaser"],
          ] as [Kind, string][]
        ).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={k === v} className="word" onClick={() => setK(v)}>
            {l}
          </button>
        ))}
      </div>
      {k === "latch" && <Latch />}
      {k === "barrier" && <Barrier />}
      {k === "semaphore" && <Sem />}
      {k === "phaser" && <Phase />}
    </div>
  );
}

/* ---- shared drawing ------------------------------------------------------- */

function Chip({ n, tone, dashed }: { n: string; tone?: "live" | "hot" | "mute"; dashed?: boolean }) {
  const c = tone === "live" ? "var(--live)" : tone === "hot" ? "var(--hot)" : "var(--mute)";
  return (
    <span
      className="obj-in inline-flex h-7 items-center rounded-xs px-2 text-12"
      style={{ color: c, boxShadow: dashed ? undefined : `inset 0 0 0 1px ${c}`, border: dashed ? "1px dashed var(--line-2)" : undefined }}
    >
      {n}
    </span>
  );
}

function Stage({ left, right, gate, leftTitle, rightTitle }: { left: ReactNode; right: ReactNode; gate: ReactNode; leftTitle: string; rightTitle: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 sm:gap-4">
      <div className="min-w-0">
        <div className="mb-1 text-11 text-faint">{leftTitle}</div>
        <div className="flex min-h-[76px] flex-wrap content-center items-center justify-end gap-1.5 rounded-md p-2" style={{ border: "1px dashed var(--line-2)" }}>
          {left}
        </div>
      </div>
      <div className="flex flex-col items-center justify-end">{gate}</div>
      <div className="min-w-0">
        <div className="mb-1 text-right text-11 text-faint">{rightTitle}</div>
        <div className="flex min-h-[76px] flex-wrap content-center items-center gap-1.5 rounded-md bg-well p-2 shadow-[inset_0_0_0_1px_var(--line)]">{right}</div>
      </div>
    </div>
  );
}

function Gate({ open, big, small }: { open: boolean; big: string; small: string }) {
  return (
    <div
      className="flex min-h-[76px] w-[86px] flex-col items-center justify-center rounded-md bg-well px-2 sm:w-[104px]"
      style={{ boxShadow: `inset 0 0 0 1.5px ${open ? "var(--live)" : "var(--meta)"}` }}
    >
      <span key={big} className="flash text-24 leading-none font-light tabular" style={{ color: open ? "var(--live)" : "var(--hi)" }}>
        {big}
      </span>
      <span className="mt-1 text-center text-[10px] leading-3" style={{ color: open ? "var(--live)" : "var(--meta)" }}>
        {small}
      </span>
    </div>
  );
}

function Controls({ rows }: { rows: { n: string; status: string; buttons: { label: string; on: () => void; disabled?: boolean }[] }[] }) {
  return (
    <div className="mt-5 grid gap-1.5">
      {rows.map((r) => (
        <div key={r.n} className="flex flex-wrap items-center gap-1.5 border-b border-line pb-1.5 text-12">
          <span className="w-[5ch] text-hi">{r.n}</span>
          {r.buttons.map((b) => (
            <button key={b.label} className="act !min-h-7 !px-2" onClick={b.on} disabled={b.disabled}>
              {b.label}
            </button>
          ))}
          <span className="text-faint">{r.status}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- CountDownLatch --------------------------------------------------------- */

function Latch() {
  const init = { count: 3, main: "running" as "running" | "waiting" | "through", done: [false, false, false], note: "new CountDownLatch(3): main will wait for three workers to finish their setup." };
  const [s, setS] = useState(init);
  const open = s.count === 0;
  const countDown = (i: number) =>
    setS((c) => {
      const count = Math.max(0, c.count - 1);
      const done = c.done.map((d, j) => d || j === i);
      const main = count === 0 && c.main === "waiting" ? "through" : c.main;
      return {
        count,
        done,
        main,
        note:
          count === 0
            ? `W${i + 1} counts down to 0. the latch opens${c.main === "waiting" ? " and main is released" : ""}. it never closes again: there's no reset.`
            : `W${i + 1} finishes and calls countDown(): ${c.count} → ${count}. W${i + 1} doesn't wait for anything, it just moves on.`,
      };
    });
  return (
    <div>
      <Stage
        leftTitle="waiting in await()"
        rightTitle="through"
        left={s.main === "waiting" ? <Chip n="main" dashed /> : null}
        right={s.main === "through" ? <Chip n="main" tone="live" /> : null}
        gate={<Gate open={open} big={String(s.count)} small={open ? "open for good" : "count"} />}
      />
      <Controls
        rows={[
          {
            n: "main",
            status: s.main === "waiting" ? "WAITING until the count hits 0" : s.main === "through" ? "through" : "",
            buttons: [
              {
                label: "await()",
                disabled: s.main !== "running",
                on: () =>
                  setS((c) =>
                    c.count === 0
                      ? { ...c, main: "through", note: "the count is already 0, so await() returns immediately. a latch remembers that it's open." }
                      : { ...c, main: "waiting", note: `main calls await() with the count at ${c.count}, and parks.` },
                  ),
              },
            ],
          },
          ...[0, 1, 2].map((i) => ({
            n: `W${i + 1}`,
            status: s.done[i] ? "counted down, moved on" : "doing setup",
            buttons: [{ label: "countDown()", disabled: s.done[i], on: () => countDown(i) }],
          })),
        ]}
      />
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(init)}>
          reset (a real latch can't)
        </button>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}

/* ---- CyclicBarrier ---------------------------------------------------------- */

function Barrier() {
  const init = { waiting: [] as number[], gen: 0, through: [] as number[], note: "new CyclicBarrier(3, () -> merge()): three threads compute a chunk each, then meet before the next round." };
  const [s, setS] = useState(init);
  const arrive = (i: number) =>
    setS((c) => {
      const waiting = [...c.waiting, i];
      if (waiting.length === 3) {
        return {
          waiting: [],
          gen: c.gen + 1,
          through: [0, 1, 2],
          note: `T${i + 1} is the third to arrive. it runs the barrier action (merge()) first, then all three are released together, and the barrier resets for round ${c.gen + 2}.`,
        };
      }
      return { ...c, waiting, through: c.through.filter((x) => x !== i), note: `T${i + 1} arrives and waits. ${3 - waiting.length} more to go. nobody gets past until everyone is here.` };
    });
  return (
    <div>
      <Stage
        leftTitle="waiting in await()"
        rightTitle={`through round ${s.gen}`}
        left={s.waiting.map((i) => (
          <Chip key={i} n={`T${i + 1}`} dashed />
        ))}
        right={s.through.map((i) => (
          <Chip key={i} n={`T${i + 1}`} tone="live" />
        ))}
        gate={<Gate open={false} big={`${s.waiting.length}/3`} small={`round ${s.gen + 1}`} />}
      />
      <Controls
        rows={[0, 1, 2].map((i) => ({
          n: `T${i + 1}`,
          status: s.waiting.includes(i) ? "WAITING at the barrier" : "computing its chunk",
          buttons: [{ label: "await()", disabled: s.waiting.includes(i), on: () => arrive(i) }],
        }))}
      />
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(init)}>
          reset
        </button>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}

/* ---- Semaphore -------------------------------------------------------------- */

function Sem() {
  const init = { permits: 2, inside: [] as number[], queue: [] as number[], note: "new Semaphore(2): at most two threads in the room at once. say, two connections to a slow database." };
  const [s, setS] = useState(init);
  const acquire = (i: number) =>
    setS((c) =>
      c.permits > 0
        ? { ...c, permits: c.permits - 1, inside: [...c.inside, i], note: `T${i + 1} acquires a permit: ${c.permits} → ${c.permits - 1}. it's in.` }
        : { ...c, queue: [...c.queue, i], note: `T${i + 1} calls acquire() with 0 permits left, and parks in line.` },
    );
  const release = (i: number) =>
    setS((c) => {
      const inside = c.inside.filter((x) => x !== i);
      if (c.queue.length) {
        const [next, ...rest] = c.queue;
        return { permits: c.permits, inside: [...inside, next], queue: rest, note: `T${i + 1} releases its permit, and T${next + 1}, first in line, takes it immediately.` };
      }
      return { ...c, inside, permits: c.permits + 1, note: `T${i + 1} releases: ${c.permits} → ${c.permits + 1} permits.` };
    });
  return (
    <div>
      <Stage
        leftTitle="waiting in acquire()"
        rightTitle="holding a permit"
        left={s.queue.map((i) => (
          <Chip key={i} n={`T${i + 1}`} dashed />
        ))}
        right={s.inside.map((i) => (
          <Chip key={i} n={`T${i + 1}`} tone="live" />
        ))}
        gate={<Gate open={s.permits > 0} big={String(s.permits)} small="permits left" />}
      />
      <Controls
        rows={[0, 1, 2, 3].map((i) => {
          const inside = s.inside.includes(i);
          const queued = s.queue.includes(i);
          return {
            n: `T${i + 1}`,
            status: queued ? "WAITING for a permit" : inside ? "inside" : "",
            buttons: [inside ? { label: "release()", on: () => release(i) } : { label: "acquire()", disabled: queued, on: () => acquire(i) }],
          };
        })}
      />
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(init)}>
          reset
        </button>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}

/* ---- Phaser ----------------------------------------------------------------- */

function Phase() {
  const init = {
    phase: 0,
    reg: [true, true, true, false],
    arrived: [] as number[],
    through: [] as number[],
    note: "new Phaser(3): like a barrier, but the number of parties can change between phases.",
  };
  const [s, setS] = useState(init);
  const parties = s.reg.filter(Boolean).length;
  const advance = (c: typeof init, arrived: number[], reg: boolean[], who: string) => {
    const p = reg.filter(Boolean).length;
    if (p === 0) {
      return { ...c, reg, arrived: [], note: `${who}. no registered parties are left, so the phaser terminates: isTerminated() is now true.` };
    }
    if (arrived.length >= p) {
      return {
        ...c,
        reg,
        phase: c.phase + 1,
        arrived: [],
        through: arrived.filter((j) => reg[j]),
        note: `${who}. every registered party has arrived, so phase ${c.phase} is over: they're all released into phase ${c.phase + 1}.`,
      };
    }
    return { ...c, reg, arrived, note: `${who}. ${arrived.length} of ${p} registered parties have arrived at phase ${c.phase}.` };
  };
  return (
    <div>
      <Stage
        leftTitle="waiting to advance"
        rightTitle={`released into phase ${s.phase}`}
        left={s.arrived.map((i) => (
          <Chip key={i} n={`T${i + 1}`} dashed />
        ))}
        right={s.through.map((i) => (
          <Chip key={i} n={`T${i + 1}`} tone="live" />
        ))}
        gate={<Gate open={false} big={`${s.arrived.length}/${parties}`} small={`phase ${s.phase}`} />}
      />
      <Controls
        rows={[0, 1, 2, 3].map((i) => {
          const r = s.reg[i];
          const waiting = s.arrived.includes(i);
          return {
            n: `T${i + 1}`,
            status: !r ? "not registered" : waiting ? "WAITING for the others" : "working",
            buttons: r
              ? [
                  {
                    label: "arriveAndAwaitAdvance()",
                    disabled: waiting,
                    on: () => setS((c) => advance({ ...c, through: c.through.filter((x) => x !== i) }, [...c.arrived, i], c.reg, `T${i + 1} arrives and waits`)),
                  },
                  {
                    label: "arriveAndDeregister()",
                    disabled: waiting,
                    on: () =>
                      setS((c) =>
                        advance(
                          { ...c, through: c.through.filter((x) => x !== i) },
                          c.arrived,
                          c.reg.map((x, j) => (j === i ? false : x)),
                          `T${i + 1} arrives and leaves for good: one fewer party to wait for`,
                        ),
                      ),
                  },
                ]
              : [
                  {
                    label: "register()",
                    on: () =>
                      setS((c) => ({
                        ...c,
                        reg: c.reg.map((x, j) => (j === i ? true : x)),
                        note: `T${i + 1} registers mid-run. from now on, phase ${c.phase} also waits for T${i + 1}.`,
                      })),
                  },
                ],
          };
        })}
      />
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(init)}>
          reset
        </button>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}
