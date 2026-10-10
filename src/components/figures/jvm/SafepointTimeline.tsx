"use client";

import { useEffect, useRef, useState } from "react";

// time to safepoint, drawn. the shape is schematic (four threads, one GC), the two
// numbers are real: Ttsp.java on jdk 25, a C2-compiled counted int loop running on a
// worker thread while main calls System.gc(). -Xlog:safepoint said "Reaching safepoint"
// took 34,542 ns with the default flags and 1,072,004,292 ns with -XX:-UseCountedLoopSafepoints.

type Lane = { name: string; sub: string; poll: number | null; pollOff?: number; blocked?: boolean };

const REQ = 30; // the VM thread arms the polls
const PAUSE = 8; // the GC work itself

const LANES: Lane[] = [
  { name: "main", sub: "allocating", poll: 31.5 },
  { name: "worker A", sub: "calling methods", poll: 32.5 },
  { name: "worker B", sub: "hot counted loop", poll: 34, pollOff: 88 },
  { name: "worker C", sub: "blocked on a socket", poll: null, blocked: true },
];

export function SafepointTimeline() {
  const [polls, setPolls] = useState(true);
  const [t, setT] = useState(100);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const arrive = (l: Lane) => (l.blocked ? REQ : polls ? (l.poll as number) : (l.pollOff ?? (l.poll as number)));
  const allIn = Math.max(...LANES.map(arrive));
  const resume = allIn + PAUSE;

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(100);
      setPlaying(false);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 4500);
      setT(p * 100);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const lane = (l: Lane) => {
    const a = arrive(l);
    const segs: { from: number; to: number; kind: "run" | "wait" | "blocked" }[] = l.blocked
      ? [
          { from: 0, to: 100, kind: "blocked" },
        ]
      : [
          { from: 0, to: a, kind: "run" },
          { from: a, to: resume, kind: "wait" },
          { from: resume, to: 100, kind: "run" },
        ];
    return (
      <div key={l.name} className="grid grid-cols-[minmax(0,10ch)_minmax(0,1fr)] items-center gap-3 @[560px]:grid-cols-[18ch_minmax(0,1fr)]">
        <div className="min-w-0 leading-tight">
          <div className="truncate text-12 text-hi">{l.name}</div>
          <div className="truncate text-[10px] text-faint">{l.sub}</div>
        </div>
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-[22px] w-full" aria-hidden>
          {segs.map((s, i) => {
            const to = Math.min(s.to, t);
            if (to <= s.from) return null;
            if (s.kind === "run")
              return <rect key={i} x={s.from} y={3.5} width={to - s.from} height={3} fill="var(--ink)" />;
            if (s.kind === "blocked")
              return <rect key={i} x={s.from} y={4.25} width={to - s.from} height={1.5} fill="var(--line-2)" />;
            return <rect key={i} x={s.from} y={2} width={to - s.from} height={6} fill="var(--well-2)" stroke="var(--line-2)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
          })}
          {!l.blocked && t >= a && <rect x={a - 0.35} y={1} width={0.7} height={8} fill={a === allIn && a > REQ + 10 ? "var(--dead)" : "var(--hot)"} />}
        </svg>
      </div>
    );
  };

  const ttspTone = polls ? "var(--hot)" : "var(--dead)";

  return (
    <div className="@container">
      <div className="mb-4 grid grid-cols-[13ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3 text-13">
        <span className="text-faint">loop polls =</span>
        <div className="flex flex-wrap gap-1">
          <button className="word" aria-pressed={polls} onClick={() => setPolls(true)}>
            on (default)
          </button>
          <button className="word" aria-pressed={!polls} onClick={() => setPolls(false)}>
            off
          </button>
          <span className="self-center text-11 text-faint">{polls ? "strip-mined: a poll every 1,000 iterations" : "-XX:-UseCountedLoopSafepoints"}</span>
        </div>
      </div>

      <div className="relative flex flex-col gap-2" role="img" aria-label={`four threads; the safepoint is requested at the dashed line; time to safepoint is ${polls ? "tiny" : "huge, because one thread is in a loop with no poll"}`}>
        {LANES.map(lane)}
        <div className="grid grid-cols-[minmax(0,10ch)_minmax(0,1fr)] items-center gap-3 border-t border-line pt-2 @[560px]:grid-cols-[18ch_minmax(0,1fr)]">
          <div className="leading-tight">
            <div className="text-12 text-meta">VM thread</div>
            <div className="text-[10px] text-faint">runs the GC</div>
          </div>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-[22px] w-full" aria-hidden>
            {t >= REQ && <rect x={REQ} y={4.25} width={Math.min(allIn, t) - REQ} height={1.5} fill={ttspTone} />}
            {t >= allIn && <rect x={allIn} y={2} width={Math.min(resume, t) - allIn} height={6} fill="var(--meta)" />}
          </svg>
        </div>
        {/* request marker + cursor, over the lane area */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(10ch+0.75rem)] @[560px]:left-[calc(18ch+0.75rem)]">
          <div className="absolute inset-y-0 border-l border-dashed" style={{ left: `${REQ}%`, borderColor: "var(--meta)" }} />
          <div className="absolute inset-y-0 w-px bg-hot/60" style={{ left: `${t}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-11 text-mute">
        <span>
          <span className="mr-1 inline-block h-[3px] w-4 bg-ink align-middle" /> running java
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-4 bg-well-2 align-middle shadow-[inset_0_0_0_1px_var(--line-2)]" /> parked at a poll
        </span>
        <span>
          <span className="mr-1 inline-block h-[3px] w-4 align-middle" style={{ background: ttspTone }} /> time to safepoint
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-4 bg-meta align-middle" /> the GC pause itself
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="act solid" onClick={() => setPlaying(true)} disabled={playing}>
          play it
        </button>
        <span className="text-12 text-faint">dashed line: the VM thread asks for a safepoint</span>
      </div>

      <pre className="mt-4 overflow-x-auto rounded-md bg-well px-3 py-2 text-11 leading-[1.7] whitespace-pre text-mute shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">-Xlog:safepoint, real run ({polls ? "default flags" : "-XX:-UseCountedLoopSafepoints"}){"\n"}</span>
        Safepoint &quot;G1CollectFull&quot;, ... Reaching safepoint:{" "}
        <span style={{ color: ttspTone }}>{polls ? "34542 ns" : "1072004292 ns"}</span>, At safepoint: {polls ? "1954958" : "1893916"} ns, ...
      </pre>
      <p className="mt-3 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {polls
          ? "every thread hits a poll within microseconds: the loop is strip-mined, so even the hot loop checks every 1,000 iterations. worker C is blocked in native code, which already counts as safe. the GC starts 0.035 ms after asking."
          : "worker B's loop was compiled without a single poll. everyone else is already parked, doing nothing, while the JVM waits for that one loop to finish: 1.07 seconds before the 2 ms GC could even start."}
      </p>
    </div>
  );
}
