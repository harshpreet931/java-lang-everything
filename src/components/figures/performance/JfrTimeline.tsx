"use client";

import { useState } from "react";
import { useWidth } from "../meta/kit";
import { TIMELINE } from "./jfrTimeline.data";

// six seconds of a real flight recording (shop-lock.jfr): three worker threads that format,
// sort and parse, then all funnel through one synchronized block, plus a reporter thread
// that sleeps. the event texts are real `jfr print` output from the same file.

const rnd = (n: number) => Math.round(n * 100) / 100;
const WORKERS = ["worker-0", "worker-1", "worker-2"] as const;

type Kind = "sample" | "monitor" | "gc" | "sleep";

const PRINT: Record<Kind, string> = {
  sample: `jdk.ExecutionSample {
  startTime = 13:01:09.416 (2026-10-10)
  sampledThread = "worker-0" (javaThreadId = 29)
  state = "STATE_RUNNABLE"
  stackTrace = [
    Shop.makeLines(Random, int) line: 50
    Shop.lambda$main$0(int, long) line: 62
    java.lang.Thread.run() line: 1474
  ]
}`,
  monitor: `jdk.JavaMonitorEnter {
  startTime = 13:01:09.471 (2026-10-10)
  duration = 1.73 ms
  monitorClass = java.lang.Object (classLoader = bootstrap)
  previousOwner = "worker-1" (javaThreadId = 30)
  eventThread = "worker-2" (javaThreadId = 31)
  stackTrace = [
    Shop.record(long) line: 41
    Shop.lambda$main$0(int, long) line: 64
    ...
  ]
}`,
  gc: `jdk.GarbageCollection {
  startTime = 13:01:09.494 (2026-10-10)
  duration = 1.82 ms
  gcId = 0
  name = "G1New"
  cause = "G1 Evacuation Pause"
  sumOfPauses = 1.82 ms
  longestPause = 1.82 ms
  eventThread = "VM Thread" (osThreadId = 18947)
}`,
  sleep: `jdk.ThreadSleep {
  startTime = 13:01:09.412 (2026-10-10)
  duration = 505 ms
  time = 500 ms
  eventThread = "reporter" (javaThreadId = 32)
  stackTrace = [
    Shop.lambda$main$1(long) line: 71
    java.lang.Thread.run() line: 1474
  ]
}`,
};

const NOTE: Record<Kind, string> = {
  sample: "every 10 ms (the profile settings) JFR records the stack of each thread that's running java code. 1,082 samples in 6 s. a thread waiting on a lock isn't running, so it gets no samples: notice the gaps.",
  monitor: "a thread had to wait to enter a synchronized block. this run used a 1 ms threshold, and logged 2,500 of them, averaging 1.73 ms: three workers queueing on one lock. jfr view contention-by-site names the exact line.",
  gc: "66 young collections in 6 s, each a pause of 0.5 to 2 ms. every thread stops for them, so they show up as vertical lines through all the lanes.",
  sleep: "the reporter thread sleeps for 500 ms at a time, and JFR records each Thread.sleep that lasts longer than the threshold, with the stack that called it.",
};

