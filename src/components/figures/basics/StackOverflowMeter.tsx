"use client";

import { useEffect, useRef, useState } from "react";

// a bespoke figure, and the pattern for writing one:
//   - a client component in src/components/figures/<part>/
//   - colours only from tokens (var(--ref), var(--dead)...), each meaning its one thing
//   - controls laid out like a config file: `key =` on the left
//   - works without animation (prefers-reduced-motion jumps to the end)
//
// numbers measured on jdk 25 (temurin 25.0.4, macOS aarch64), first run, interpreted.
// default -Xss there is 2 MB. once the JIT compiles down(), frames shrink and the
// same stack fits more calls (1m: 20,773 cold vs 57,948 warm). see the chapter.

const STACKS = [
  { label: "512k", calls: 5_081 },
  { label: "1m", calls: 20_773 },
  { label: "2m", calls: 46_624 },
] as const;

export function StackOverflowMeter() {
  const [stack, setStack] = useState(2);
  const [depth, setDepth] = useState(1200);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);
  const max = STACKS[stack].calls;
  const used = Math.min(1, depth / max);
  const overflow = depth >= max;

  useEffect(() => {
    if (!running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDepth(max);
      setRunning(false);
      return;
    }
    const start = performance.now();
    const from = depth;
    const tick = (t: number) => {
      // ease-in: recursion feels slow, then very fast
      const p = Math.min(1, (t - start) / 2200);
      const next = Math.round(from + (max - from) * p * p);
      setDepth(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, max]);

  return (
    <div className="grid gap-8 sm:grid-cols-[132px_minmax(0,1fr)]">
      {/* the thread's stack, as a block of memory. frames pile up from the bottom */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-11 text-faint">thread stack</div>
        <div
          className="relative h-[280px] w-[112px] overflow-hidden rounded-xs bg-well"
          style={{ boxShadow: `inset 0 0 0 1px ${overflow ? "var(--dead)" : "var(--line-2)"}` }}
          role="img"
          aria-label={`${depth} frames, ${Math.round(used * 100)}% of the stack used`}
        >
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${used * 100}%`,
              background: `repeating-linear-gradient(to top, ${overflow ? "var(--dead)" : "var(--ink)"} 0 1px, transparent 1px 4px)`,
              opacity: overflow ? 0.9 : 0.55,
            }}
          />
          {/* the newest frame, on top */}
          {depth > 0 && (
            <div
              className="absolute inset-x-1.5 h-[18px] rounded-[1px] text-center text-[10px] leading-[18px]"
              style={{
                bottom: `calc(${used * 100}% - ${used >= 1 ? 18 : 0}px)`,
                background: overflow ? "var(--dead)" : "var(--hot)",
                color: "var(--bg)",
              }}
            >
              down()
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-[18px] bg-bg/40 text-center text-[10px] leading-[18px] text-mute">
            main()
          </div>
        </div>
        <div className="text-11 text-faint tabular">{Math.round(used * 100)}% used</div>
      </div>

      <div className="min-w-0 text-13">
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2.5">
          <span className="text-faint">-Xss =</span>
          <div className="flex gap-1">
            {STACKS.map((x, i) => (
              <button
                key={x.label}
                className="word"
                aria-pressed={stack === i}
                onClick={() => {
                  setStack(i);
                  setDepth((d) => Math.min(d, x.calls));
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-3 border-b border-line py-2.5">
          <span className="text-faint">depth =</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="slider min-w-0 flex-1"
              min={0}
              max={max}
              step={1}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              aria-label="recursion depth"
            />
            <span className="w-[8ch] text-right text-hi tabular">{depth.toLocaleString("en-US")}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-3.5">
          <button className="act solid" onClick={() => setRunning(true)} disabled={running || overflow}>
            recurse until it breaks
          </button>
          <button className="act" onClick={() => (setRunning(false), setDepth(0))}>
            reset
          </button>
        </div>

        <pre
          className="mt-1 min-h-[7.5em] overflow-x-auto rounded-xs bg-well px-4 py-3 text-12 leading-[1.7] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]"
          aria-live="polite"
        >
          {overflow ? (
            <>
              <span className="text-dead">Exception in thread &quot;main&quot; java.lang.StackOverflowError</span>
              {"\n"}
              <span className="text-mute">{"\tat Main.down(Main.java:3)\n\tat Main.down(Main.java:3)\n\tat Main.down(Main.java:3)\n"}</span>
              <span className="text-faint">{"\t... (the trace keeps the newest 1024 frames)"}</span>
            </>
          ) : (
            <span className="text-faint">
              {depth === 0
                ? "main() is the only frame."
                : `${depth.toLocaleString("en-US")} frames of down() on top of main().\nroom for ~${(max - depth).toLocaleString("en-US")} more.`}
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}
