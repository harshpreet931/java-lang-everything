"use client";

import { useRef } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { ArrowLayer, useArrowPaths, type Edge } from "./Arrows";
import { Narration } from "./kit";

// what Thread.threadLocals actually holds, replayed from a reflection dump on jdk 25:
//   after 2 sets:        [7] key=TL(user) value=ada   [14] key=TL(buffer) value=byte[1048576]
//   buffer = null + gc:  [14] key=null(stale) value=byte[1048576]
//   user.get(), user.set("bob"), a new ThreadLocal's set() into [5]: [14] is still there.
// ThreadLocalMap.Entry extends WeakReference<ThreadLocal<?>> (the key) and holds the
// value in a plain strong field.

type Ent = { slot: number; key: "tl1" | "tl2" | "tl3" | null; val: "ada" | "bob" | "bytes" | "x" };
type S = {
  locals: { name: string; to: "tl1" | "tl2" | "tl3" | null }[];
  tls: { id: "tl1" | "tl2" | "tl3"; label: string; ghost?: boolean }[];
  ents: Ent[];
  vals: { id: string; label: string; state?: "leak" | "ghost" | "new" }[];
  probe?: number[];
  note: string;
};

const VAL: Record<string, string> = { ada: '"ada"', bob: '"bob"', bytes: "byte[1048576]", x: '"x"' };

const STEPS: S[] = [
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: "tl2" },
    ],
    tls: [
      { id: "tl1", label: "ThreadLocal (user)" },
      { id: "tl2", label: "ThreadLocal (buffer)" },
    ],
    ents: [
      { slot: 7, key: "tl1", val: "ada" },
      { slot: 14, key: "tl2", val: "bytes" },
    ],
    vals: [
      { id: "ada", label: VAL.ada },
      { id: "bytes", label: VAL.bytes },
    ],
    note: "user.set(\"ada\") and buffer.set(1 MB). the values don't live in the ThreadLocal objects at all: they live in a map that belongs to the current Thread, keyed by the ThreadLocal.",
  },
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: null },
    ],
    tls: [
      { id: "tl1", label: "ThreadLocal (user)" },
      { id: "tl2", label: "ThreadLocal (buffer)" },
    ],
    ents: [
      { slot: 7, key: "tl1", val: "ada" },
      { slot: 14, key: "tl2", val: "bytes" },
    ],
    vals: [
      { id: "ada", label: VAL.ada },
      { id: "bytes", label: VAL.bytes },
    ],
    note: "buffer = null. our only strong reference to that ThreadLocal is gone. the entry still points at it, but through a WeakReference (dashed), which doesn't keep it alive.",
  },
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: null },
    ],
    tls: [
      { id: "tl1", label: "ThreadLocal (user)" },
      { id: "tl2", label: "ThreadLocal (buffer)", ghost: true },
    ],
    ents: [
      { slot: 7, key: "tl1", val: "ada" },
      { slot: 14, key: null, val: "bytes" },
    ],
    vals: [
      { id: "ada", label: VAL.ada },
      { id: "bytes", label: VAL.bytes, state: "leak" },
    ],
    note: "System.gc(): the ThreadLocal is collected and the entry's key reads null. a stale entry. but its value is a normal strong field, so the 1 MB array is still reachable: Thread → map → table → entry → value. nobody can ever look it up again.",
  },
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: null },
    ],
    tls: [{ id: "tl1", label: "ThreadLocal (user)" }],
    ents: [
      { slot: 7, key: "tl1", val: "ada" },
      { slot: 14, key: null, val: "bytes" },
    ],
    vals: [
      { id: "ada", label: VAL.ada },
      { id: "bytes", label: VAL.bytes, state: "leak" },
    ],
    probe: [7],
    note: "user.get() hashes straight to slot 7 and hits. get() only cleans stale entries it trips over while probing, and it didn't probe.",
  },
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: null },
    ],
    tls: [{ id: "tl1", label: "ThreadLocal (user)" }],
    ents: [
      { slot: 7, key: "tl1", val: "bob" },
      { slot: 14, key: null, val: "bytes" },
    ],
    vals: [
      { id: "bob", label: VAL.bob, state: "new" },
      { id: "ada", label: VAL.ada, state: "ghost" },
      { id: "bytes", label: VAL.bytes, state: "leak" },
    ],
    probe: [7],
    note: "user.set(\"bob\"): same slot, direct hit, value replaced, return. \"ada\" is garbage now. the stale entry in 14 is still holding its megabyte.",
  },
  {
    locals: [
      { name: "user", to: "tl1" },
      { name: "buffer", to: null },
      { name: "other", to: "tl3" },
    ],
    tls: [
      { id: "tl1", label: "ThreadLocal (user)" },
      { id: "tl3", label: "ThreadLocal (other)" },
    ],
    ents: [
      { slot: 5, key: "tl3", val: "x" },
      { slot: 7, key: "tl1", val: "bob" },
      { slot: 14, key: null, val: "bytes" },
    ],
    vals: [
      { id: "bob", label: VAL.bob },
      { id: "x", label: VAL.x, state: "new" },
      { id: "bytes", label: VAL.bytes, state: "leak" },
    ],
    probe: [5, 6, 7],
    note: "a brand new ThreadLocal sets a value into slot 5, then cleanSomeSlots scans about log2(size) slots after it: 6 (empty) and 7. it never reaches 14. this is the real dump: the megabyte stays until something probes past it, the table is rehashed, or the thread dies.",
  },
];

