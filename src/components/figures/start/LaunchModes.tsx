"use client";

import { useState } from "react";
import { Row, Words } from "@/components/figures/basics/kit";

// three ways to run the same hello world. timings: median of 15 runs, temurin 25.0.4.1,
// apple silicon mac, warm disk cache. javac ≈ 224 ms, java Main ≈ 25 ms, java Main.java ≈ 200 ms.

type Mode = "classic" | "single" | "multi";

const MODES: Record<
  Mode,
  {
    since: string;
    jep?: string;
    before: string[];
    cmds: { cmd: string; ms?: number; note?: string }[];
    after: { f: string; isNew?: boolean }[];
    out: string;
    note: string;
  }
> = {
  classic: {
    since: "every version",
    before: ["Main.java"],
    cmds: [
      { cmd: "javac Main.java", ms: 224, note: "writes Main.class" },
      { cmd: "java Main", ms: 25, note: "a class name, not a file" },
    ],
    after: [{ f: "Main.java" }, { f: "Main.class", isNew: true }],
    out: "hello, world",
    note: "compile once, run as often as you like. this is what build tools (maven, gradle) do for you, for hundreds of files at a time.",
  },
  single: {
    since: "java 11",
    jep: "JEP 330",
    before: ["Main.java"],
    cmds: [{ cmd: "java Main.java", ms: 200, note: "compile in memory, then run" }],
    after: [{ f: "Main.java" }],
    out: "hello, world",
    note: "the launcher compiles the file in memory and runs it. no .class ever touches the disk, so every run pays the compile again. perfect for scripts and for this site.",
  },
  multi: {
    since: "java 22",
    jep: "JEP 458",
    before: ["Main.java", "Greeter.java"],
    cmds: [{ cmd: "java Main.java", note: "finds Greeter.java on its own" }],
    after: [{ f: "Main.java" }, { f: "Greeter.java" }],
    out: "hello, world",
    note: "Main uses a class called Greeter, so the launcher looks for Greeter.java next to Main.java and compiles it too, on demand. still nothing written to disk.",
  },
};

export function LaunchModes() {
  const [mode, setMode] = useState<Mode>("classic");
  const m = MODES[mode];

  return (
    <div className="font-mono text-13">
      <Row k="run it =" w="10ch">
        <Words
          options={[
            { v: "classic", label: "javac + java" },
            { v: "single", label: "java Main.java" },
            { v: "multi", label: "two files" },
          ]}
          value={mode}
          onChange={setMode}
          label="how to run it"
        />
      </Row>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line)]">
            {m.cmds.map((c) => (
              <div key={c.cmd} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span>
                  <span className="text-faint select-none">$ </span>
                  <span className="text-hi">{c.cmd}</span>
                  {c.note && <span className="text-faint">{"   # " + c.note}</span>}
                </span>
                {c.ms !== undefined && <span className="text-11 text-faint tabular">~{c.ms} ms</span>}
              </div>
            ))}
            <div className="text-ink">{m.out}</div>
          </pre>
          <p className="mt-3 font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-mute" aria-live="polite">
            {m.note}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between border-b border-line pb-1.5 text-11 text-faint">
            <span>the folder, afterwards</span>
            <span>
              {m.since}
              {m.jep && ` · ${m.jep}`}
            </span>
          </div>
          <ul className="grid gap-1.5">
            {m.after.map((x) => (
              <li
                key={x.f}
                className="flex items-baseline justify-between rounded-md px-3 py-1.5 text-12"
                style={{ boxShadow: `inset 0 0 0 1px ${x.isNew ? "var(--hot)" : "var(--line)"}` }}
              >
                <span className={x.isNew ? "text-hot" : "text-ink"}>{x.f}</span>
                <span className="text-11 text-faint">{x.isNew ? "new, 414 bytes" : "source"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
