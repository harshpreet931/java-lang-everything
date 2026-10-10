"use client";

import { Fragment, useState } from "react";
import { Narrate, Row, Words } from "./ui";

// a ReentrantLock, opened up: the AQS state int, the owner, and the CLH-style wait queue.
//   lock():   CAS state 0 → 1. fail → append a node at the tail and park.
//   unlock(): state - 1. at 0, unpark the first queued thread. it wakes and tries again.
//   non-fair: anyone calling lock() while the state is 0 can grab it, queue or not (barging).
//   fair:     lock() only grabs a free lock if nobody is queued.
//   tryLock(): grabs it if free (even on a fair lock), never queues.

type Mode = "nonfair" | "fair";
type Where = "free" | "owner" | "queued" | "woken";
type St = { state: number; owner: number | null; queue: number[]; where: Where[]; note: string; barge: number | null };
const NAMES = ["T1", "T2", "T3", "T4"];

const fresh = (): St => ({
  state: 0,
  owner: null,
  queue: [],
  where: ["free", "free", "free", "free"],
  note: "state = 0 means unlocked. state > 0 is the hold count. the queue starts empty (just a dummy head).",
  barge: null,
});

export function AqsQueue() {
  const [mode, setMode] = useState<Mode>("nonfair");
  const [s, setS] = useState<St>(fresh);

  const act = (i: number, a: "lock" | "unlock" | "try" | "wake") =>
    setS((cur) => {
      const where = [...cur.where];
      let { state, owner, queue } = cur;
      queue = [...queue];
      const n = NAMES[i];
      let note = "";
      let barge: number | null = null;

      if (a === "lock" || a === "try") {
        if (owner === i) {
          state += 1;
          note = `${n} already owns it: state ${state - 1} → ${state}. reentrant, no CAS needed, just a plain write by the owner.`;
        } else if (state === 0 && (a === "try" || mode === "nonfair" || queue.length === 0)) {
          const jumped = queue.length > 0 || where.includes("woken");
          state = 1;
          owner = i;
          where[i] = "owner";
          barge = jumped ? i : null;
          note = jumped
            ? `${n} calls ${a === "try" ? "tryLock()" : "lock()"}, sees state 0, and CASes it to 1 before the queued thread wakes up. it jumped the whole queue. that's barging, and it's allowed${a === "try" ? " (tryLock always barges, even on a fair lock)" : " in a non-fair lock"}.`
            : `${n} CASes state 0 → 1 and owns the lock. no queue, no parking, one atomic instruction. this is the fast path.`;
        } else if (a === "try") {
          note = `${n}.tryLock(): the lock is ${state ? "held" : "promised to the queue"}, so it returns false right away. no queueing, no waiting.`;
        } else {
          queue.push(i);
          where[i] = "queued";
          note =
            state === 0
              ? `the lock is free, but this is a fair lock and threads are already queued. ${n} goes to the back of the line and parks.`
              : `${n} CASes state 0 → 1 and fails (it's ${state}). it appends a node at the tail of the queue (one CAS on tail) and parks. no CPU while it waits.`;
        }
      } else if (a === "unlock") {
        state -= 1;
        if (state > 0) {
          note = `${n} unlocks once. state ${state + 1} → ${state}. still the owner.`;
        } else {
          owner = null;
          where[i] = "free";
          const first = queue[0];
          if (first !== undefined && where[first] === "queued") {
            where[first] = "woken";
            note = `state → 0, lock released. ${n} unparks the first queued thread, ${NAMES[first]}. it's awake, but it doesn't own anything yet: it still has to win the CAS.`;
          } else if (first !== undefined) {
            note = `state → 0, lock released. ${NAMES[first]} is already awake and about to retry its CAS.`;
          } else {
            note = `state → 0, lock released. nobody is queued, so nobody to wake.`;
          }
        }
      } else if (a === "wake") {
        if (state === 0) {
          state = 1;
          owner = i;
          where[i] = "owner";
          queue = queue.filter((q) => q !== i);
          note = `${n} wakes up, CASes state 0 → 1, and wins. its node becomes the new head of the queue.`;
        } else {
          where[i] = "queued";
          note = `${n} wakes up and tries the CAS, but ${NAMES[owner!]} grabbed the lock first. back to sleep, still first in line.`;
        }
      }
      return { state, owner, queue, where, note, barge };
    });

  return (
    <div>
      <div className="mb-5 text-13">
        <Row k="new ReentrantLock(" w="19ch">
          <Words
            options={[
              { v: "nonfair", label: "false" },
              { v: "fair", label: "true" },
            ]}
            value={mode}
            onChange={(v) => (setMode(v as Mode), setS(fresh()))}
            label="fairness"
          />
          <span className="text-faint">)</span>
        </Row>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex gap-2 sm:flex-col">
          <Box k="state" v={String(s.state)} tone={s.state ? "meta" : undefined} />
          <Box k="owner" v={s.owner === null ? "null" : NAMES[s.owner]} tone={s.owner === null ? undefined : "live"} flash={s.barge !== null} />
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">wait queue (CLH variant)</div>
          <div className="flex flex-wrap items-center gap-y-3">
            <Node label="head" sub="dummy" dim />
            {s.queue.map((q, j) => (
              <Fragment key={q}>
                <Link />
                <Node
                  label={NAMES[q]}
                  sub={s.where[q] === "woken" ? "unparked" : "parked"}
                  hot={s.where[q] === "woken"}
                  tail={j === s.queue.length - 1}
                />
              </Fragment>
            ))}
            {s.queue.length === 0 && <span className="ml-3 text-11 text-faint">← head is also the tail</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-1.5">
        {NAMES.map((n, i) => {
          const w = s.where[i];
          return (
            <div key={n} className="flex flex-wrap items-center gap-1.5 border-b border-line pb-1.5 text-12">
              <span className="w-[3ch] text-hi">{n}</span>
              {w === "queued" ? (
                <span className="text-faint">parked in the queue (WAITING)</span>
              ) : w === "woken" ? (
                <button className="act !min-h-7 !border-hot !px-2 !text-hot" onClick={() => act(i, "wake")}>
                  wakes up, tries CAS
                </button>
              ) : (
                <>
                  <button className="act !min-h-7 !px-2" onClick={() => act(i, "lock")}>
                    lock()
                  </button>
                  {w !== "owner" && (
                    <button className="act !min-h-7 !px-2" onClick={() => act(i, "try")}>
                      tryLock()
                    </button>
                  )}
                  {w === "owner" && (
                    <button className="act !min-h-7 !px-2" onClick={() => act(i, "unlock")}>
                      unlock()
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={() => setS(fresh())}>
          reset
        </button>
      </div>
      <Narrate min="5.1em">{s.note}</Narrate>
    </div>
  );
}

function Box({ k, v, tone, flash }: { k: string; v: string; tone?: "meta" | "live"; flash?: boolean }) {
  return (
    <div className="flex min-w-[88px] flex-col rounded-md bg-well px-3 py-2" style={{ boxShadow: `inset 0 0 0 1px ${tone ? `var(--${tone})` : "var(--line-2)"}` }}>
      <span className="text-11 text-faint">{k}</span>
      <span key={v} className={`text-15 tabular ${flash ? "flash" : ""}`} style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
}

function Node({ label, sub, dim, hot, tail }: { label: string; sub: string; dim?: boolean; hot?: boolean; tail?: boolean }) {
  return (
    <div className="obj-in flex flex-col items-center">
      <div
        className="flex min-w-[64px] flex-col items-center rounded-md bg-well px-2.5 py-1.5"
        style={{ boxShadow: `inset 0 0 0 1px ${hot ? "var(--hot)" : dim ? "var(--line)" : "var(--line-2)"}` }}
      >
        <span className={`text-12 ${hot ? "text-hot" : dim ? "text-mute" : "text-hi"}`}>{label}</span>
        <span className="text-[10px] leading-3 text-faint">{sub}</span>
      </div>
      <span className="h-3.5 text-[10px] leading-3.5 text-ref">{tail ? "↑ tail" : ""}</span>
    </div>
  );
}

function Link() {
  return (
    <svg width={28} height={12} className="mb-3.5 shrink-0" aria-hidden>
      <path d="M2 6 H22" stroke="var(--ref)" strokeWidth={1.25} />
      <path d="M21 2.5 L26 6 L21 9.5 z" fill="var(--ref)" />
    </svg>
  );
}
