"use client";

import { useState, type ReactNode } from "react";
import { Narrate } from "./ui";

// one object's monitor, drawn as a room with one chair.
//   entry set: threads BLOCKED trying to get in
//   owner:     the one thread inside, with its hold count (reentrancy)
//   wait set:  threads that called wait() and are parked until notified
// with waits={false} the wait()/notify() buttons are hidden (the synchronized chapter).

type Where = "out" | "entry" | "owner" | "wait";
type Th = { name: string; where: Where; holds: number; saved: number; fromWait: boolean };
type St = { th: Th[]; note: string; last: number | null };

const init = (n: number): St => ({
  th: Array.from({ length: n }, (_, i) => ({ name: `T${i + 1}`, where: "out", holds: 0, saved: 0, fromWait: false })),
  note: "nobody owns the monitor. any thread that enters synchronized (lock) gets it straight away.",
  last: null,
});

// hand the monitor to the first thread in the entry set (real JVMs promise no order)
function handOff(th: Th[]): { th: Th[]; msg: string } {
  const next = th.findIndex((t) => t.where === "entry");
  if (next < 0) return { th, msg: " the monitor is free." };
  const t = th[next];
  const restored = t.fromWait ? t.saved : 1;
  const out = th.map((x, i) => (i === next ? { ...x, where: "owner" as Where, holds: restored, saved: 0, fromWait: false } : x));
  return {
    th: out,
    msg: t.fromWait
      ? ` ${t.name} wins it and finally returns from wait(), hold count back to ${restored}.`
      : ` ${t.name} was BLOCKED in the entry set, and gets it now.`,
  };
}