export function JfrTimeline() {
  const [kind, setKind] = useState<Kind>("monitor");
  const [box, W] = useWidth<HTMLDivElement>(640);
  const L = W < 480 ? 64 : 76;
  const span = W - L - 6;

  // overview: 6 s
  const ox = (ms: number) => rnd(L + (ms / 6000) * span);
  const laneH = 16;
  const oH = 18 + (WORKERS.length + 1) * (laneH + 6) + 16;
  // zoom: 2.0-2.4 s
  const zx = (ms: number) => rnd(L + (ms / 400) * span);
  const zH = 14 + WORKERS.length * (laneH + 8) + 16;
  const dim = (k: Kind) => (kind === k ? 1 : 0.35);

  return (
    <div className="@container" ref={box}>
      <div className="mb-1 text-11 text-faint">the whole recording, 6 s, in 50 ms bins</div>
      <svg viewBox={`0 0 ${W} ${oH}`} width={W} height={oH} className="block max-w-full" role="img" aria-label="six-second timeline of three worker threads and a reporter thread with garbage collections">
        {WORKERS.map((th, li) => {
          const y = 16 + li * (laneH + 6);
          const bins = TIMELINE.bins[th];
          return (
            <g key={th}>
              <text x={L - 6} y={y + 11} textAnchor="end" fontSize={10} fill="var(--mute)" fontFamily="var(--font-code)">
                {th}
              </text>
              <rect x={L} y={y} width={span} height={laneH} fill="var(--well-2)" />
              {bins.b.map((b, i) => (
                <rect key={`b${i}`} x={ox(i * 50)} y={y} width={rnd(span / 120)} height={laneH} fill="var(--meta)" opacity={rnd(b * 0.9 * dim("monitor"))} />
              ))}
              {bins.s.map((c, i) =>
                c > 0 ? <rect key={`s${i}`} x={ox(i * 50)} y={y + laneH - rnd((c / 5) * (laneH - 4)) - 2} width={rnd(span / 120 - 0.6)} height={rnd((c / 5) * (laneH - 4))} fill="var(--ink)" opacity={dim("sample")} /> : null,
              )}
            </g>
          );
        })}
        {(() => {
          const y = 16 + WORKERS.length * (laneH + 6);
          return (
            <g>
              <text x={L - 6} y={y + 11} textAnchor="end" fontSize={10} fill="var(--mute)" fontFamily="var(--font-code)">
                reporter
              </text>
              <rect x={L} y={y} width={span} height={laneH} fill="var(--well-2)" />
              {TIMELINE.sleep.map(([s, d], i) => (
                <rect key={i} x={ox(s)} y={y + 4} width={rnd((d / 6000) * span - 1)} height={laneH - 8} rx={2} fill="var(--faint)" opacity={dim("sleep") * 0.8} />
              ))}
            </g>
          );
        })()}
        {TIMELINE.gc.map(([s], i) => (
          <line key={i} x1={ox(s)} x2={ox(s)} y1={10} y2={16 + WORKERS.length * (laneH + 6) - 4} stroke="var(--hot)" strokeWidth={1} opacity={dim("gc")} />
        ))}
        <rect x={ox(2000)} y={8} width={rnd(ox(2400) - ox(2000))} height={oH - 24} fill="none" stroke="var(--ref)" strokeDasharray="3 2" />
        {[0, 1, 2, 3, 4, 5, 6].map((s) => (
          <text key={s} x={ox(s * 1000)} y={oH - 3} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            {s}s
          </text>
        ))}
      </svg>

      <div className="mt-3 mb-1 text-11 text-faint">
        zoomed into the <span className="text-ref">dashed box</span>: 2.0 to 2.4 s, every event
      </div>
      <svg viewBox={`0 0 ${W} ${zH}`} width={W} height={zH} className="block max-w-full" role="img" aria-label="400 millisecond zoom showing individual samples, lock waits and GC pauses">
        {WORKERS.map((th, li) => {
          const y = 10 + li * (laneH + 8);
          const win = TIMELINE.win[th];
          return (
            <g key={th}>
              <text x={L - 6} y={y + 11} textAnchor="end" fontSize={10} fill="var(--mute)" fontFamily="var(--font-code)">
                {th}
              </text>
              <rect x={L} y={y} width={span} height={laneH} fill="var(--well-2)" />
              {win.m.map(([s, d], i) => {
                const a = Math.max(0, s);
                const b = Math.min(400, s + d);
                return b > a ? <rect key={`m${i}`} x={zx(a)} y={y + 1} width={Math.max(0.8, rnd(zx(b) - zx(a)))} height={laneH - 2} fill="var(--meta)" opacity={0.75 * dim("monitor")} /> : null;
              })}
              {win.s.map((t, i) => (
                <circle key={`s${i}`} cx={zx(t)} cy={y + laneH / 2} r={2.6} fill="var(--ink)" opacity={dim("sample")} />
              ))}
            </g>
          );
        })}
        {TIMELINE.gc
          .filter(([s]) => s >= 2000 && s < 2400)
          .map(([s, d], i) => (
            <rect key={i} x={zx(s - 2000)} y={4} width={Math.max(1.2, rnd((d / 400) * span))} height={WORKERS.length * (laneH + 8) + 4} fill="var(--hot)" opacity={dim("gc")} />
          ))}
        {[0, 100, 200, 300, 400].map((ms) => (
          <text key={ms} x={zx(ms)} y={zH - 3} textAnchor={ms === 400 ? "end" : "middle"} fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            {(2 + ms / 1000).toFixed(1)}s
          </text>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="event type">
        {(
          [
            ["sample", "jdk.ExecutionSample"],
            ["monitor", "jdk.JavaMonitorEnter"],
            ["gc", "jdk.GarbageCollection"],
            ["sleep", "jdk.ThreadSleep"],
          ] as [Kind, string][]
        ).map(([k, label]) => (
          <button key={k} className="word" aria-pressed={kind === k} onClick={() => setKind(k)}>
            <span
              className="mr-1.5 inline-block size-2 rounded-[2px] align-middle"
              style={{ background: k === "sample" ? "var(--ink)" : k === "monitor" ? "var(--meta)" : k === "gc" ? "var(--hot)" : "var(--faint)" }}
            />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-3 py-2 text-11 leading-[1.55] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="text-faint">$ jfr print --events {kind === "sample" ? "jdk.ExecutionSample" : kind === "monitor" ? "jdk.JavaMonitorEnter" : kind === "gc" ? "jdk.GarbageCollection" : "jdk.ThreadSleep"} shop.jfr{"\n"}</span>
          {PRINT[kind]}
        </pre>
        <p className="font-serif text-17 leading-[1.6] text-ink @[640px]:self-center" aria-live="polite">
          {NOTE[kind]}
        </p>
      </div>
    </div>
  );
}
