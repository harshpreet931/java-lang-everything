"use client";

import { useRef, useState } from "react";
import { Narrate, Row, Words, useTicker } from "./ui";

// virtual threads on carrier threads, one tick at a time.
// each virtual thread alternates a little CPU work with a blocking call (I/O, sleep).
// when it blocks, it unmounts: its stack frames are copied to the heap as a stack chunk,
// and the carrier picks up the next runnable virtual thread. when the I/O completes,
// the virtual thread is runnable again and will mount on whichever carrier is free.
// "pinned" shows the old (java 21-23) synchronized behaviour: blocking inside synchronized
// kept the virtual thread mounted, so the carrier was stuck too.

type Phase = { cpu: number } | { io: number };
type VT = { id: number; prog: Phase[]; pc: number; left: number; where: "queue" | "mounted" | "parked" | "done"; depth: number };
type St = { vts: VT[]; carriers: (number | null)[]; queue: number[]; tick: number; busy: number; slots: number; note: string };

const PROGS: Phase[][] = [
  [{ cpu: 1 }, { io: 4 }, { cpu: 1 }, { io: 3 }, { cpu: 1 }],
  [{ cpu: 1 }, { io: 3 }, { cpu: 2 }, { io: 4 }, { cpu: 1 }],
  [{ cpu: 2 }, { io: 5 }, { cpu: 1 }],
  [{ cpu: 1 }, { io: 2 }, { cpu: 1 }, { io: 5 }, { cpu: 1 }],
  [{ cpu: 1 }, { io: 6 }, { cpu: 1 }],
  [{ cpu: 1 }, { io: 3 }, { cpu: 1 }, { io: 3 }, { cpu: 1 }],
  [{ cpu: 2 }, { io: 4 }, { cpu: 1 }],
  [{ cpu: 1 }, { io: 5 }, { cpu: 2 }],
];

const fresh = (carriers: number): St => ({
  vts: PROGS.map((p, i) => ({ id: i, prog: p, pc: 0, left: "cpu" in p[0] ? p[0].cpu : 0, where: "queue", depth: 2 })),
  carriers: Array(carriers).fill(null),
  queue: PROGS.map((_, i) => i),
  tick: 0,
  busy: 0,
  slots: 0,
  note: `8 virtual threads are ready to run. there are ${carriers} carrier threads: real platform threads in a ForkJoinPool, about one per core.`,
});

const isCpu = (p: Phase): p is { cpu: number } => "cpu" in p;

function tick(s: St, pinned: boolean): St {
  const vts = s.vts.map((v) => ({ ...v }));
  const carriers = [...s.carriers];
  let queue = [...s.queue];
  const notes: string[] = [];
  let busy = s.busy;

  // 1. parked threads: I/O counts down; when done they become runnable again
  for (const v of vts) {
    if (v.where !== "parked") continue;
    v.left -= 1;
    if (v.left <= 0) {
      v.pc += 1;
      const ph = v.prog[v.pc];
      v.left = ph && isCpu(ph) ? ph.cpu : 0;
      v.where = "queue";
      queue.push(v.id);
      notes.push(`vt-${v.id}'s I/O completed. it's runnable again and joins the queue. its stack is still on the heap until it mounts.`);
    }
  }

  // 2. carriers run their mounted thread for one tick
  carriers.forEach((c, ci) => {
    if (c === null) return;
    const v = vts[c];
    const ph = v.prog[v.pc];
    if (isCpu(ph)) {
      busy += 1;
      v.left -= 1;
      if (v.left > 0) return;
      v.pc += 1;
      const next = v.prog[v.pc];
      if (!next) {
        v.where = "done";
        carriers[ci] = null;
        notes.push(`vt-${v.id} finishes and is gone. carrier ${ci} is free.`);
      } else if (!isCpu(next)) {
        v.left = next.io;
        if (pinned) {
          notes.push(`vt-${v.id} blocks inside synchronized. pinned: it can't unmount, so carrier ${ci} is blocked with it, doing nothing, for ${next.io} ticks.`);
        } else {
          v.where = "parked";
          v.depth = 2 + v.pc;
          carriers[ci] = null;
          notes.push(`vt-${v.id} makes a blocking call. it unmounts: its ${v.depth} stack frames are copied to the heap, and carrier ${ci} is free for someone else.`);
        }
      } else {
        v.left = next.cpu;
      }
    } else if (pinned) {
      // pinned and blocked: the carrier just waits
      v.left -= 1;
      if (v.left <= 0) {
        v.pc += 1;
        const n2 = v.prog[v.pc];
        v.left = n2 && isCpu(n2) ? n2.cpu : 0;
        if (!n2) {
          v.where = "done";
          carriers[ci] = null;
        }
      }
    }
  });

  // 3. free carriers mount the next runnable virtual thread
  carriers.forEach((c, ci) => {
    if (c !== null || !queue.length) return;
    const id = queue[0];
    queue = queue.slice(1);
    vts[id].where = "mounted";
    carriers[ci] = id;
    if (notes.length < 2) notes.push(`carrier ${ci} mounts vt-${id}: its frames are copied back from the heap onto the carrier's stack, and it continues where it left off.`);
  });

  const done = vts.every((v) => v.where === "done");
  return {
    vts,
    carriers,
    queue,
    tick: s.tick + 1,
    busy,
    slots: s.slots + carriers.length,
    note: done
      ? `all 8 done in ${s.tick + 1} ticks, on ${carriers.length} carrier thread${carriers.length > 1 ? "s" : ""}.${pinned ? " pinning wasted carrier time on blocked threads." : ""}`
      : (notes[0] ?? s.note),
  };
}

