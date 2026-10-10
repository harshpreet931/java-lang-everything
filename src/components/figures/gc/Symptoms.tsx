"use client";

import { useState, type ReactNode } from "react";

// six things worth spotting in a GC log. every line is real jdk 25.0.4 output (macOS aarch64,
// 14 cores), decorators trimmed to the uptime. sources: LeakyService on -Xmx128m (G1), a
// one-line System.gc() program, 1 MB arrays on -Xmx256m, 200,000 hidden classes, and the
// toy service under ZGC on -Xmx72m.

type Symptom = {
  id: string;
  label: string;
  tone: "dead" | "hot";
  lines: string[];
  means: ReactNode;
  fix: ReactNode;
};

const S: Symptom[] = [
  {
    id: "floor",
    label: "the floor keeps rising",
    tone: "dead",
    lines: [
      "[0.095s] GC(14) Pause Full (G1 Compaction Pause) 127M->45M(128M) 4.815ms",
      "[0.744s] GC(277) Pause Full (G1 Compaction Pause) 126M->91M(128M) 7.724ms",
      "[1.610s] GC(605) Pause Full (G1 Compaction Pause) 125M->118M(128M) 6.181ms",
      "[3.102s] GC(1057) Pause Full (G1 Compaction Pause) 127M->126M(128M) 7.527ms",
      'Exception in thread "main" java.lang.OutOfMemoryError: Java heap space',
    ],
    means: (
      <>
        what's left after a full GC is what's alive. 45, 91, 118, 126 MB of a
        128 MB heap: the live set grows and never comes back down. that's a leak
        (in this program, listeners that are registered and never removed).
      </>
    ),
    fix: (
      <>
        more heap only buys time. take a heap dump and find out what's holding
        on: <a href="/learn/gc/memory-leaks">memory leaks</a>.
      </>
    ),
  },
  {
    id: "thrash",
    label: "full GCs back to back",
    tone: "dead",
    lines: [
      "[3.676s] GC(1176) Pause Young (Normal) (G1 Evacuation Pause) (Evacuation Failure: Allocation) 127M->127M(128M) 0.456ms",
      "[3.685s] GC(1177) Pause Full (G1 Compaction Pause) 127M->127M(128M) 8.439ms",
      "[3.694s] GC(1178) Pause Full (G1 Compaction Pause) 127M->126M(128M) 8.877ms",
      "[3.710s] GC(1182) Pause Full (G1 Compaction Pause) 126M->126M(128M) 8.314ms",
      "[3.729s] GC(1185) Pause Full (G1 Compaction Pause) 126M->126M(128M) 10.234ms",
    ],
    means: (
      <>
        the same run, at the end. a full GC every 10 ms, each one freeing
        nothing. 364 full GCs in 3.7 seconds, and 2.8 of those seconds were
        spent stopped. the app is barely running. this is what "out of memory"
        looks like before the error arrives.
      </>
    ),
    fix: (
      <>
        if the live set is legitimately that big, give it more heap. if it's
        growing, it's the previous tab. either way, a G1 full GC is a bug
        report.
      </>
    ),
  },
  {
    id: "sysgc",
    label: "System.gc()",
    tone: "hot",
    lines: ["[0.020s] GC(0) Pause Full (System.gc()) 15M->13M(68M) 1.883ms"],
    means: (
      <>
        someone called <code>System.gc()</code> or <code>Runtime.gc()</code>.
        with G1 that's a full GC, stop-the-world, on the whole heap. libraries
        and old monitoring code still do this.
      </>
    ),
    fix: (
      <>
        find the caller (a stack from JFR or a debugger breakpoint).{" "}
        <code>-XX:+ExplicitGCInvokesConcurrent</code> turns it into a concurrent
        cycle. careful with <code>-XX:+DisableExplicitGC</code>: the JDK itself
        calls <code>System.gc()</code> when direct buffer memory runs out, to
        free dead buffers.
      </>
    ),
  },
  {
    id: "humongous",
    label: "humongous allocations",
    tone: "hot",
    lines: [
      "[0.022s] GC(0) Pause Young (Concurrent Start) (G1 Humongous Allocation) 116M->1M(256M) 0.594ms",
      "[0.022s] GC(1) Concurrent Undo Cycle",
      "[0.022s] GC(1) Concurrent Undo Cycle 0.037ms",
      "[0.023s] GC(2) Pause Young (Concurrent Start) (G1 Humongous Allocation) 115M->1M(256M) 0.317ms",
    ],
    means: (
      <>
        objects at least half a region big go straight to the old gen, and
        allocating enough of them starts a GC early. here, 2,000 arrays of 1 MB
        with 1 MB regions (each one needs two regions, header included). the
        undo cycle: G1 started marking, saw the heap was empty after the young
        GC, and cancelled.
      </>
    ),
    fix: (
      <>
        smaller or reused buffers, or bigger regions with{" "}
        <code>-XX:G1HeapRegionSize</code>. more in{" "}
        <a href="/learn/gc/allocation-and-tlabs">allocation and TLABs</a>.
      </>
    ),
  },
  {
    id: "meta",
    label: "Metadata GC Threshold",
    tone: "hot",
    lines: [
      "[0.102s] GC(0) Pause Young (Concurrent Start) (Metadata GC Threshold) 16M->2M(388M) 4.065ms",
      "[0.152s] GC(2) Pause Young (Prepare Mixed) (Metadata GC Threshold) 12M->4M(28M) 5.816ms",
    ],
    means: (
      <>
        metaspace reached its current high-water mark, so the JVM ran a GC to
        unload classes nobody can reach. one or two at startup is normal. here,
        a program defining 200,000 throwaway classes got ten of them.
      </>
    ),
    fix: (
      <>
        watch the <code>Metaspace:</code> numbers in the{" "}
        <code>gc,metaspace</code> lines. if they climb forever, something keeps
        loading classes: see{" "}
        <a href="/learn/deep-dives/classloader-leaks">class loader leaks</a>.
      </>
    ),
  },
  {
    id: "stall",
    label: "allocation stalls (ZGC)",
    tone: "dead",
    lines: [
      "[0.084s] Allocation Stall (main) 0.072ms",
      "[0.086s] GC(4) Minor Collection (Allocation Stall)",
      "[0.095s] GC(4) Minor Collection (Allocation Stall) 72M(100%)->72M(100%) 0.009s",
      "[0.110s] Allocation Stall (main) 25.264ms",
    ],
    means: (
      <>
        ZGC couldn't keep up, so the thread asking for memory had to wait for a
        cycle to finish. it isn't a pause, so it's not in the pause numbers.
        this run (the toy service on a 72 MB heap) stalled 551 times for 4.5
        seconds in total, while the longest pause in the log was 0.012 ms. it
        took 5.8 s instead of 0.9 s.
      </>
    ),
    fix: (
      <>
        give it headroom (ZGC needs spare heap to allocate into while it works),
        or more concurrent GC threads, or allocate less. and grep for stalls,
        not just pauses.
      </>
    ),
  },
];

