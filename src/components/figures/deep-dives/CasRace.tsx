"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Narration, type Tone } from "./kit";

// two putVal calls racing for the same empty bin, plus a reader. the branches are the
// real ones from ConcurrentHashMap.putVal in jdk 25: casTabAt for an empty bin, a retry
// of the whole loop when the CAS fails, then synchronized (f) on the first node and a
// re-check that f is still first. get() never locks: tabAt is an acquire read and
// Node.val / Node.next are volatile.

type Lane = { code: string; tone?: Tone; note?: string };
type S = { t1: Lane; t2: Lane; t3?: Lane; bin: string[]; lock?: "t1" | "t2"; newest?: string; note: string };

const STEPS: S[] = [
  {
    t1: { code: 'put("x", 1)' },
    t2: { code: 'put("y", 2)' },
    bin: [],
    note: "two threads, two different keys, both hashing to bin 5. the bin is empty.",
  },
  {
    t1: { code: "f = tabAt(tab, 5)", tone: "hot", note: "null" },
    t2: { code: "f = tabAt(tab, 5)", tone: "hot", note: "null" },
    bin: [],
    note: "both read the bin with a volatile-style (acquire) read. both see null. no lock anywhere.",
  },
  {
    t1: { code: "casTabAt(tab, 5, null, x)", tone: "live", note: "true" },
    t2: { code: "casTabAt(tab, 5, null, y)", tone: "dead", note: "false" },
    bin: ["x"],
    newest: "x",
    note: "both try to swap null for their node. the CPU lets exactly one win. T1's node is in; T2's CAS fails because the bin isn't null anymore.",
  },
  {
    t1: { code: "addCount(1L, 0)", tone: "hot", note: "done" },
    t2: { code: "for (;;) // go round again", tone: "hot" },
    bin: ["x"],
    note: "a failed CAS isn't an error. T2 never blocked, it just loops back to the top of putVal and re-reads the bin.",
  },
  {
    t1: { code: "// returned" },
    t2: { code: "synchronized (f) { // f = x", tone: "hot" },
    t3: { code: 'get("x")', tone: "hot" },
    bin: ["x"],
    lock: "t2",
    note: "now the bin has a first node, so T2 locks it: synchronized on node x itself. no separate lock object per bin, the node is the lock.",
  },
  {
    t1: { code: "// returned" },
    t2: { code: "if (tabAt(tab, 5) == f)", tone: "hot", note: "still first?" },
    t3: { code: "e = tabAt(tab, 5)", tone: "live", note: "x" },
    bin: ["x"],
    lock: "t2",
    note: "inside the lock T2 re-checks that x is still the first node (a resize or a remove could have swapped it). meanwhile a reader walks right past the lock: get() never synchronizes.",
  },
  {
    t1: { code: "// returned" },
    t2: { code: 'pred.next = new Node(hash, "y", 2)', tone: "live" },
    t3: { code: "return e.val", tone: "live", note: "1" },
    bin: ["x", "y"],
    lock: "t2",
    newest: "y",
    note: "T2 appends y at the tail. next is a volatile field, so a reader that gets here after this write sees y fully built.",
  },
  {
    t1: { code: "// returned" },
    t2: { code: "addCount(1L, 1)", tone: "hot" },
    t3: { code: "// returned 1" },
    bin: ["x", "y"],
    note: "lock released, then the count goes up by one (see counting, below). under contention, only puts into bins that already held two or more nodes stop to check for a resize; the source puts that at about 1 put in 8.",
  },
];

export function CasRace() {
  const s = useStepper(STEPS.length, { interval: 2000 });
  const st = STEPS[s.i];
  const lanes: [string, Lane | undefined, string][] = [
    ["T1", st.t1, "writer"],
    ["T2", st.t2, "writer"],
    ["T3", st.t3, "reader"],
  ];

  return (
    <div {...s.keys} className="@container outline-none" aria-label="two threads racing to put into the same empty bin">
      <div className="grid gap-5 @[640px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {lanes.map(([name, lane, role]) => (
            <div
              key={name}
              className="grid grid-cols-[4.5ch_minmax(0,1fr)] items-center gap-3 rounded-md bg-bg px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]"
            >
              <div className="flex flex-col">
                <span className="text-12 text-hi">{name}</span>
                <span className="text-[10px] text-faint">{role}</span>
              </div>
              <div className="flex min-w-0 items-baseline justify-between gap-3 text-12">
                {lane ? (
                  <>
                    <span
                      className="min-w-0 truncate border-l-2 pl-2"
                      style={{ borderColor: lane.tone ? `var(--${lane.tone})` : "transparent" }}
                    >
                      <Java code={lane.code} />
                    </span>
                    {lane.note && (
                      <span className="shrink-0 text-11" style={{ color: lane.tone ? `var(--${lane.tone})` : "var(--faint)" }}>
                        {lane.note}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-faint">·</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-center gap-3">
          <div className="text-11 text-faint">table[5]</div>
          <div className="flex min-h-[64px] flex-wrap items-center gap-y-2">
            <span className="flex h-9 w-12 items-center justify-center rounded-md text-11 text-faint shadow-[inset_0_0_0_1px_var(--line-2)]">
              bin 5
            </span>
            {st.bin.length === 0 ? (
              <span className="ml-2 text-12 text-faint">→ null</span>
            ) : (
              st.bin.map((k, i) => (
                <span key={k} className="flex items-center">
                  <span className="px-1.5 text-12 text-ref">→</span>
                  <span
                    className="obj-in relative flex h-9 min-w-[56px] flex-col items-center justify-center rounded-md bg-bg px-2 text-12"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${i === 0 && st.lock ? "var(--meta)" : st.newest === k ? "var(--hot)" : "var(--line-2)"}`,
                      color: st.newest === k ? "var(--hot)" : "var(--hi)",
                    }}
                  >
                    Node {k}
                    {i === 0 && st.lock && <span className="absolute -top-2.5 rounded-xs bg-well px-1 text-[10px] text-meta">locked by {st.lock.toUpperCase()}</span>}
                  </span>
                </span>
              ))
            )}
          </div>
          <div className="text-11 text-faint">
            {st.lock ? "the monitor lives on the first node. other bins stay unlocked." : "no lock held anywhere."}
          </div>
        </div>
      </div>

      <Narration className="mt-5">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
