"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";

// one object, two threads, every lock state HotSpot uses on jdk 25.
// the mark word bits are real: read with Unsafe.getLong(lock, 0) at each moment
// (unlocked ...0001, synchronized ...0000, nested ...0000, wait() → 0x78a10c6a02,
// a pointer to an ObjectMonitor with the low bits 10). inflation causes come from
// -Xlog:monitorinflation=trace ("cause=Monitor Wait", "cause=Monitor Enter").

type St = {
  bits: string;
  state: "unlocked" | "lightweight" | "inflated";
  a: string[];
  b: string[];
  monitor?: { owner: string; entry: string[]; wait: string[] };
  aDoing: string;
  bDoing: string;
  note: string;
};

const STEPS: St[] = [
  { bits: "…0000 0001", state: "unlocked", a: [], b: [], aDoing: "running", bDoing: "running", note: "nobody holds the lock. the mark word's last two bits are 01. (if the object had a hash, it would be in the bits above, untouched by everything that follows until inflation.)" },
  { bits: "…0000 0000", state: "lightweight", a: ["lock"], b: [], aDoing: "synchronized (lock)", bDoing: "running", note: "A enters synchronized. one CAS flips the lock bits 01 → 00, and A pushes the object onto its own lock stack. that's the whole cost of an uncontended lock: no allocation, no OS call." },
  { bits: "…0000 0000", state: "lightweight", a: ["lock", "lock"], b: [], aDoing: "nested synchronized (lock)", bDoing: "running", note: "A locks it again (a synchronized method calling another). the object is already on top of A's lock stack, so A just pushes it again. the header doesn't change." },
  { bits: "…0000 0000", state: "lightweight", a: ["lock"], b: [], aDoing: "still inside the outer block", bDoing: "running", note: "the inner block exits: pop. still locked, still 00." },
  { bits: "0x78a10c6a02", state: "inflated", a: [], b: [], monitor: { owner: "A", entry: ["B"], wait: [] }, aDoing: "still inside the outer block", bDoing: "synchronized (lock): blocked", note: "B wants the lock. it spins for a moment, then inflates: an ObjectMonitor is allocated, the mark word becomes its address with the low bits 10, and B parks in the monitor's entry queue. the -Xlog line for this says cause=Monitor Enter." },
  { bits: "0x78a10c6a02", state: "inflated", a: [], b: [], monitor: { owner: "B", entry: [], wait: [] }, aDoing: "running", bDoing: "synchronized (lock)", note: "A exits. the monitor hands ownership to B and unparks it. from now on this object is locked and unlocked through the monitor, even with no contention." },
  { bits: "0x78a10c6a02", state: "inflated", a: [], b: [], monitor: { owner: "nobody", entry: [], wait: ["B"] }, aDoing: "running", bDoing: "lock.wait()", note: "B calls wait(): it releases the monitor and moves to the wait set. wait/notify only exist on monitors, which is why wait() alone inflates a lock (cause=Monitor Wait)." },
  { bits: "…0000 0001", state: "unlocked", a: [], b: [], aDoing: "running", bDoing: "running", note: "after a notify, B reacquires and leaves. the monitor sits idle and stays attached (in the real run, still 10 after 1.5 s). eventually the Monitor Deflation Thread detaches it and the header goes back to 01: at least every 60 s, every 250 ms when monitors pile up." },
];

const tone = { unlocked: "var(--mute)", lightweight: "var(--meta)", inflated: "var(--meta)" } as const;

export function LockStates() {
  const s = useStepper(STEPS.length, { interval: 2800 });
  const st = STEPS[s.i];

  const thread = (name: "A" | "B", stack: string[], doing: string) => (
    <div className="min-w-0 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="text-12 text-hi">thread {name}</div>
      <div className="mt-0.5 min-h-[2.6em] text-11 leading-snug text-mute">{doing}</div>
      <div className="mt-2 text-11 text-faint">lock stack</div>
      <div className="mt-1 flex min-h-[26px] flex-wrap gap-1">
        {stack.length === 0 && <span className="text-11 text-faint">empty</span>}
        {stack.map((x, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-11 text-ref shadow-[inset_0_0_0_1px_var(--ref)]">
            <span className="size-[6px] rounded-full bg-ref" aria-hidden />
            {x}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div {...s.keys} className="@container outline-none">
      <div className="grid gap-3 @[620px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="flex items-baseline justify-between text-12">
              <span className="text-hi">the object: lock</span>
              <span style={{ color: tone[st.state] }}>{st.state}</span>
            </div>
            <div className="mt-2 text-11 text-faint">mark word</div>
            <div className="mt-1 flex items-baseline gap-3 text-15 tabular">
              <span key={st.bits} className="flash px-0.5 text-hi">
                {st.bits}
              </span>
              <span className="text-12" style={{ color: tone[st.state] }}>
                lock bits {st.state === "unlocked" ? "01" : st.state === "lightweight" ? "00" : "10"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {thread("A", st.a, st.aDoing)}
            {thread("B", st.b, st.bDoing)}
          </div>
        </div>
        <div
          className="min-w-0 rounded-md px-3 py-2.5 transition-opacity duration-200"
          style={{
            boxShadow: `inset 0 0 0 1px ${st.monitor ? "var(--meta)" : "var(--line)"}`,
            opacity: st.monitor ? 1 : 0.45,
          }}
        >
          <div className="flex items-baseline justify-between text-12">
            <span className="text-meta">ObjectMonitor</span>
            <span className="text-11 text-faint">{st.monitor ? "@ 0x78a10c6a00" : "not allocated"}</span>
          </div>
          <div className="mt-2 grid grid-cols-[13ch_minmax(0,1fr)] gap-y-1.5 text-12">
            <span className="text-faint">owner</span>
            <span className="text-hi">{st.monitor?.owner ?? "·"}</span>
            <span className="text-faint">entry queue</span>
            <span className="text-hi">{st.monitor?.entry.join(", ") || "·"}</span>
            <span className="text-faint">wait set</span>
            <span className="text-hi">{st.monitor?.wait.join(", ") || "·"}</span>
            <span className="text-faint">saved hdr</span>
            <span className="text-mute">{st.monitor ? "the old mark word (hash, age)" : "·"}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <p className="min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
