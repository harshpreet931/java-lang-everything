"use client";

import { useState } from "react";
import { Narrate, Row, Words } from "./ui";

// a bounded buffer guarded by one monitor, with wait()/notify().
// each button is one whole synchronized call (the monitor is free between clicks).
// toggle `if` vs `while` and notify vs notifyAll to break it in the two classic ways.

type Kind = "P" | "C";
type State = "idle" | "waiting" | "woken";
type Th = { name: string; kind: Kind; state: State; since: number };
type St = { items: number[]; next: number; th: Th[]; note: string; err: string | null; lastAct: number; clock: number };

const fresh = (): St => ({
  items: [],
  next: 1,
  th: [
    { name: "P1", kind: "P", state: "idle", since: 0 },
    { name: "P2", kind: "P", state: "idle", since: 0 },
    { name: "C1", kind: "C", state: "idle", since: 0 },
    { name: "C2", kind: "C", state: "idle", since: 0 },
  ],
  note: "empty buffer, nobody waiting. producers call put(), consumers call take().",
  err: null,
  lastAct: -1,
  clock: 0,
});

export function BoundedBuffer() {
  const [guard, setGuard] = useState<"while" | "if">("while");
  const [wake, setWake] = useState<"notifyAll" | "notify">("notifyAll");
  const [cap, setCap] = useState(2);
  const [s, setS] = useState<St>(fresh);

  const restart = () => setS(fresh());

  const act = (i: number) =>
    setS((cur) => {
      if (cur.err) return cur;
      const th = cur.th.map((t) => ({ ...t }));
      const t = th[i];
      let items = [...cur.items];
      let next = cur.next;
      let note = "";
      let err: string | null = null;
      const recheck = t.state === "woken";
      const blocked = t.kind === "P" ? items.length >= cap : items.length === 0;
      const cond = t.kind === "P" ? "full" : "empty";

      // `if` only checks the condition on the way in, never after waking up
      const mustWait = recheck ? guard === "while" && blocked : blocked;

      const clock = cur.clock + 1;
      if (mustWait) {
        t.state = "waiting";
        t.since = clock;
        note = recheck
          ? `${t.name} wakes up, re-checks the while loop: still ${cond}. back to wait(). no harm done, that's what the loop is for.`
          : `${t.name} calls ${t.kind === "P" ? "put()" : "take()"}: the buffer is ${cond}, so it calls wait(). it releases the monitor and parks in the wait set.`;
      } else {
        if (t.kind === "P") {
          items.push(next);
          if (items.length > cap) err = `${t.name} added item ${next} to a full buffer: ${items.length} items in a ${cap}-slot buffer. with if instead of while, it never re-checked after waking up.`;
          note = `${t.name} puts item ${next}.`;
          next += 1;
        } else {
          if (!items.length) {
            err = `${t.name} calls removeFirst() on an empty buffer: NoSuchElementException. with if instead of while, it never re-checked after waking up, and someone else got there first.`;
          } else {
            const x = items.shift();
            note = `${t.name} takes item ${x}.`;
          }
        }
        t.state = "idle";
        if (!err) {
          // notify() wakes the longest waiter here. the spec only promises "some" waiter.
          const waiting = th
            .map((x, j) => (x.state === "waiting" ? j : -1))
            .filter((j) => j >= 0)
            .sort((a, b) => th[a].since - th[b].since);
          if (waiting.length) {
            const woken = wake === "notifyAll" ? waiting : [waiting[0]];
            woken.forEach((j) => (th[j].state = "woken"));
            const names = woken.map((j) => th[j].name).join(", ");
            note += ` then ${wake}() wakes ${names}${wake === "notify" ? " (just one, and the JVM picks which)" : ""}.`;
          } else {
            note += ` then ${wake}(), but nobody is waiting.`;
          }
        }
      }

      if (!err && th.every((x) => x.state === "waiting")) {
        err =
          "all four threads are WAITING, and the only way out of wait() is a notify from a thread that isn't waiting. there isn't one. the program hangs forever, with no exception and no CPU use.";
      }
      return { items, next, th, note, err, lastAct: i, clock };
    });

  return (
    <div>
      <div className="mb-5 text-13">
        <Row k="loop =" w="10ch">
          <Words options={["while", "if"] as const} value={guard} onChange={(v) => (setGuard(v), restart())} label="guard" />
        </Row>
        <Row k="wake =" w="10ch">
          <Words options={["notifyAll", "notify"] as const} value={wake} onChange={(v) => (setWake(v), restart())} label="wake" />
        </Row>
        <Row k="capacity =" w="10ch">
          <Words options={[1, 2, 3]} value={cap} onChange={(v) => (setCap(v), restart())} label="capacity" />
        </Row>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre text-mute shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="text-ink">{"synchronized void put(T x) {\n"}</span>
          {"    "}
          <span className={guard === "if" ? "text-dead" : "text-hot"}>{guard}</span>
          {" (full) wait();\n"}
          {"    items.add(x);\n    "}
          <span className={wake === "notify" ? "text-dead" : "text-hot"}>{wake}</span>
          {"();\n}\n"}
          <span className="text-ink">{"synchronized T take() {\n"}</span>
          {"    "}
          <span className={guard === "if" ? "text-dead" : "text-hot"}>{guard}</span>
          {" (empty) wait();\n"}
          {"    T x = items.removeFirst();\n    "}
          <span className={wake === "notify" ? "text-dead" : "text-hot"}>{wake}</span>
          {"();\n    return x;\n}"}
        </pre>

        <div className="min-w-0">
          <div className="mb-1.5 flex justify-between text-11 text-faint">
            <span>buffer</span>
            <span className="tabular">
              {s.items.length}/{cap}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.max(cap, s.items.length) }, (_, j) => {
              const x = s.items[j];
              const over = j >= cap;
              return (
                <span
                  key={j}
                  className={`flex h-10 w-12 items-center justify-center rounded-xs text-13 tabular ${x !== undefined ? "obj-in" : ""}`}
                  style={{
                    color: over ? "var(--dead)" : x !== undefined ? "var(--hi)" : "var(--faint)",
                    boxShadow: `inset 0 0 0 1px ${over ? "var(--dead)" : x !== undefined ? "var(--ink)" : "var(--line-2)"}`,
                    background: over ? "color-mix(in srgb, var(--dead) 12%, transparent)" : undefined,
                  }}
                >
                  {x ?? "·"}
                </span>
              );
            })}
          </div>
          <div className="mt-4 mb-1.5 text-11 text-faint">wait set</div>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xs px-2 py-1.5" style={{ border: "1px dashed var(--line-2)" }}>
            {s.th.filter((t) => t.state === "waiting").map((t) => (
              <span key={t.name} className="obj-in rounded-xs px-2 py-0.5 text-12 text-mute" style={{ border: "1px dashed var(--line-2)" }}>
                {t.name}
              </span>
            ))}
            {!s.th.some((t) => t.state === "waiting") && <span className="text-11 text-faint">empty</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-1.5">
        {s.th.map((t, i) => (
          <div key={t.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-1.5 text-12">
            <span className="w-[3ch] text-hi">{t.name}</span>
            {t.state === "waiting" ? (
              <span className="text-faint">WAITING in the wait set</span>
            ) : (
              <button className={`act !min-h-7 !px-2 ${t.state === "woken" ? "!border-hot !text-hot" : ""}`} onClick={() => act(i)} disabled={!!s.err}>
                {t.state === "woken"
                  ? guard === "while"
                    ? "woken: re-check the loop"
                    : "woken: carry on"
                  : t.kind === "P"
                    ? "put()"
                    : "take()"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button className="word !text-12" onClick={restart}>
          reset
        </button>
      </div>
      <Narrate min="5.1em">{s.err ? <span className="text-dead">{s.err}</span> : s.note}</Narrate>
    </div>
  );
}
