"use client";

import { useState } from "react";

// a status board for features that aren't done yet. every row's status was checked against
// its JEP page or project page on openjdk.org; each chapter passes its own rows and says
// "as of" in the caption. colours: final = live (it's real), withdrawn = dead, anything in
// a JDK but still changing (preview, incubator, targeted, proposed) = hot, and plans that
// aren't in any JDK yet (candidate, draft, exploring) stay neutral.

export type Status = "final" | "targeted" | "proposed" | "integrated" | "preview" | "incubator" | "candidate" | "draft" | "exploring" | "withdrawn";

export type BoardRow = { name: string; jep?: string; status: Status; where: string; note: string };

const TONE: Record<Status, "live" | "hot" | "dead" | null> = {
  final: "live",
  targeted: "hot",
  proposed: "hot",
  integrated: "hot",
  preview: "hot",
  incubator: "hot",
  candidate: null,
  draft: null,
  exploring: null,
  withdrawn: "dead",
};

const LABEL: Record<Status, string> = {
  final: "final",
  targeted: "targeted",
  proposed: "proposed to target",
  integrated: "integrated",
  preview: "preview",
  incubator: "incubator",
  candidate: "candidate",
  draft: "draft",
  exploring: "exploring",
  withdrawn: "withdrawn",
};

export function StatusBoard({ rows, open: start = 0 }: { rows: BoardRow[]; open?: number }) {
  const [open, setOpen] = useState<number | null>(start);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] text-12">
      {rows.map((r, i) => {
        const tone = TONE[r.status];
        const c = tone ? `var(--${tone})` : "var(--mute)";
        const isOpen = open === i;
        return (
          <div key={r.name} className={`border-line ${i ? "border-t" : ""}`}>
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 text-left @container"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="min-w-0">
                <span className={isOpen ? "text-hi" : "text-ink"}>{r.name}</span>
                {r.jep && <span className="ml-2 text-11 text-faint">{r.jep}</span>}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="hidden text-11 text-faint sm:inline">{r.where}</span>
                <span
                  className="rounded-xs px-1.5 text-11 leading-[20px]"
                  style={{
                    color: c,
                    background: tone ? `color-mix(in srgb, ${c} 10%, transparent)` : undefined,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 55%, transparent)`,
                  }}
                >
                  {LABEL[r.status]}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="obj-in pb-3">
                <div className="mb-1 text-11 text-faint sm:hidden">{r.where}</div>
                <p className="font-serif text-[15.5px] leading-[1.6] text-ink">{r.note}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