export function WeakEntries() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const st = STEPS[s.i];
  const root = useRef<HTMLDivElement>(null);

  const edges: Edge[] = [
    ...st.locals.filter((l) => l.to).map((l) => ({ from: `l-${l.name}`, to: l.to! })),
    { from: "thread", to: "map" },
    ...st.ents.flatMap((e) => [
      ...(e.key ? [{ from: `k-${e.slot}`, to: e.key, dashed: true }] : []),
      { from: `v-${e.slot}`, to: e.val, tone: (e.key === null ? "dead" : "ref") as Edge["tone"] },
    ]),
  ];
  const paths = useArrowPaths(root, edges, s.i);

  return (
    <div {...s.keys} className="@container outline-none" aria-label="a thread's ThreadLocalMap with a stale entry, step by step">
      <div ref={root} className="relative grid grid-cols-2 gap-x-8 gap-y-6 text-12 @[720px]:grid-cols-[0.8fr_1fr_1.15fr_1fr]">
        {/* stack */}
        <div className="min-w-0">
          <Title>stack · main</Title>
          <div className="rounded-md bg-bg px-3 py-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
            {st.locals.map((l) => (
              <div key={l.name} className="flex items-center justify-between gap-2 border-t border-line py-1 first:border-t-0">
                <span className="text-mute">{l.name}</span>
                {l.to ? <span data-a={`l-${l.name}`} className="size-[7px] rounded-full bg-ref" /> : <span className="text-faint">null</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ThreadLocal objects */}
        <div className="min-w-0">
          <Title>ThreadLocal objects</Title>
          <div className="grid gap-2">
            {st.tls.map((t) => (
              <div
                key={t.id}
                data-a={t.ghost ? undefined : t.id}
                className="obj-in rounded-md bg-bg px-2.5 py-1.5 text-11"
                style={{ boxShadow: `inset 0 0 0 1px ${t.ghost ? "var(--dead)" : "var(--line-2)"}`, opacity: t.ghost ? 0.55 : 1 }}
              >
                <span className={t.ghost ? "text-dead" : "text-hi"}>{t.label}</span>
                {t.ghost && <div className="text-[10px] text-dead">collected</div>}
              </div>
            ))}
          </div>
        </div>

        {/* thread + map */}
        <div className="min-w-0">
          <Title>the current Thread</Title>
          <div className="rounded-md bg-bg px-3 py-2 shadow-[inset_0_0_0_1px_var(--meta)]">
            <div className="text-11 text-meta">Thread &quot;main&quot;</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-mute">threadLocals</span>
              <span data-a="thread" className="size-[7px] rounded-full bg-ref" />
            </div>
          </div>
          <div data-a="map" className="mt-5 rounded-md bg-bg px-3 py-2 shadow-[inset_0_0_0_1px_var(--meta)]">
            <div className="mb-1 text-11 text-meta">ThreadLocalMap · Entry[16]</div>
            <div className="grid grid-cols-[3ch_1fr_auto] items-center gap-x-2 text-11 text-faint">
              <span />
              <span>key (weak)</span>
              <span>value</span>
            </div>
            {st.ents.map((e) => {
              const probed = st.probe?.includes(e.slot);
              const stale = e.key === null;
              return (
                <div
                  key={e.slot}
                  className="obj-in grid grid-cols-[3ch_1fr_auto] items-center gap-x-2 border-t border-line py-1"
                  style={{ background: probed ? "color-mix(in srgb, var(--hot) 10%, transparent)" : undefined }}
                >
                  <span className={probed ? "text-hot tabular" : "text-faint tabular"}>[{e.slot}]</span>
                  <span>
                    {stale ? (
                      <span className="text-dead">null (stale)</span>
                    ) : (
                      <span data-a={`k-${e.slot}`} className="inline-block size-[7px] rounded-full shadow-[inset_0_0_0_1.5px_var(--ref)]" />
                    )}
                  </span>
                  <span data-a={`v-${e.slot}`} className={`size-[7px] rounded-full ${stale ? "bg-dead" : "bg-ref"}`} />
                </div>
              );
            })}
            {st.probe?.includes(6) && (
              <div className="border-t border-line py-1 text-11 text-hot">scanned: [6] empty, [7] live. 14 never checked</div>
            )}
          </div>
        </div>

        {/* values */}
        <div className="min-w-0">
          <Title>values</Title>
          <div className="grid gap-2">
            {st.vals.map((v) => (
              <div
                key={v.id}
                data-a={v.state === "ghost" ? undefined : v.id}
                className="obj-in rounded-md bg-bg px-2.5 py-1.5 text-11"
                style={{
                  boxShadow: `inset 0 0 0 1px ${v.state === "leak" || v.state === "ghost" ? "var(--dead)" : v.state === "new" ? "var(--hot)" : "var(--line-2)"}`,
                  opacity: v.state === "ghost" ? 0.55 : 1,
                }}
              >
                <span className={v.state === "leak" || v.state === "ghost" ? "text-dead" : "text-hi"}>{v.label}</span>
                {v.state === "leak" && <div className="text-[10px] text-dead">unreachable from your code, pinned by the thread</div>}
                {v.state === "ghost" && <div className="text-[10px] text-dead">garbage</div>}
              </div>
            ))}
          </div>
        </div>

        <ArrowLayer paths={paths} />
      </div>

      <Narration className="mt-6">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 border-b border-line pb-1 text-11 text-faint">{children}</div>;
}
