"use client";

import { useState } from "react";

// the order `new Child()` runs things in, as two swimlanes (Parent | Child).
// toggles: first vs second `new` (static init only happens once per class),
// and which constructor you call (this(...) adds a hop and an epilogue).
// the order is the one printed by the chapter's Main.java on jdk 25.

type Lane = "P" | "C" | "both";
type Row = { lane: Lane; text: string; kind: "static" | "alloc" | "call" | "init" | "body"; only?: "first" | "noArg"; note?: string };

const ROWS: Row[] = [
  { lane: "P", kind: "static", only: "first", text: "static fields + static blocks, top to bottom", note: "once per class, ever" },
  { lane: "C", kind: "static", only: "first", text: "static fields + static blocks, top to bottom", note: "once per class, ever" },
  { lane: "both", kind: "alloc", text: "allocate one object. every field, Parent's and Child's, is zeroed" },
  { lane: "C", kind: "call", only: "noArg", text: 'Child() starts: this("rex")' },
  { lane: "C", kind: "call", text: "Child(String) starts: super()" },
  { lane: "P", kind: "call", text: "Parent() starts: super() → Object()" },
  { lane: "P", kind: "init", text: "field initializers + init blocks, in source order" },
  { lane: "P", kind: "body", text: "rest of the Parent() body" },
  { lane: "C", kind: "init", text: "field initializers + init blocks, in source order", note: "only in the constructor that called super()" },
  { lane: "C", kind: "body", text: "rest of the Child(String) body" },
  { lane: "C", kind: "body", only: "noArg", text: "rest of the Child() body", note: "first to start, last to finish" },
];

const tone = (k: Row["kind"]) => (k === "static" ? "var(--meta)" : k === "alloc" ? "var(--hot)" : k === "call" ? "var(--mute)" : "var(--hi)");

export function InitLadder() {
  const [second, setSecond] = useState(false);
  const [noArg, setNoArg] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const rows = ROWS.filter((r) => r.only !== "noArg" || noArg);
  let n = 0;

  return (
    <div className="grid gap-5 text-13">
      <div>
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">which =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={!second} onClick={() => setSecond(false)}>
              first new
            </button>
            <button className="word" aria-pressed={second} onClick={() => setSecond(true)}>
              second new
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">call =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={noArg} onClick={() => setNoArg(true)}>
              new Child()
            </button>
            <button className="word" aria-pressed={!noArg} onClick={() => setNoArg(false)}>
              new Child(&quot;rex&quot;)
            </button>
          </div>
        </div>
      </div>

      <div role="list" aria-label="initialization order" className="grid">
        <div className="grid grid-cols-[3ch_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-line-2 pb-1.5 text-11 text-faint">
          <span />
          <span>Parent</span>
          <span>Child</span>
        </div>
        {rows.map((r, i) => {
          const skipped = second && r.only === "first";
          if (!skipped) n++;
          const on = hover === i && !skipped;
          const cell = (
            <div
              className={`rounded-md px-2.5 py-1.5 text-12 sm:text-13 transition-[box-shadow,opacity] duration-200 ease-jle ${skipped ? "opacity-35" : ""}`}
              style={{
                boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : r.kind === "static" ? "color-mix(in srgb, var(--meta) 55%, transparent)" : r.kind === "alloc" ? "color-mix(in srgb, var(--hot) 55%, transparent)" : "var(--line-2)"}`,
                background: "var(--well)",
              }}
            >
              <span className={skipped ? "line-through" : ""} style={{ color: tone(r.kind) }}>
                {r.text}
              </span>
              {(r.note || skipped) && (
                <span className="mt-0.5 block text-11 text-faint">{skipped ? "skipped: already initialized" : r.note}</span>
              )}
            </div>
          );
          return (
            <div
              key={`${r.lane}-${r.text}-${i}`}
              role="listitem"
              className="grid grid-cols-[3ch_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 py-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={`text-right text-12 tabular ${skipped ? "text-faint/50" : on ? "text-hot" : "text-faint"}`}>{skipped ? "·" : n}</span>
              {r.lane === "both" ? (
                <div className="col-span-2">{cell}</div>
              ) : (
                <>
                  <div className="min-w-0">{r.lane === "P" ? cell : <Lifeline />}</div>
                  <div className="min-w-0">{r.lane === "C" ? cell : <Lifeline />}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Lifeline() {
  return <div className="mx-auto h-full min-h-6 w-px bg-line" aria-hidden />;
}
