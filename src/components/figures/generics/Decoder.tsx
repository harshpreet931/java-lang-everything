"use client";

import { useState } from "react";
import { Java, Narrate, tint } from "../functional/kit";

// a scary signature, taken apart one piece at a time. click a piece (or step
// through them) to read what it means. data lives in ./decoders.ts.

export type Part = { t: string; note?: string; title?: string };

export function Decoder({ parts, read, label }: { parts: Part[]; read: string; label?: string }) {
  const notes = parts.map((p, i) => (p.note ? i : -1)).filter((i) => i >= 0);
  const [sel, setSel] = useState<number | null>(notes[0] ?? null);
  const at = sel === null ? -1 : notes.indexOf(sel);
  const go = (d: number) => setSel(notes[(at + d + notes.length) % notes.length]);

  return (
    <div className="@container grid gap-4">
      {label && <div className="text-11 text-faint">{label}</div>}
      <div className="overflow-x-auto rounded-md bg-bg px-4 py-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="flex flex-wrap items-baseline gap-y-1.5 text-13 whitespace-pre @[560px]:text-15" role="group" aria-label="pieces of the signature">
          {parts.map((p, i) =>
            p.note ? (
              <button
                key={i}
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className="rounded-sm border-b-2 transition-[background-color,border-color] duration-200 ease-jle"
                style={{
                  borderColor: sel === i ? "var(--hot)" : "var(--line-2)",
                  background: sel === i ? tint("hot", 14) : undefined,
                }}
              >
                <Java code={p.t} />
              </button>
            ) : (
              <span key={i} className="opacity-70">
                <Java code={p.t} />
              </span>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="act" onClick={() => go(-1)} aria-label="previous piece">
          ←
        </button>
        <button className="act solid" onClick={() => go(1)}>
          next piece →
        </button>
        <span className="ml-auto text-12 text-faint tabular">
          {at + 1} / {notes.length}
        </span>
      </div>

      <Narrate minH="4.6em">
        {sel !== null && (
          <>
            {parts[sel].title && <span className="mr-2 font-mono text-13 text-hot">{parts[sel].title}</span>}
            {parts[sel].note}
          </>
        )}
      </Narrate>

      <div className="border-t border-line pt-3 font-serif text-16 leading-[1.6] text-mute italic">
        <span className="mr-2 font-mono text-11 text-faint not-italic">read it out loud</span>
        {read}
      </div>
    </div>
  );
}
