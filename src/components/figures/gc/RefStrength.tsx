"use client";

import { useState } from "react";
import { Legend, Readout, Row, Words } from "./kit";

// the four strengths of reference, and what one GC does to each.
// every referent here is reachable ONLY through the reference in its row.
// rules (java.lang.ref javadoc): soft refs are cleared at the GC's discretion, and all of them
// before an OutOfMemoryError; weak refs are cleared as soon as the GC finds the referent weakly
// reachable; phantom get() always returns null, and since java 9 phantom refs are cleared when queued.

type Kind = "strong" | "soft" | "weak" | "phantom";
type Mem = "plenty" | "tight";

const ROWS: { k: Kind; code: string; dash?: string; opacity: number }[] = [
  { k: "strong", code: "Image img = load();", opacity: 1 },
  { k: "soft", code: "new SoftReference<>(load(), q)", dash: "7 3", opacity: 1 },
  { k: "weak", code: "new WeakReference<>(load(), q)", dash: "2 3", opacity: 1 },
  { k: "phantom", code: "new PhantomReference<>(load(), q)", dash: "1 4", opacity: 0.7 },
];

const survives = (k: Kind, mem: Mem) => k === "strong" || (k === "soft" && mem === "plenty");

const NOTES: Record<Mem, string> = {
  plenty:
    "after one GC with free memory to spare: the strong one obviously stays. the soft one stays too (the JVM keeps recently used soft referents while there's room). the weak one is gone the moment the GC noticed nothing strong points at it. the phantom one is queued so cleanup code can run, and its memory is reclaimed.",
  tight:
    "after a GC under memory pressure: the soft referent gets cleared too. the JVM guarantees every soft reference is cleared before it gives up and throws OutOfMemoryError. only the strong reference holds on, no matter what.",
};

export function RefStrength() {
  const [mem, setMem] = useState<Mem>("plenty");
  const [ran, setRan] = useState(false);

  return (
    <div className="grid gap-4">
      <div>
        <Row k="memory">
          <Words
            options={["plenty", "tight"] as const}
            value={mem}
            onChange={(m) => {
              setMem(m);
              setRan(false);
            }}
            label="memory pressure"
          />
        </Row>
        <div className="flex flex-wrap gap-2 py-3">
          <button className="act solid" onClick={() => setRan(true)} disabled={ran}>
            run a GC
          </button>
          <button className="act" onClick={() => setRan(false)} disabled={!ran}>
            reset
          </button>
        </div>
      </div>

      <div className="grid gap-2.5">
        {ROWS.map((r) => {
          const alive = !ran || survives(r.k, mem);
          const get = r.k === "phantom" ? "null" : alive ? "img" : "null";
          const queued = ran && !alive && r.k !== "strong";
          return (
            <div
              key={r.k}
              className="grid gap-1.5 border-b border-line pb-2.5 text-12 sm:grid-cols-[8ch_minmax(0,1fr)_64px_auto_14ch_14ch] sm:items-center sm:gap-x-3"
            >
              <div className="flex items-center justify-between gap-3 sm:contents">
                <span className="text-hi sm:order-1">{r.k}</span>
                <span
                  className="inline-flex h-7 items-center justify-center rounded-xs px-2 text-12 transition-[box-shadow,color,background-color] duration-200 ease-jle sm:order-4"
                  style={{
                    color: !ran ? "var(--ink)" : alive ? "var(--live)" : "var(--dead)",
                    boxShadow: `inset 0 0 0 1px ${!ran ? "var(--line-2)" : alive ? "var(--live)" : "var(--dead)"}`,
                    background: !ran
                      ? "var(--well-2)"
                      : alive
                        ? "color-mix(in srgb, var(--live) 10%, transparent)"
                        : "color-mix(in srgb, var(--dead) 8%, transparent)",
                    textDecoration: ran && !alive ? "line-through" : undefined,
                  }}
                >
                  Image
                </span>
              </div>
              <span className="truncate text-11 text-mute sm:order-2">{r.code}</span>
              <svg viewBox="0 0 64 16" className="hidden h-4 w-16 sm:order-3 sm:block" aria-hidden>
                <defs>
                  <marker id={`rs-${r.k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
                  </marker>
                </defs>
                <line
                  x1={2}
                  y1={8}
                  x2={58}
                  y2={8}
                  stroke="var(--ref)"
                  strokeWidth={1.4}
                  strokeDasharray={r.dash}
                  opacity={r.opacity}
                  markerEnd={`url(#rs-${r.k})`}
                />
              </svg>
              <div className="flex items-center justify-between gap-3 sm:contents">
                <span className="text-11 whitespace-nowrap text-faint sm:order-5">
                  get() → <span className={get === "null" ? "text-mute" : "text-ref"}>{get}</span>
                </span>
                <span
                  className="text-11 transition-opacity duration-200 sm:order-6"
                  style={{ color: "var(--meta)", opacity: queued ? 1 : r.k === "strong" ? 0 : 0.35 }}
                >
                  {queued ? "▸ in the queue" : r.k === "strong" ? "" : "not queued"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Readout minLines={4}>
        {ran
          ? NOTES[mem]
          : "four Image objects, each reachable only through the reference in its row. notice the phantom one: get() returns null even now, by design. pick how much memory is free, then run a GC."}
      </Readout>
      <Legend
        items={[
          ["ref", "the reference"],
          ["live", "still there after the GC"],
          ["dead", "collected"],
          ["meta", "enqueued on its ReferenceQueue"],
        ]}
      />
    </div>
  );
}