export function MonitorRoom({ threads = 3, waits = true, label = "lock" }: { threads?: number; waits?: boolean; label?: string }) {
  const [s, setS] = useState<St>(() => init(threads));
  const owner = s.th.findIndex((t) => t.where === "owner");

  const act = (i: number, a: "enter" | "exit" | "wait" | "notify" | "notifyAll") => {
    setS((cur) => {
      let th = cur.th.map((t) => ({ ...t }));
      const t = th[i];
      const own = th.findIndex((x) => x.where === "owner");
      let note = "";
      if (a === "enter") {
        if (t.where === "owner") {
          t.holds += 1;
          note = `${t.name} enters synchronized (${label}) again while already inside. it owns the monitor, so it walks straight in: hold count ${t.holds}. that's reentrancy.`;
        } else if (own < 0) {
          t.where = "owner";
          t.holds = 1;
          note = `${t.name} enters synchronized (${label}). the monitor was free, so ${t.name} owns it now, hold count 1.`;
        } else {
          t.where = "entry";
          note = `${t.name} tries to enter, but ${th[own].name} owns the monitor. ${t.name} is BLOCKED in the entry set. it can't do anything else until it gets in.`;
        }
      } else if (a === "exit") {
        t.holds -= 1;
        if (t.holds > 0) {
          note = `${t.name} leaves one synchronized block. hold count ${t.holds}, so it still owns the monitor.`;
        } else {
          t.where = "out";
          const h = handOff(th);
          th = h.th;
          note = `${t.name} leaves its last synchronized block and releases the monitor.${h.msg}`;
        }
      } else if (a === "wait") {
        t.saved = t.holds;
        t.holds = 0;
        t.where = "wait";
        const h = handOff(th);
        th = h.th;
        note = `${t.name} calls ${label}.wait(). it gives up the monitor completely (all ${t.saved} holds) and parks in the wait set.${h.msg}`;
      } else {
        const waiting = th.map((x, j) => (x.where === "wait" ? j : -1)).filter((j) => j >= 0);
        if (!waiting.length) {
          note = `${t.name} calls ${a}(), but the wait set is empty. the notification goes nowhere. it isn't saved for later.`;
        } else {
          const woken = a === "notify" ? [waiting[0]] : waiting;
          for (const j of woken) {
            th[j].where = "entry";
            th[j].fromWait = true;
          }
          const names = woken.map((j) => th[j].name).join(" and ");
          note = `${t.name} calls ${a}(). ${names} ${woken.length > 1 ? "move" : "moves"} from the wait set to the entry set. still BLOCKED: ${t.name} owns the monitor until it exits, and the woken thread has to win it back before wait() returns.`;
        }
      }
      return { th, note, last: i };
    });
  };

  const zone = (w: Where) => s.th.filter((t) => t.where === w);

  return (
    <div>
      <div
        className={`grid gap-3 ${waits ? "grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]" : "grid-cols-2 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1"}`}
      >
        <Zone title="outside" sub="RUNNABLE">
          {zone("out").map((t) => (
            <Chip key={t.name} t={t} last={s.th[s.last ?? -1]?.name === t.name} />
          ))}
        </Zone>
        <Zone title="entry set" sub="BLOCKED" dashed>
          {zone("entry").map((t) => (
            <Chip key={t.name} t={t} tone="blocked" last={s.th[s.last ?? -1]?.name === t.name} />
          ))}
        </Zone>
        <Zone title={`monitor of ${label}`} sub="owner" meta>
          {owner >= 0 ? (
            <div className="flex flex-col items-center gap-1.5">
              <Chip t={s.th[owner]} tone="owner" last={s.last === owner} />
              <span className="text-11 text-meta tabular">hold count {s.th[owner].holds}</span>
            </div>
          ) : (
            <span className="text-12 text-faint">free</span>
          )}
        </Zone>
        {waits ? (
          <Zone title="wait set" sub="WAITING" dashed>
            {zone("wait").map((t) => (
              <Chip key={t.name} t={t} tone="waiting" last={s.th[s.last ?? -1]?.name === t.name} />
            ))}
          </Zone>
        ) : null}
      </div>

      <div className="mt-5 grid gap-1.5">
        {s.th.map((t, i) => {
          const isOwner = t.where === "owner";
          const stuck = t.where === "entry" || t.where === "wait";
          return (
            <div key={t.name} className="flex flex-wrap items-center gap-1.5 border-b border-line pb-1.5 text-12">
              <span className="w-[3ch] text-hi">{t.name}</span>
              {stuck ? (
                <span className="text-12 text-faint">{t.where === "entry" ? "blocked, waiting for the monitor" : "waiting for a notify"}</span>
              ) : (
                <>
                  <button className="act !min-h-7 !px-2" onClick={() => act(i, "enter")}>
                    {isOwner ? "enter again" : `synchronized (${label})`}
                  </button>
                  {isOwner && (
                    <button className="act !min-h-7 !px-2" onClick={() => act(i, "exit")}>
                      exit block
                    </button>
                  )}
                  {isOwner && waits && (
                    <>
                      <button className="act !min-h-7 !px-2" onClick={() => act(i, "wait")}>
                        wait()
                      </button>
                      <button className="act !min-h-7 !px-2" onClick={() => act(i, "notify")}>
                        notify()
                      </button>
                      <button className="act !min-h-7 !px-2" onClick={() => act(i, "notifyAll")}>
                        notifyAll()
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(init(threads))}>
          reset
        </button>
      </div>
      <Narrate min="5.1em">{s.note}</Narrate>
    </div>
  );
}

function Zone({ title, sub, children, dashed, meta }: { title: string; sub: string; children: ReactNode; dashed?: boolean; meta?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-11">
        <span className={meta ? "text-meta" : "text-mute"}>{title}</span>
        <span className="text-faint">{sub}</span>
      </div>
      <div
        className="flex min-h-[92px] flex-1 flex-wrap content-center items-center justify-center gap-1.5 rounded-md bg-well p-2.5"
        style={{
          boxShadow: dashed ? undefined : `inset 0 0 0 1px ${meta ? "var(--meta)" : "var(--line)"}`,
          border: dashed ? "1px dashed var(--line-2)" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ t, tone, last }: { t: Th; tone?: "owner" | "blocked" | "waiting"; last?: boolean }) {
  const color = tone === "owner" ? "var(--live)" : tone ? "var(--mute)" : "var(--ink)";
  return (
    <span
      key={`${t.name}-${t.where}`}
      className={`obj-in inline-flex h-7 min-w-[4ch] items-center justify-center rounded-xs px-2 text-12 ${last ? "flash" : ""}`}
      style={{
        color,
        boxShadow: tone === "blocked" || tone === "waiting" ? undefined : `inset 0 0 0 1px ${tone === "owner" ? "var(--live)" : "var(--line-2)"}`,
        border: tone === "blocked" || tone === "waiting" ? "1px dashed var(--line-2)" : undefined,
        background: tone === "owner" ? "color-mix(in srgb, var(--live) 10%, transparent)" : undefined,
      }}
    >
      {t.name}
    </span>
  );
}
