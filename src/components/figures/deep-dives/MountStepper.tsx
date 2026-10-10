"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration } from "./kit";

// virtual threads on two carriers, following java.lang.VirtualThread in jdk 25:
// a vthread runs inside a Continuation mounted on a carrier (a ForkJoinPool worker).
// park() → yieldContinuation(): the frames are frozen into a jdk.internal.vm.StackChunk
// on the heap and the carrier is free. unpark → the vthread is resubmitted to the
// scheduler and any carrier can thaw it. measured on jdk 25 (jcmd GC.class_histogram, 10,000
// parked vthreads): a StackChunk was 1.3 KB with a shallow stack, 1.4 KB at 10 extra frames,
// 3.1 KB at 100 (compiled frames).

type V = "V1" | "V2" | "V3";
type S = {
  carriers: [V | null, V | null];
  queue: V[];
  chunks: V[];
  pinned?: V;
  frames: Record<V, string[]>;
  hot?: V;
  note: string;
};

const F = {
  V1: ["run()", "handle(req)", "socket.read()"],
  V2: ["run()", "handle(req)", "db.query()"],
  V3: ["run()", "handle(req)", "render()"],
};

const STEPS: S[] = [
  { carriers: [null, null], queue: ["V1", "V2", "V3"], chunks: [], frames: F, note: "three virtual threads started. each is a Continuation plus some bookkeeping, waiting in the scheduler's queue. two carrier threads, the platform threads of a ForkJoinPool." },
  { carriers: ["V1", "V2"], queue: ["V3"], chunks: [], frames: F, hot: "V1", note: "mount: a carrier takes V1 off the queue and runs its continuation. V1's frames now live on the carrier's own stack, exactly like a normal thread's." },
  {
    carriers: [null, "V2"],
    queue: ["V3"],
    chunks: ["V1"],
    frames: F,
    hot: "V1",
    note: "V1 blocks on socket.read(). instead of blocking the carrier, park() yields the continuation: V1's frames are copied (frozen) into a StackChunk object on the heap, and the carrier is free.",
  },
  { carriers: ["V3", "V2"], queue: [], chunks: ["V1"], frames: F, hot: "V3", note: "carrier 1 immediately mounts V3. one OS thread, and it's already on its second virtual thread. nothing waited." },
  {
    carriers: ["V3", null],
    queue: [],
    chunks: ["V1", "V2"],
    frames: F,
    hot: "V2",
    note: "V2 blocks on the database. same story: frozen to the heap, carrier 2 is free. two blocked virtual threads now cost a couple of kilobytes of heap each, and zero OS threads.",
  },
  {
    carriers: ["V3", "V1"],
    queue: [],
    chunks: ["V2"],
    frames: F,
    hot: "V1",
    note: "V1's data arrives. unpark puts it back in the queue, and carrier 2 (not the one it started on) mounts it: the top frames are thawed back onto that carrier's stack, the rest come back lazily as methods return.",
  },
  {
    carriers: ["V3", "V1"],
    queue: [],
    chunks: ["V2"],
    pinned: "V3",
    frames: { ...F, V3: ["run()", "<clinit> of Slow", "Thread.sleep()"] },
    hot: "V3",
    note: "pinning: V3 sleeps inside a class initializer. that's a VM frame the continuation can't freeze, so V3 parks on the carrier itself and carrier 1 is stuck. on jdk 21, sleeping inside synchronized did this too; since jdk 24 it doesn't.",
  },
];

export function MountStepper() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const st = STEPS[s.i];

  const Stack = ({ v, where }: { v: V; where: "carrier" | "heap" }) => (
    <div className="obj-in grid gap-px">
      {[...st.frames[v]].reverse().map((f, i) => (
        <div
          key={f}
          className="rounded-[3px] px-2 py-0.5 text-[10.5px]"
          style={{
            background: where === "heap" ? "color-mix(in srgb, var(--meta) 10%, var(--bg))" : "var(--bg)",
            boxShadow: `inset 0 0 0 1px ${i === 0 && st.pinned === v ? "var(--dead)" : "var(--line-2)"}`,
            color: i === 0 && st.pinned === v ? "var(--dead)" : "var(--ink)",
          }}
        >
          {f}
        </div>
      ))}
    </div>
  );

  return (
    <div {...s.keys} className="@container outline-none" aria-label="virtual threads mounting and unmounting on carrier threads">
      <div className="grid gap-4 @[680px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 text-11 text-faint">carrier threads · ForkJoinPool workers (platform threads)</div>
          <div className="grid grid-cols-2 gap-2">
            {st.carriers.map((v, i) => (
              <div
                key={i}
                className="min-h-[130px] rounded-md bg-bg p-2 transition-[box-shadow] duration-200"
                style={{ boxShadow: `inset 0 0 0 1px ${v && st.pinned === v ? "var(--dead)" : v ? "var(--line-2)" : "var(--line)"}` }}
              >
                <div className="mb-1.5 flex justify-between text-11">
                  <span className="text-hi">worker-{i + 1}</span>
                  <span className={v ? (st.pinned === v ? "text-dead" : "text-live") : "text-faint"}>
                    {v ? (st.pinned === v ? "pinned" : "running") : "idle"}
                  </span>
                </div>
                {v ? (
                  <div>
                    <div className={`mb-1 text-11 ${st.hot === v ? "text-hot" : "text-ink"}`}>mounted: {v}</div>
                    <Stack v={v} where="carrier" />
                  </div>
                ) : (
                  <div className="pt-6 text-center text-11 text-faint">looking for work</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="mb-1 text-11 text-faint">scheduler queue</div>
            <div className="flex min-h-8 flex-wrap items-center gap-1.5">
              {st.queue.length === 0 && <span className="text-11 text-faint">empty</span>}
              {st.queue.map((v) => (
                <span key={v} className="obj-in rounded-[3px] bg-bg px-2 py-1 text-11 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-11 text-faint">heap · StackChunks of unmounted threads</div>
          <div className="grid min-h-[130px] content-start gap-2 rounded-md p-2 shadow-[inset_0_0_0_1px_var(--line)]">
            {st.chunks.length === 0 && <div className="pt-6 text-center text-11 text-faint">no parked virtual threads</div>}
            {st.chunks.map((v) => (
              <div key={v} className="obj-in rounded-md bg-bg p-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--meta)_60%,transparent)]">
                <div className={`mb-1 flex justify-between text-11 ${st.hot === v ? "text-hot" : "text-meta"}`}>
                  <span>{v} · StackChunk</span>
                  <span className="text-faint">~1.5 KB</span>
                </div>
                <Stack v={v} where="heap" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Narration className="mt-4">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
