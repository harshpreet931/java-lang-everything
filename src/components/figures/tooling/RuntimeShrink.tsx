"use client";

import { useState } from "react";
import { Row, Toggle, Words, fmt } from "./kit";

// every number measured on temurin 25.0.4.1, macOS aarch64 (M4 Pro), oct 2026.
// size: sum of file sizes in the jlink output. startup: `java -cp out Hello` (hello world),
// median of 40 runs interleaved across all runtimes, after 3 warm-up runs.
// startup was measured on the java.base runtimes; the bigger module sets landed within a
// few ms of them in a first, noisier pass.

type Mods = "base" | "app" | "se";
const MODS: { v: Mods; label: string; arg: string }[] = [
  { v: "base", label: "java.base", arg: "java.base" },
  { v: "app", label: "+ http, sql, logging", arg: "java.base,java.net.http,java.sql,java.logging" },
  { v: "se", label: "java.se (all of SE)", arg: "java.se" },
];

// [strip][zip][cds] → MB
const SIZE: Record<Mods, number[][][]> = {
  base: [
    [
      [49.1, 78.0],
      [34.2, 63.0],
    ],
    [
      [44.4, 71.4],
      [31.5, 58.6],
    ],
  ],
  app: [
    [
      [63.0, 92.4],
      [39.9, 69.3],
    ],
    [
      [56.6, 84.1],
      [36.4, 63.9],
    ],
  ],
  se: [
    [
      [96.5, 126.2],
      [59.3, 89.0],
    ],
    [
      [85.6, 113.4],
      [53.4, 81.2],
    ],
  ],
};
// [strip][zip][cds] → ms, hello world
const START = [
  [
    [44.9, 28.9],
    [59.3, 29.1],
  ],
  [
    [44.5, 28.5],
    [55.3, 29.8],
  ],
];
const FULL = { mb: 293.1, ms: 29.7 };
const MAXMS = 65;

export function RuntimeShrink() {
  const [mods, setMods] = useState<Mods>("base");
  const [strip, setStrip] = useState(true);
  const [zip, setZip] = useState(false);
  const [cds, setCds] = useState(false);

  const s = +strip,
    z = +zip,
    c = +cds;
  const mb = SIZE[mods][s][z][c];
  const ms = START[s][z][c];
  const arg = MODS.find((m) => m.v === mods)!.arg;
  const cmd = [
    `jlink --add-modules ${arg}`,
    strip && "--strip-debug --no-header-files --no-man-pages",
    zip && "--compress zip-6",
    cds && "--generate-cds-archive",
    "--output rt",
  ]
    .filter(Boolean)
    .join(" \\\n      ");

  const slower = ms > FULL.ms + 5;

  return (
    <div className="@container">
      <Row k="modules =" w="10ch">
        <Words label="modules to include" options={MODS.map((m) => ({ v: m.v, label: m.label }))} value={mods} onChange={setMods} />
      </Row>
      <Row k="flags =" w="10ch" last>
        <div className="flex flex-wrap gap-1">
          <Toggle on={strip} onChange={setStrip}>
            strip
          </Toggle>
          <Toggle on={zip} onChange={setZip}>
            compress
          </Toggle>
          <Toggle on={cds} onChange={setCds}>
            cds archive
          </Toggle>
        </div>
      </Row>

      <pre className="mt-3 overflow-x-auto rounded-md bg-bg px-4 py-2.5 text-12 leading-[1.7] whitespace-pre text-hi shadow-[inset_0_0_0_1px_var(--line-2)]">
        <span className="text-faint">$ </span>
        {cmd}
      </pre>

      <div className="mt-6 grid gap-5" aria-live="polite">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-12">
            <span className="text-faint">size on disk</span>
            <span className="tabular">
              <span className="text-20 font-light text-hi">{fmt(mb, 1)}</span> <span className="text-mute">MB</span>
              <span className="ml-2 text-faint">{Math.round((mb / FULL.mb) * 100)}% of the JDK</span>
            </span>
          </div>
          <Bar frac={mb / FULL.mb} tone="ink" />
          <div className="mt-1.5 text-right text-11 text-faint tabular">the whole track is the full JDK: {fmt(FULL.mb, 1)} MB</div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-12">
            <span className="text-faint">hello world, start to exit</span>
            <span className="tabular">
              <span className="text-20 font-light" style={{ color: slower ? "var(--hot)" : "var(--hi)" }}>
                {fmt(ms, 1)}
              </span>{" "}
              <span className="text-mute">ms</span>
              <span className="ml-2 text-faint">full JDK: {fmt(FULL.ms, 1)} ms</span>
            </span>
          </div>
          <Bar frac={ms / MAXMS} tone={slower ? "hot" : "ink"} />
        </div>
      </div>

      <p className="mt-5 min-h-[3.4em] border-t border-line-2 pt-3 font-serif text-17 leading-[1.6] text-mute">
        {!cds && zip
          ? "compressed AND no CDS archive: every class gets inflated from lib/modules at startup. the smallest runtime is also the slowest to start."
          : !cds
            ? "no CDS archive: the full JDK ships pre-parsed classes (lib/server/*.jsa), a jlinked runtime doesn't unless you ask. that's the extra ~15 ms."
            : zip
              ? "with CDS, startup classes come from the archive, so compressing lib/modules barely costs anything at startup."
              : "the CDS archive is two files of ~14 MB each (with and without compressed oops). you trade disk for startup."}
      </p>
    </div>
  );
}

function Bar({ frac, tone }: { frac: number; tone: "ink" | "hot" }) {
  return (
    <span className="relative block h-[14px] bg-well-2">
      <span
        className="absolute inset-y-0 left-0 transition-[width,background-color] duration-300 ease-jle"
        style={{ width: `${Math.max(0.5, Math.min(1, frac) * 100)}%`, background: `var(--${tone})` }}
      />
    </span>
  );
}
