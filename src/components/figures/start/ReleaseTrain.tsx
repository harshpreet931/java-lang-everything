"use client";

import { useState } from "react";

// java 8 → 27 drawn to scale. dates and headline features checked against
// openjdk.org/projects/jdk/<n> (GA dates) and the JEPs each release delivered.

type R = { v: number; y: number; m: number; lts?: boolean; what: string[] };

const RELEASES: R[] = [
  { v: 8, y: 2014, m: 3, lts: true, what: ["lambdas and streams", "java.time"] },
  { v: 9, y: 2017, m: 9, what: ["modules (JPMS)", "jshell"] },
  { v: 10, y: 2018, m: 3, what: ["var for local variables"] },
  { v: 11, y: 2018, m: 9, lts: true, what: ["java Main.java (no javac step)", "HttpClient", "String.strip, isBlank, repeat"] },
  { v: 12, y: 2019, m: 3, what: ["switch expressions (preview)"] },
  { v: 13, y: 2019, m: 9, what: ["text blocks (preview)"] },
  { v: 14, y: 2020, m: 3, what: ["switch expressions", "helpful NullPointerException messages"] },
  { v: 15, y: 2020, m: 9, what: ["text blocks", "ZGC ready for production"] },
  { v: 16, y: 2021, m: 3, what: ["records", "pattern matching for instanceof"] },
  { v: 17, y: 2021, m: 9, lts: true, what: ["sealed classes", "JDK internals strongly encapsulated"] },
  { v: 18, y: 2022, m: 3, what: ["UTF-8 by default", "jwebserver"] },
  { v: 19, y: 2022, m: 9, what: ["virtual threads (preview)"] },
  { v: 20, y: 2023, m: 3, what: ["all previews: record patterns, scoped values, more"] },
  { v: 21, y: 2023, m: 9, lts: true, what: ["virtual threads", "pattern matching for switch", "record patterns", "sequenced collections"] },
  { v: 22, y: 2024, m: 3, what: ["foreign function & memory API", "unnamed variables _", "multi-file java Main.java"] },
  { v: 23, y: 2024, m: 9, what: ["markdown doc comments", "generational ZGC by default"] },
  { v: 24, y: 2025, m: 3, what: ["stream gatherers", "virtual threads stop pinning on synchronized"] },
  { v: 25, y: 2025, m: 9, lts: true, what: ["void main() + IO.println", "flexible constructor bodies", "import module", "compact object headers"] },
  { v: 26, y: 2026, m: 3, what: ["HTTP/3 in HttpClient", "AOT object caching with any GC", "applet API removed"] },
  { v: 27, y: 2026, m: 9, what: ["G1 is the default GC everywhere", "compact object headers by default"] },
];

const MONTH = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const T0 = 2013.9;
const T1 = 2027.1;
const pos = (r: R) => ((r.y + (r.m - 1) / 12 - T0) / (T1 - T0)) * 100;

export function ReleaseTrain() {
  const [i, setI] = useState(RELEASES.findIndex((r) => r.v === 25));
  const r = RELEASES[i];

  return (
    <div className="font-mono @container">
      <div
        className="relative h-[76px] select-none"
        role="group"
        aria-label="java releases from 8 to 27 on a timeline"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setI((x) => Math.min(RELEASES.length - 1, x + 1));
          if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
        }}
      >
        {/* the rail */}
        <div className="absolute inset-x-0 top-[46px] h-px bg-line-2" />
        {/* year marks */}
        {[2014, 2016, 2018, 2020, 2022, 2024, 2026].map((y) => (
          <span
            key={y}
            className="absolute top-[58px] -translate-x-1/2 text-[10px] text-faint tabular"
            style={{ left: `${((y - T0) / (T1 - T0)) * 100}%` }}
          >
            {y}
          </span>
        ))}
        {/* the gap */}
        <span
          className="absolute top-[26px] hidden text-[10px] text-faint @[520px]:block"
          style={{ left: `${pos(RELEASES[0]) + 6}%` }}
        >
          3.5 years of waiting
        </span>

        {RELEASES.map((x, j) => {
          const on = j === i;
          const tall = x.lts || x.v === 27;
          return (
            <button
              key={x.v}
              onClick={() => setI(j)}
              onMouseEnter={() => setI(j)}
              aria-label={`java ${x.v}${x.lts ? ", LTS" : ""}`}
              aria-pressed={on}
              className="group absolute top-0 flex h-[47px] w-[14px] -translate-x-1/2 flex-col items-center justify-end"
              style={{ left: `${pos(x)}%` }}
            >
              <span
                className={`mb-1 text-11 tabular transition-colors duration-150 ${
                  on ? "text-hot" : tall ? "text-hi" : "hidden text-faint @[640px]:inline"
                }`}
              >
                {x.v}
              </span>
              <span
                className="w-px transition-[background-color,height] duration-150"
                style={{
                  height: on ? 26 : tall ? 22 : 10,
                  background: on ? "var(--hot)" : tall ? "var(--hi)" : "var(--mute)",
                  width: x.lts ? 3 : 1,
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 @[560px]:grid-cols-[24ch_minmax(0,1fr)]" aria-live="polite">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-20 font-light text-hi tabular">java {r.v}</span>
          </div>
          <div className="mt-1 text-12 text-mute">
            {MONTH[r.m]} {r.y}
            {r.lts && <span className="ml-2 text-hi">LTS</span>}
            {r.v === 25 && <span className="ml-2 text-faint">this site</span>}
            {r.v === 27 && <span className="ml-2 text-faint">latest</span>}
          </div>
        </div>
        <ul className="grid gap-1 text-13 text-ink">
          {r.what.map((w) => (
            <li key={w} className="flex gap-2">
              <span className="text-faint">→</span>
              {w}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        <button className="act !px-2.5" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="previous release">
          ←
        </button>
        <button
          className="act !px-2.5"
          onClick={() => setI((x) => Math.min(RELEASES.length - 1, x + 1))}
          disabled={i === RELEASES.length - 1}
          aria-label="next release"
        >
          →
        </button>
        <span className="ml-auto flex items-center gap-2 text-11 text-faint">
          <span className="inline-block h-3 w-[3px] bg-hi" /> LTS
        </span>
      </div>
    </div>
  );
}