export function MountSim() {
  const [n, setN] = useState(2);
  const [pinned, setPinned] = useState(false);
  const [s, setS] = useState<St>(() => fresh(2));
  const [running, setRunning] = useState(false);
  const pRef = useRef(pinned);
  pRef.current = pinned;
  const finished = s.vts.every((v) => v.where === "done");

  const ref = useTicker(running && !finished, 750, () => setS((cur) => tick(cur, pRef.current)));
  const reset = (nn = n, p = pinned) => {
    setRunning(false);
    setN(nn);
    setPinned(p);
    setS(fresh(nn));
  };

  const parked = s.vts.filter((v) => v.where === "parked");
  const util = s.slots ? Math.round((s.busy / s.slots) * 100) : 0;

  return (
    <div ref={ref}>
      <div className="mb-4 text-13">
        <Row k="carriers =" w="13ch">
          <Words options={[1, 2, 4]} value={n} onChange={(v) => reset(v, pinned)} label="carrier threads" />
        </Row>
        <Row k="blocking in =" w="13ch">
          <Words
            options={[
              { v: "free", label: "plain code" },
              { v: "pinned", label: "synchronized, java 21-23 (pinned)" },
            ]}
            value={pinned ? "pinned" : "free"}
            onChange={(v) => reset(n, v === "pinned")}
            label="pinning"
          />
        </Row>
      </div>

      <div className="mb-1.5 text-11 text-faint">carrier threads (platform threads, one per core)</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(n, 4)}, minmax(0, 1fr))` }}>
        {s.carriers.map((c, ci) => {
          const v = c === null ? null : s.vts[c];
          const ph = v ? v.prog[v.pc] : null;
          const blocked = !!v && !!ph && !isCpu(ph);
          return (
            <div
              key={ci}
              className="flex min-h-[92px] min-w-0 flex-col rounded-md bg-well px-2.5 py-2"
              style={{ boxShadow: `inset 0 0 0 1px ${blocked ? "var(--dead)" : v ? "var(--live)" : "var(--line-2)"}` }}
            >
              <span className="text-11 text-faint">carrier {ci}</span>
              {v ? (
                <>
                  <span className="mt-1 text-13" style={{ color: blocked ? "var(--dead)" : "var(--live)" }}>
                    vt-{v.id}
                  </span>
                  <span className="text-[10px] leading-3" style={{ color: blocked ? "var(--dead)" : "var(--faint)" }}>
                    {blocked ? "pinned, blocked" : "running"}
                  </span>
                  <span className="mt-1.5 flex gap-0.5" aria-hidden>
                    {Array.from({ length: v.depth }, (_, k) => (
                      <span key={k} className="h-1.5 w-3 rounded-[1px]" style={{ background: blocked ? "var(--dead)" : "var(--live)", opacity: 0.35 + k * 0.12 }} />
                    ))}
                  </span>
                </>
              ) : (
                <span className="mt-1 text-12 text-faint">free</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">scheduler queue (runnable, waiting for a carrier)</div>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5" style={{ border: "1px dashed var(--line-2)" }}>
            {s.queue.map((id) => (
              <span key={id} className="obj-in rounded-xs px-1.5 py-0.5 text-12 text-hi shadow-[inset_0_0_0_1px_var(--ink)]">
                vt-{id}
              </span>
            ))}
            {!s.queue.length && <span className="text-11 text-faint">empty</span>}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">heap: unmounted, blocked on I/O</div>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md bg-well px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--line)]">
            {parked.map((v) => (
              <span key={v.id} className="obj-in inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-12 text-mute" style={{ border: "1px dashed var(--line-2)" }}>
                vt-{v.id}
                <span className="text-[10px] text-ref">stack chunk ×{v.depth}</span>
                <span className="text-[10px] text-faint tabular">{v.left}</span>
              </span>
            ))}
            {!parked.length && <span className="text-11 text-faint">nobody blocked</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-x-6 text-12">
        <Stat k="tick" v={String(s.tick)} />
        <Stat k="done" v={`${s.vts.filter((v) => v.where === "done").length}/8`} tone={finished ? "live" : undefined} />
        <Stat k="carriers busy" v={`${util}%`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="act solid" onClick={() => setRunning((r) => !r)} disabled={finished}>
          {running && !finished ? "pause" : "run"}
        </button>
        <button className="act" onClick={() => setS((cur) => tick(cur, pinned))} disabled={running || finished}>
          one tick
        </button>
        <button className="act" onClick={() => reset()}>
          reset
        </button>
      </div>
      <Narrate min="5.1em">{s.note}</Narrate>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "live" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
}
