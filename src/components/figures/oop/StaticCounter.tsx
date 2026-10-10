"use client";

import { useState } from "react";

// one shared box vs one box per object. `new Ticket()` bumps a counter and copies it into id.
// flip `issued` to an instance field (forgetting `static`) and every ticket gets its own counter,
// so every id comes out 1. the program is in the chapter, outputs checked on jdk 25.

const MAX = 5;

export function StaticCounter() {
  const [isStatic, setStatic] = useState(true);
  const [count, setCount] = useState(3);
  const [fresh, setFresh] = useState<number | null>(null);

  const tickets = Array.from({ length: count }, (_, i) => ({ id: isStatic ? i + 1 : 1, issued: 1 }));

  const add = () => {
    if (count >= MAX) return;
    setFresh(count);
    setCount(count + 1);
  };

  return (
    <div className="grid gap-5 text-13">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* the source, with the one keyword that matters */}
        <pre className="overflow-x-auto rounded-md bg-well py-3 text-12 leading-[1.75] shadow-[inset_0_0_0_1px_var(--line)]">
          {[
            ["class Ticket {", ""],
            [isStatic ? "    static int issued = 0;" : "    int issued = 0;", "hot"],
            ["    final int id;", ""],
            ["", ""],
            ["    Ticket() {", ""],
            ["        issued++;", ""],
            ["        id = issued;", ""],
            ["    }", ""],
            ["}", ""],
          ].map(([l, t], i) => (
            <div
              key={i}
              className="grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4"
              style={{
                borderColor: t ? (isStatic ? "var(--hot)" : "var(--dead)") : "transparent",
                background: t ? `color-mix(in srgb, ${isStatic ? "var(--hot)" : "var(--dead)"} 9%, transparent)` : undefined,
              }}
            >
              <span className="text-right text-faint/60 tabular">{i + 1}</span>
              <span className="whitespace-pre" style={{ color: t ? (isStatic ? "var(--hot)" : "var(--dead)") : "var(--ink)" }}>
                {l || " "}
              </span>
            </div>
          ))}
        </pre>

        <div className="min-w-0">
          <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center border-b border-line py-2">
            <span className="text-faint">issued =</span>
            <div className="flex flex-wrap gap-1">
              <button className="word" aria-pressed={isStatic} onClick={() => (setStatic(true), setFresh(null))}>
                static
              </button>
              <button className="word" aria-pressed={!isStatic} onClick={() => (setStatic(false), setFresh(null))}>
                forgot static
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 py-3">
            <button className="act solid" onClick={add} disabled={count >= MAX}>
              new Ticket()
            </button>
            <button className="act" onClick={() => (setCount(0), setFresh(null))} disabled={count === 0}>
              reset
            </button>
          </div>
          <p className="font-serif text-15 leading-[1.6] text-mute" aria-live="polite">
            {count === 0
              ? "no tickets yet."
              : isStatic
                ? `one issued, shared by all ${count}. each constructor bumps the same box, so ids come out 1, 2, 3...`
                : `${count} tickets, ${count} separate issued fields, each bumped exactly once. every id is 1.`}
          </p>
        </div>
      </div>

      {/* memory: the class's box on top, the objects below */}
      <div className="grid gap-3">
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-well px-3.5 py-2.5 text-12 transition-[box-shadow] duration-200"
          style={{ boxShadow: "inset 0 0 0 1px var(--meta)" }}
        >
          <span>
            <span className="text-hi">class Ticket</span> <span className="text-meta">· one per JVM</span>
          </span>
          {isStatic ? (
            <span className="flex items-baseline gap-3">
              <span className="text-mute">static issued</span>
              <span key={count} className="flash text-15 text-hi tabular">
                {count}
              </span>
            </span>
          ) : (
            <span className="text-faint">no static fields</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tickets.length === 0 && <span className="text-12 text-faint">heap: no Ticket objects.</span>}
          {tickets.map((t, i) => (
            <div
              key={i}
              className="obj-in min-w-[118px] rounded-md bg-well px-3 py-2 text-12"
              style={{ boxShadow: `inset 0 0 0 1px ${fresh === i ? "var(--hot)" : "var(--line-2)"}` }}
            >
              <div className="mb-1 text-hi">Ticket</div>
              {!isStatic && (
                <div className="flex justify-between gap-3 border-b border-line py-[3px]">
                  <span className="text-mute">issued</span>
                  <span className="text-dead tabular">{t.issued}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 py-[3px]">
                <span className="text-mute">id</span>
                <span className={`tabular ${isStatic ? "text-live" : "text-dead"}`}>{t.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
