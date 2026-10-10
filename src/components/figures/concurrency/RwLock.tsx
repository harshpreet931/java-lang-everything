"use client";

import { useState } from "react";
import { Narrate } from "./ui";

// ReentrantReadWriteLock (non-fair), simplified: many readers or one writer.
// a reader that arrives while a writer is first in the queue waits behind it,
// so a steady stream of readers can't starve the writer forever.
// when the lock frees up, the head of the queue is let in (a writer alone, or a run of readers).

type Who = { name: string; kind: "R" | "W" };
type Where = "out" | "in" | "queued";
type St = { where: Where[]; queue: number[]; note: string };

const WHO: Who[] = [
  { name: "R1", kind: "R" },
  { name: "R2", kind: "R" },
  { name: "R3", kind: "R" },
  { name: "W", kind: "W" },
];

const fresh = (): St => ({ where: ["out", "out", "out", "out"], queue: [], note: "readers share the lock. the writer needs it alone." });

function grant(where: Where[], queue: number[]): { where: Where[]; queue: number[]; let: string[] } {
  const w = [...where];
  const q = [...queue];
  const inside = w.map((x, i) => (x === "in" ? i : -1)).filter((i) => i >= 0);
  const writerIn = inside.some((i) => WHO[i].kind === "W");
  const readersIn = inside.length > 0 && !writerIn;
  const let_: string[] = [];
  if (!q.length || writerIn) return { where: w, queue: q, let: let_ };
  if (WHO[q[0]].kind === "W") {
    if (!readersIn) {
      const x = q.shift()!;
      w[x] = "in";
      let_.push(WHO[x].name);
    }
  } else {
    while (q.length && WHO[q[0]].kind === "R") {
      const x = q.shift()!;
      w[x] = "in";
      let_.push(WHO[x].name);
    }
  }
  return { where: w, queue: q, let: let_ };
}

export function RwLock() {
  const [s, setS] = useState<St>(fresh);

  const act = (i: number) =>
    setS((cur) => {
      let where = [...cur.where];
      let queue = [...cur.queue];
      const me = WHO[i];
      const inside = where.map((x, j) => (x === "in" ? j : -1)).filter((j) => j >= 0);
      const writerIn = inside.some((j) => WHO[j].kind === "W");
      let note = "";
      if (where[i] === "in") {
        where[i] = "out";
        const g = grant(where, queue);
        where = g.where;
        queue = g.queue;
        note = `${me.name} unlocks.${g.let.length ? ` ${g.let.join(", ")} ${g.let.length > 1 ? "get" : "gets"} in from the queue.` : ""}`;
      } else if (me.kind === "R") {
        const writerFirst = queue.length > 0 && WHO[queue[0]].kind === "W";
        if (writerIn || writerFirst) {
          queue.push(i);
          where[i] = "queued";
          note = writerIn
            ? `${me.name} wants to read, but the writer is inside. it queues.`
            : `${me.name} could share with the readers inside, but a writer is first in line. it queues behind the writer, so the writer can't be starved by a stream of readers.`;
        } else {
          where[i] = "in";
          note = inside.length
            ? `${me.name} gets a read lock alongside ${inside.map((j) => WHO[j].name).join(", ")}. readers don't block readers.`
            : `${me.name} takes a read lock.`;
        }
      } else {
        if (inside.length) {
          queue.push(i);
          where[i] = "queued";
          note = `the writer needs the lock to itself, and ${inside.map((j) => WHO[j].name).join(", ")} ${inside.length > 1 ? "are" : "is"} reading. it queues until every reader leaves.`;
        } else {
          where[i] = "in";
          note = "the writer takes the write lock. nobody else, reader or writer, gets in until it unlocks.";
        }
      }
      return { where, queue, note };
    });

  const inside = s.where.map((x, i) => (x === "in" ? i : -1)).filter((i) => i >= 0);
  const writerIn = inside.some((i) => WHO[i].kind === "W");

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex justify-between text-11">
            <span className="text-meta">holding the lock</span>
            <span className="text-faint">{writerIn ? "write mode: exclusive" : inside.length ? `read mode: ${inside.length} shared` : "free"}</span>
          </div>
          <div
            className="flex min-h-[64px] flex-wrap items-center justify-center gap-1.5 rounded-md bg-well p-2.5"
            style={{ boxShadow: "inset 0 0 0 1px var(--meta)" }}
          >
            {inside.map((i) => (
              <Chip key={i} w={WHO[i]} tone="live" />
            ))}
            {!inside.length && <span className="text-12 text-faint">nobody</span>}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-11 text-faint">queue (first on the left)</div>
          <div className="flex min-h-[64px] flex-wrap items-center gap-1.5 rounded-xs p-2.5" style={{ border: "1px dashed var(--line-2)" }}>
            {s.queue.map((i) => (
              <Chip key={i} w={WHO[i]} dashed />
            ))}
            {!s.queue.length && <span className="text-12 text-faint">empty</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {WHO.map((w, i) => (
          <button key={w.name} className="act !px-2.5" onClick={() => act(i)} disabled={s.where[i] === "queued"}>
            {w.name}.{s.where[i] === "in" ? "unlock()" : w.kind === "R" ? "readLock()" : "writeLock()"}
          </button>
        ))}
        <button className="word ml-auto !text-12" onClick={() => setS(fresh())}>
          reset
        </button>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}

function Chip({ w, tone, dashed }: { w: Who; tone?: "live"; dashed?: boolean }) {
  return (
    <span
      className="obj-in inline-flex h-7 items-center rounded-xs px-2 text-12"
      style={{
        color: tone ? "var(--live)" : "var(--mute)",
        boxShadow: dashed ? undefined : `inset 0 0 0 1px ${tone ? "var(--live)" : "var(--line-2)"}`,
        border: dashed ? "1px dashed var(--line-2)" : undefined,
      }}
    >
      {w.name}
      <span className="ml-1.5 text-[10px] opacity-70">{w.kind === "R" ? "read" : "write"}</span>
    </span>
  );
}
