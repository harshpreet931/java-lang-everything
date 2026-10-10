"use client";

import { useState } from "react";
import { Console, Row } from "./kit";

// EnumSet for an enum with up to 64 constants is a RegularEnumSet: one long called
// `elements`, bit i set when the constant with ordinal i is in the set. (checked on jdk 25:
// EnumSet.of(TUE, SAT) of a 7-day enum has elements == 34.) more than 64 constants →
// JumboEnumSet, a long[].

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const SHOWN = 16; // low bits drawn; the other 48 are always 0 for this enum

export function EnumSetBits() {
  const [bits, setBits] = useState(0b0100010); // TUE, SAT
  const [log, setLog] = useState<React.ReactNode>(
    <>
      <span className="text-faint">{"EnumSet<Day> days = EnumSet.of(TUE, SAT);\n"}</span>
      <span className="say text-mute">two bits set: 1 and 5. elements = 2 + 32 = 34.</span>
    </>,
  );

  const toggle = (i: number) => {
    const on = !!(bits & (1 << i));
    const next = bits ^ (1 << i);
    setBits(next);
    setLog(
      <>
        <span className="text-faint">{on ? `days.remove(${DAYS[i]});\n` : `days.add(${DAYS[i]});\n`}</span>
        <span className="text-ink">{on ? `elements &= ~(1L << ${i});  // ordinal ${i}\n` : `elements |= (1L << ${i});  // ordinal ${i}\n`}</span>
        <span className="say text-mute">one bit flipped. no hashing, no objects, no boxing.</span>
      </>,
    );
  };

  const op = (label: string, v: number, code: string, say: string) => {
    setBits(v);
    setLog(
      <>
        <span className="text-faint">{label + "\n"}</span>
        <span className="text-ink">{code + "\n"}</span>
        <span className="say text-mute">{say}</span>
      </>,
    );
  };

  const all = (1 << DAYS.length) - 1;
  const members = DAYS.filter((_, i) => bits & (1 << i));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="days =">
          {DAYS.map((d, i) => (
            <button key={d} className="word" aria-pressed={!!(bits & (1 << i))} onClick={() => toggle(i)}>
              {d}
            </button>
          ))}
        </Row>
        <Row k="EnumSet." last>
          <button className="act" onClick={() => op("EnumSet.noneOf(Day.class)", 0, "elements = 0;", "empty set: every bit off.")}>
            noneOf
          </button>
          <button className="act" onClick={() => op("EnumSet.allOf(Day.class)", all, `elements = -1L >>> -${DAYS.length};  // the low ${DAYS.length} bits`, "every constant: the low 7 bits on, in one assignment.")}>
            allOf
          </button>
          <button className="act" onClick={() => op("EnumSet.range(SAT, SUN)", 0b1100000, "elements = (-1L >>> (5 - 6 - 1)) << 5;", "a range is a run of ones, shifted into place.")}>
            range(SAT, SUN)
          </button>
          <button
            className="act"
            onClick={() => op("EnumSet.complementOf(days)", ~bits & all, "elements = ~elements & (-1L >>> -7);", "complement: flip every bit, then mask off the ones past the last constant.")}
          >
            complementOf
          </button>
        </Row>
      </div>

      <div className="overflow-x-auto">
        <div className="mb-1.5 text-11 text-faint">
          long elements <span className="text-faint">(bit 63 … bit 0, the top 48 are always 0 for a 7-constant enum)</span>
        </div>
        <div className="flex w-max items-end gap-0">
          <div className="mr-2 pb-[22px] text-12 text-faint">0…0</div>
          {Array.from({ length: SHOWN }, (_, k) => {
            const i = SHOWN - 1 - k;
            const on = !!(bits & (1 << i));
            const used = i < DAYS.length;
            return (
              <div key={i} className={`flex w-[30px] flex-col items-center ${k % 4 === 0 && k ? "ml-1.5" : ""}`}>
                <div className="h-[14px] text-[9px] leading-[14px] text-faint">{used ? DAYS[i] : ""}</div>
                <button
                  disabled={!used}
                  onClick={() => used && toggle(i)}
                  aria-label={used ? `bit ${i}: ${DAYS[i]} ${on ? "in" : "not in"} the set` : `bit ${i}, unused`}
                  className="-ml-px flex h-[30px] w-full items-center justify-center text-13 tabular transition-colors duration-150 disabled:cursor-default"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
                    background: on ? "color-mix(in srgb, var(--hot) 16%, var(--bg))" : used ? "var(--bg)" : "transparent",
                    color: on ? "var(--hot)" : used ? "var(--mute)" : "var(--faint)",
                  }}
                >
                  {on ? 1 : 0}
                </button>
                <div className="mt-0.5 text-[9px] text-faint tabular">{i}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-13">
        <span className="text-mute">
          elements = <span className="text-hi tabular">{bits}</span>
        </span>
        <span className="text-mute">
          set = <span className="text-hi">[{members.join(", ")}]</span>
        </span>
        <span className="text-mute">
          contains(FRI) = <span className="text-hi">(elements &amp; 1L &lt;&lt; 4) != 0</span> →{" "}
          <span className={bits & 16 ? "text-live" : "text-dead"}>{String(!!(bits & 16))}</span>
        </span>
      </div>
      <Console label="what EnumSet just did">{log}</Console>
    </div>
  );
}
