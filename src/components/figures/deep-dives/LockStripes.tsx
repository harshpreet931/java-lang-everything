"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// who blocks whom in ConcurrentHashMap, java 7 vs java 8+.
// java 7: 16 Segments (each a ReentrantLock with its own little table). with the
// default sizes each segment's table has 2 slots, so 32 slots in total. which segment a
// key lands in comes from the high bits of its hash; drawing segments as neighbouring
// pairs is a simplification of that.
// java 8+ (jdk 25 source): empty bin → casTabAt, no lock. otherwise synchronized on
// the bin's first node. jdk 25 still has a Segment class, only for serialization.

type Mode = "7" | "8";
type Scene = "neighbours" | "same" | "empty";

const FULL = new Set([1, 3, 4, 7, 10, 11, 13, 16, 18, 19, 24, 27, 29, 30]);

const SCENES: Record<Scene, { a: number; b: number; label: string }> = {
  neighbours: { a: 10, b: 11, label: "different bins" },
  same: { a: 10, b: 10, label: "same bin" },
  empty: { a: 6, b: 21, label: "empty bins" },
};

export function LockStripes() {
  const [mode, setMode] = useState<Mode>("8");
  const [scene, setScene] = useState<Scene>("neighbours");
  const { a, b } = SCENES[scene];

  const seg = (i: number) => i >> 1;
  let outA: string;
  let outB: string;
  let bWaits = false;
  if (mode === "7") {
    outA = `locks segment ${seg(a)} (a ReentrantLock), writes slot ${a}.`;
    if (seg(a) === seg(b)) {
      bWaits = true;
      outB = `needs segment ${seg(b)} too. waits until A unlocks it.`;
    } else outB = `locks segment ${seg(b)}, a different lock. no waiting.`;
  } else {
    outA = FULL.has(a) ? `synchronized on bin ${a}'s first node, appends.` : `bin ${a} is empty: one CAS, no lock at all.`;
    if (a === b && FULL.has(a)) {
      bWaits = true;
      outB = `same first node, same monitor. waits for A.`;
    } else outB = FULL.has(b) ? `synchronized on bin ${b}'s first node, a different monitor. no waiting.` : `bin ${b} is empty: one CAS, no lock at all.`;
  }

  return (
    <div className="@container text-13">
      <Row k="version =" w="10ch">
        <Words
          label="version"
          value={mode}
          onChange={setMode}
          options={[
            { v: "7", label: "java 7: segments" },
            { v: "8", label: "java 8+: bins" },
          ]}
        />
      </Row>
      <Row k="A and B =" w="10ch" last>
        <Words
          label="where the two writes land"
          value={scene}
          onChange={setScene}
          options={(Object.keys(SCENES) as Scene[]).map((s) => ({ v: s, label: SCENES[s].label }))}
        />
      </Row>

      <div className="mt-2 grid gap-5 border-t border-line pt-5">
        {[0, 16].map((from) => (
          <div key={from} className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-x-[3px]">
            {Array.from({ length: 16 }, (_, c) => {
              const i = from + c;
              const full = FULL.has(i);
              const isA = i === a;
              const isB = i === b;
              const tgt = isA || isB;
              const waiting = bWaits && isB && (mode === "8" || seg(a) === seg(b));
              const segOn = mode === "7" && (seg(i) === seg(a) || seg(i) === seg(b));
              const locked = mode === "7" ? segOn : tgt && full;
              return (
                <div key={i} className="flex min-w-0 flex-col items-center">
                  <span className="h-4 text-[10px] leading-4 text-hot">
                    {isA && isB ? "AB" : isA ? "A" : isB ? "B" : ""}
                  </span>
                  <div
                    className="flex h-8 w-full items-center justify-center rounded-[1px] transition-[box-shadow,background-color] duration-200"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${tgt ? (waiting && !isA ? "var(--dead)" : "var(--hot)") : full ? "var(--line-2)" : "var(--line)"}`,
                      background: tgt ? `color-mix(in srgb, var(${waiting && !isA ? "--dead" : "--hot"}) 12%, transparent)` : undefined,
                    }}
                  >
                    {full ? (
                      <span
                        className="size-2 rounded-full transition-[box-shadow] duration-200"
                        style={{
                          background: "var(--ink)",
                          boxShadow: mode === "8" && locked ? "0 0 0 2px var(--well), 0 0 0 3px var(--meta)" : undefined,
                        }}
                      />
                    ) : (
                      mode === "8" && tgt && <span className="text-[9px] text-live">CAS</span>
                    )}
                  </div>
                  <span className="mt-0.5 hidden text-[10px] text-faint tabular @[480px]:block">{i}</span>
                  {mode === "7" && c % 2 === 0 && (
                    <div
                      className="relative mt-1 h-2 w-[calc(200%+3px)] self-start border-x border-b transition-colors duration-200"
                      style={{ borderColor: segOn ? "var(--meta)" : "var(--line-2)" }}
                      aria-hidden
                    />
                  )}
                  {mode === "7" && c % 2 === 1 && <div className="mt-1 h-2" aria-hidden />}
                  {mode === "7" && c % 2 === 0 && (
                    <span className={`mt-0.5 w-[calc(200%+3px)] self-start text-center text-[9px] tabular ${segOn ? "text-meta" : "text-faint"}`}>
                      s{seg(i)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-1.5 border-t border-line pt-4 text-13" aria-live="polite">
        <div>
          <span className="text-hot">A</span> <span className="text-ink">{outA}</span>
        </div>
        <div>
          <span className="text-hot">B</span> <span style={{ color: bWaits ? "var(--dead)" : "var(--ink)" }}>{outB}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-11 text-faint">
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-ink align-middle" /> a bin with nodes
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 border border-meta align-middle" /> {mode === "7" ? "a segment's lock, held" : "a first node, used as the lock"}
          </span>
        </div>
      </div>
    </div>
  );
}
