"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// ConcurrentHashMap's write path, in three scenarios.
//   empty bin: CAS the new node in. no lock at all.
//   busy bin:  synchronized on the bin's first node. only that one bin is locked.
//   reads:     never lock. they follow volatile links.

type Act = { bin: number; text: string; tone?: "live" | "hot" | "meta" | "dead" | "mute" };
type Step = { bins: string[][]; t1?: Act; t2?: Act; lock?: { bin: number; by: string }; note: string };
type Scene = { key: string; steps: Step[] };

const E = (): string[][] => Array.from({ length: 8 }, () => []);
const withBin = (b: number, keys: string[], base = E()) => base.map((x, i) => (i === b ? keys : x));

const SCENES: Scene[] = [
  {
    key: "different bins",
    steps: [
      { bins: E(), note: "an 8-bin table, empty. T1 calls put(\"cat\", 1), T2 calls put(\"dog\", 1), at the same moment." },
      {
        bins: E(),
        t1: { bin: 2, text: "hash → bin 2", tone: "mute" },
        t2: { bin: 5, text: "hash → bin 5", tone: "mute" },
        note: "each thread hashes its key to pick a bin. different keys, different bins (usually).",
      },
      {
        bins: withBin(5, ["dog"], withBin(2, ["cat"])),
        t1: { bin: 2, text: "CAS null → cat", tone: "live" },
        t2: { bin: 5, text: "CAS null → dog", tone: "live" },
        note: "both bins were empty, so each thread installs its node with a single CAS. no locks taken. two writers, fully in parallel.",
      },
    ],
  },
  {
    key: "same empty bin",
    steps: [
      { bins: E(), note: "T1 puts \"cat\", T2 puts \"act\". unlucky: both hash to bin 2, and it's empty." },
      {
        bins: E(),
        t1: { bin: 2, text: "bin 2 is null", tone: "mute" },
        t2: { bin: 2, text: "bin 2 is null", tone: "mute" },
        note: "both read bin 2 and see nothing there. both are about to CAS.",
      },
      {
        bins: withBin(2, ["cat"]),
        t1: { bin: 2, text: "CAS null → cat: ok", tone: "live" },
        t2: { bin: 2, text: "CAS null → act: fails", tone: "hot" },
        note: "only one CAS can win. T1's lands. T2's fails, because the bin isn't null anymore. nothing was lost: T2 just loops around.",
      },
      {
        bins: withBin(2, ["cat"]),
        t2: { bin: 2, text: "synchronized (cat)", tone: "meta" },
        lock: { bin: 2, by: "T2" },
        note: "second try: the bin isn't empty now, so T2 locks the bin's first node, cat. that's the whole lock: one node, one bin.",
      },
      {
        bins: withBin(2, ["cat", "act"]),
        t2: { bin: 2, text: "append act, unlock", tone: "live" },
        note: "inside the lock, T2 walks the bin, doesn't find \"act\", and appends a new node. unlock. the other seven bins were never touched.",
      },
    ],
  },
  {
    key: "busy bin",
    steps: [
      {
        bins: withBin(6, ["owl"], withBin(2, ["cat", "act"])),
        note: "bin 2 holds two nodes. T1 is putting \"tac\" (bin 2). T2 wants \"cta\" (also bin 2), then later reads \"owl\" (bin 6).",
      },
      {
        bins: withBin(6, ["owl"], withBin(2, ["cat", "act"])),
        t1: { bin: 2, text: "synchronized (cat)", tone: "meta" },
        lock: { bin: 2, by: "T1" },
        note: "T1 locks bin 2's head node.",
      },
      {
        bins: withBin(6, ["owl"], withBin(2, ["cat", "act"])),
        t1: { bin: 2, text: "walking bin 2", tone: "meta" },
        t2: { bin: 2, text: "lock (cat): BLOCKED", tone: "mute" },
        lock: { bin: 2, by: "T1" },
        note: "T2 needs the same bin, so it waits for the same lock. contention only happens between writers that land in the same bin.",
      },
      {
        bins: withBin(6, ["owl"], withBin(2, ["cat", "act", "tac"])),
        t1: { bin: 2, text: "append tac, unlock", tone: "live" },
        t2: { bin: 2, text: "gets the lock", tone: "meta" },
        lock: { bin: 2, by: "T2" },
        note: "T1 appends and unlocks. T2 gets in.",
      },
      {
        bins: withBin(6, ["owl"], withBin(2, ["cat", "act", "tac", "cta"])),
        t1: { bin: 6, text: "get(owl) → found", tone: "live" },
        t2: { bin: 2, text: "append cta, unlock", tone: "live" },
        note: "meanwhile, gets never lock at all. they read the bin's volatile head and follow the next links, and the happens-before from the writer's unlock makes the new nodes visible.",
      },
    ],
  },
];

export function ChmBins() {
  const [k, setK] = useState(0);
  const sc = SCENES[k];
  const s = useStepper(sc.steps.length, { interval: 1900 });
  const st = sc.steps[Math.min(s.i, sc.steps.length - 1)];

  const who = (bin: number) => [st.t1?.bin === bin ? { n: "T1", a: st.t1 } : null, st.t2?.bin === bin ? { n: "T2", a: st.t2 } : null].filter(Boolean) as { n: string; a: Act }[];

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 flex flex-wrap gap-1" role="tablist">
        {SCENES.map((x, j) => (
          <button key={x.key} role="tab" aria-selected={k === j} className="word" onClick={() => (setK(j), s.go(0))}>
            {x.key}
          </button>
        ))}
      </div>

      <div className="mb-1.5 text-11 text-faint">table[] · 8 bins</div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {st.bins.map((nodes, b) => {
          const locked = st.lock?.bin === b;
          const acts = who(b);
          return (
            <div key={b} className="flex min-w-0 flex-col">
              <div
                className="flex min-h-[96px] flex-col items-center gap-1 rounded-md bg-well px-1 pt-1.5 pb-2 sm:min-h-[132px]"
                style={{ boxShadow: `inset 0 0 0 1px ${locked ? "var(--meta)" : acts.length ? "var(--ink)" : "var(--line)"}` }}
              >
                <span className="text-[10px] text-faint tabular">[{b}]</span>
                {nodes.length === 0 && <span className="text-11 text-faint">null</span>}
                {nodes.map((n, j) => (
                  <div key={n} className="flex flex-col items-center">
                    {j > 0 && <span className="text-[10px] leading-3 text-ref">↓</span>}
                    <span
                      className="obj-in rounded-xs px-1.5 text-11 text-hi"
                      style={{ boxShadow: `inset 0 0 0 1px ${locked && j === 0 ? "var(--meta)" : "var(--line-2)"}` }}
                    >
                      {n}
                    </span>
                    {locked && j === 0 && <span className="text-[10px] leading-3 text-meta">locked by {st.lock!.by}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex min-h-[38px] flex-col gap-0.5">
                {acts.map(({ n, a }) => (
                  <span
                    key={n}
                    className="rounded-xs px-1 text-center text-[10px] leading-[1.35]"
                    style={{
                      color: a.tone && a.tone !== "mute" ? `var(--${a.tone})` : "var(--mute)",
                      boxShadow: `inset 0 0 0 1px ${a.tone && a.tone !== "mute" ? `var(--${a.tone})` : "var(--line-2)"}`,
                      border: a.text.includes("BLOCKED") ? "1px dashed var(--line-2)" : undefined,
                    }}
                  >
                    <span className="text-hi">{n}</span> {a.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 min-h-[4.8em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
