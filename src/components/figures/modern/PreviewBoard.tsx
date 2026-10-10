"use client";

import { useState } from "react";
import { TRACKS, STAGE_LABEL, type Stage } from "./releases";
import { Narrate, ring, tint } from "../functional/kit";

// the five features that are preview or incubator in jdk 27, as rows across releases
// 16 to 28. the stages come from ./releases.ts; the "in 27" and "next" notes were
// checked against openjdk.org/jeps/531, 532, 533, 537, 538, 547 and the jdk 28 project
// page on 2026-10-09/10. "on jdk 25" says whether this chapter's example compiles on the
// site's jdk (25) with --enable-preview.

const IDS = ["primpat", "lazy", "sc", "pem", "vector"] as const;
const COLS = Array.from({ length: 13 }, (_, i) => 16 + i);

const DETAIL: Record<(typeof IDS)[number], { jep: number; what: string; changed: string; next: string; flags: string; on25: string }> = {
  primpat: {
    jep: 532,
    what: "patterns for primitive types: x instanceof byte b, case int i, switch on long, float, double and boolean.",
    changed: "fifth preview, no changes. the last real change was in 26 (JEP 530): a stricter definition of exact conversions and tighter dominance checks.",
    next: "nothing targeted to 28 yet.",
    flags: "javac --release 27 --enable-preview",
    on25: "yes: the same feature was in preview in 25 (JEP 507), so the example below runs on this site's jdk.",
  },
  lazy: {
    jep: 531,
    what: "values computed once, on first use, that the JVM can then treat as constants: LazyConstant, List.ofLazy, Map.ofLazy, Set.ofLazy.",
    changed: "third preview. removed isInitialized and orElse, added Set.ofLazy.",
    next: "JEP 547 proposes a fourth preview in 28, unchanged. it's a candidate, not targeted.",
    flags: "javac --release 27 --enable-preview",
    on25: "no: in 25 it was StableValue (JEP 502), a different API. the example below is jdk 27 code.",
  },
  sc: {
    jep: 533,
    what: "subtasks forked inside a block, all finished (or cancelled) when the block ends. the concurrency part has the full story.",
    changed: "seventh preview. a third type parameter for the exception join() throws, which is now ExecutionException; Joiner.awaitAll removed; onTimeout became timeout.",
    next: "JEP 543 is proposed to target 28 as a final feature.",
    flags: "javac --release 27 --enable-preview",
    on25: "the basic open, fork, join shape compiles on 25 (JEP 505) as well as 27, so the example below runs.",
  },
  pem: {
    jep: 538,
    what: "reading and writing keys and certificates in the -----BEGIN----- text format with PEMEncoder and PEMDecoder, no library needed.",
    changed: "third preview. PEM became an ordinary class, DEREncodable was renamed BinaryEncodable, withFactory became withFactoriesOf.",
    next: "JEP 542 is targeted to 28 as final.",
    flags: "javac --release 27 --enable-preview",
    on25: "the encode and decode calls below compile on 25 (JEP 470) and 27, so the example runs.",
  },
  vector: {
    jep: 537,
    what: "SIMD from plain java: one operation on a whole vector of numbers at a time, compiled to the CPU's vector instructions.",
    changed: "twelfth incubator, no API changes. it stays an incubator until valhalla's value classes are available as a preview.",
    next: "nothing targeted to 28 yet.",
    flags: "java --add-modules jdk.incubator.vector",
    on25: "an incubator module, not a preview: no --enable-preview, but --add-modules. the example compiles on 25 too.",
  },
};

function Glyph({ s }: { s: Stage }) {
  const size = 14;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="block">
      {s === "f" && <circle cx={c} cy={c} r={c - 2} fill="var(--live)" />}
      {s === "p" && (
        <>
          <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.25} />
          <path d={`M ${c} 2 A ${c - 2} ${c - 2} 0 0 1 ${c} ${size - 2} z`} fill="var(--ink)" />
        </>
      )}
      {s === "i" && <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--mute)" strokeWidth={1.25} strokeDasharray="2 2" />}
      {s === "t" && <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.25} strokeDasharray="1.5 2.5" />}
    </svg>
  );
}

export function PreviewBoard() {
  const [sel, setSel] = useState<(typeof IDS)[number]>("primpat");
  const rows = IDS.map((id) => TRACKS.find((t) => t.id === id)!);
  const d = DETAIL[sel];
  const track = rows.find((t) => t.id === sel)!;
  const prev = track.steps.filter((s) => s.s === "p").length;
  const inc = track.steps.filter((s) => s.s === "i").length;
  const tally = prev
    ? `${prev} preview${prev > 1 ? "s" : ""}${inc ? `, after ${inc} incubator${inc > 1 ? "s" : ""}` : ""}, through jdk 27.`
    : `${inc} incubators and no preview yet, through jdk 27.`;

  return (
    <div className="@container grid gap-4">
      <div className="overflow-x-auto rounded-md bg-bg/50 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="grid min-w-[520px] text-12" style={{ gridTemplateColumns: `10.5rem repeat(${COLS.length}, minmax(26px, 1fr))` }} role="table" aria-label="preview and incubator features by release">
          <div className="sticky left-0 z-[1] bg-well px-3 py-2 text-11 text-faint" role="columnheader">
            feature
          </div>
          {COLS.map((v) => (
            <div key={v} role="columnheader" className="py-2 text-center text-11 tabular" style={{ color: v === 27 ? "var(--hot)" : "var(--faint)", background: v === 27 ? tint("hot", 8) : undefined }}>
              {v}
            </div>
          ))}
          {rows.map((t) => {
            const on = t.id === sel;
            return [
              <button
                key={t.id}
                role="rowheader"
                onClick={() => setSel(t.id as (typeof IDS)[number])}
                aria-pressed={on}
                className="sticky left-0 z-[1] border-t border-line bg-well px-3 py-2 text-left text-12 transition-colors duration-200"
                style={{ color: on ? "var(--hot)" : "var(--ink)", boxShadow: on ? ring("hot", 60) : undefined }}
              >
                {t.short}
              </button>,
              ...COLS.map((v) => {
                const st = t.steps.find((x) => x.v === v);
                return (
                  <div
                    key={`${t.id}-${v}`}
                    role="cell"
                    onClick={() => setSel(t.id as (typeof IDS)[number])}
                    className="flex cursor-pointer items-center justify-center border-t border-line py-2"
                    style={{ background: v === 27 ? tint("hot", 5) : on ? tint("hot", 3) : undefined }}
                    title={st ? `${t.name}: ${STAGE_LABEL[st.s]} in ${v} (JEP ${st.jep})` : undefined}
                  >
                    {st ? <Glyph s={st.s} /> : null}
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        {(["i", "p", "f", "t"] as Stage[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <Glyph s={s} /> {STAGE_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="grid gap-0 rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        {[
          ["in 27", `JEP ${d.jep}: ${d.changed}`],
          ["what", d.what],
          ["next", d.next],
          ["try it", d.flags],
          ["on 25", d.on25],
        ].map(([k, v], i) => (
          <div key={k} className={`grid grid-cols-[7ch_minmax(0,1fr)] gap-3 px-4 py-2.5 text-12 leading-[1.6] ${i ? "border-t border-line" : ""}`}>
            <span className="text-faint">{k}</span>
            <span className={k === "try it" ? "text-hi" : "font-serif text-15 text-ink"}>{v}</span>
          </div>
        ))}
      </div>

      <Narrate minH="2em">
        {track.name}: {tally}
      </Narrate>
    </div>
  );
}
