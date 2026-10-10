"use client";

import { useState } from "react";
import { Narr } from "./kit";

// one moment, 2026-03-08T07:30:00Z, held by each java.time type.
// the strings are the real toString() output on jdk 25 (zone America/New_York).

type T = {
  name: string;
  date?: string;
  time?: string;
  offset?: string;
  zone?: string;
  instant?: string;
  moment: boolean;
  use: string;
};

const TYPES: T[] = [
  {
    name: "Instant",
    instant: "1,772,955,000 s since 1970-01-01T00:00Z",
    moment: true,
    use: "a point on the global timeline, no calendar, no zone. timestamps, logs, database columns, \"when did this happen\". prints as 2026-03-08T07:30:00Z.",
  },
  { name: "LocalDate", date: "2026-03-08", moment: false, use: "a date on a calendar with no time and no place. birthdays, due dates, holidays." },
  { name: "LocalTime", time: "03:30", moment: false, use: "a time of day with no date and no place. \"the shop opens at 09:00\"." },
  {
    name: "LocalDateTime",
    date: "2026-03-08",
    time: "03:30",
    moment: false,
    use: "what a wall clock says, with no idea which wall. it is NOT a moment: 03:30 in new york and 03:30 in tokyo are 13 hours apart. good for a meeting time before you know the zone, bad for anything stored or compared.",
  },
  {
    name: "OffsetDateTime",
    date: "2026-03-08",
    time: "03:30",
    offset: "-04:00",
    moment: true,
    use: "a wall-clock time plus how far it is from UTC. exactly one moment, but it doesn't know any DST rules, so it can't tell you what the offset will be tomorrow. what most APIs and JSON timestamps send.",
  },
  {
    name: "ZonedDateTime",
    date: "2026-03-08",
    time: "03:30",
    offset: "-04:00",
    zone: "America/New_York",
    moment: true,
    use: "offset plus the zone's rules. it knows that adding a day here crosses a DST change. use it for calendar math in a place: \"9am every day, new york time\".",
  },
];

const COLS = ["date", "time", "offset", "zone"] as const;

export function TimeTypes() {
  const [sel, setSel] = useState("LocalDateTime");
  const t = TYPES.find((x) => x.name === sel)!;

  return (
    <div className="@container grid gap-4 font-mono">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-12">
          <thead>
            <tr className="text-11 text-faint">
              <th className="py-1.5 pr-3 text-left font-mono font-normal">type</th>
              {COLS.map((c) => (
                <th key={c} className="py-1.5 pr-3 text-left font-mono font-normal">
                  {c}
                </th>
              ))}
              <th className="py-1.5 text-right font-mono font-normal">a moment?</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((x) => {
              const on = x.name === sel;
              return (
                <tr
                  key={x.name}
                  onClick={() => setSel(x.name)}
                  className="cursor-pointer border-t border-line transition-colors duration-150"
                  style={{ background: on ? "var(--well-2)" : undefined }}
                >
                  <td className="py-2 pr-3">
                    <button className={`text-left ${on ? "text-hi" : "text-ink"}`} aria-pressed={on} onClick={() => setSel(x.name)}>
                      {x.name}
                    </button>
                  </td>
                  {x.instant ? (
                    <td colSpan={4} className="py-2 pr-3 text-mute">
                      {x.instant}
                    </td>
                  ) : (
                    COLS.map((c) => (
                      <td key={c} className="py-2 pr-3" style={{ color: x[c] ? "var(--hi)" : "var(--faint)" }}>
                        {x[c] ?? "·"}
                      </td>
                    ))
                  )}
                  <td className="py-2 text-right" style={{ color: x.moment ? "var(--live)" : "var(--faint)" }}>
                    {x.moment ? "yes" : "no"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line pt-3" aria-live="polite">
        <div className="text-12 text-hot">{t.name}</div>
        <Narr className="mt-1">{t.use}</Narr>
      </div>
    </div>
  );
}