export function Symptoms() {
  const [id, setId] = useState(S[0].id);
  const s = S.find((x) => x.id === id)!;
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @[640px]:grid-cols-[13rem_minmax(0,1fr)]">
        <div
          className="flex flex-wrap content-start gap-1 @[640px]:flex-col @[640px]:items-start"
          role="group"
          aria-label="symptom"
        >
          {S.map((x) => (
            <button
              key={x.id}
              className="word text-left"
              aria-pressed={id === x.id}
              onClick={() => setId(x.id)}
            >
              <span
                className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                style={{ background: `var(--${x.tone})` }}
              />
              {x.label}
            </button>
          ))}
        </div>
        <div className="min-w-0">
          <div className="rounded-md bg-bg px-3 py-2.5 text-[10.5px] leading-[1.75] shadow-[inset_0_0_0_1px_var(--line)] @[560px]:text-[11.5px]">
            {s.lines.map((l, i) => (
              <div
                key={i}
                className={`pl-[3ch] -indent-[3ch] break-all whitespace-pre-wrap ${l.startsWith("Exception") ? "text-dead" : "text-ink"}`}
              >
                {l}
              </div>
            ))}
          </div>
          <div
            className="mt-3 grid gap-2 font-serif text-[16px] leading-[1.6] text-ink"
            aria-live="polite"
          >
            <p>
              <span className="mr-2 font-mono text-11 text-faint">means</span>
              {s.means}
            </p>
            <p>
              <span className="mr-2 font-mono text-11 text-faint">do</span>
              {s.fix}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
