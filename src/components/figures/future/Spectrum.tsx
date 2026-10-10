"use client";

import { useState } from "react";

// leyden's idea as a spectrum: how much work moves from every run to an earlier phase, and
// what you give up for it. releases and statuses from the JEPs (310, 341, 483, 514, 515,
// 516, 544) and the leyden project page, as of october 2026. condensers are a design note
// ("Toward Condensers", 2023), not a JEP.

type Stop = { id: string; label: string; when: string; shifted: string; cost: string; status: string; tone: "live" | "hot" | null };

const STOPS: Stop[] = [
  {
    id: "none",
    label: "nothing saved",
    when: "java 8",
    shifted: "nothing. every run finds, parses, verifies, links and initializes its classes, then profiles and JIT-compiles its hot code, from scratch.",
    cost: "nothing. fully dynamic java.",
    status: "the old baseline",
    tone: null,
  },
  {
    id: "cds",
    label: "CDS",
    when: "on by default since 12",
    shifted: "parsing: the JDK's own classes come pre-parsed from an archive that's mapped straight into memory. AppCDS (10) and dynamic archives (13) do the same for yours.",
    cost: "nothing for the default archive. your own needs a dump step.",
    status: "final",
    tone: "live",
  },
  {
    id: "aot",
    label: "AOT cache",
    when: "24, 25, 26",
    shifted: "loading and linking (24), one-command training (25), method profiles (25), and pre-built heap objects that work with any GC (26). production starts as if the training run had just happened.",
    cost: "a training run, and a cache tied to one JDK build, OS, CPU architecture and classpath.",
    status: "final",
    tone: "live",
  },
  {
    id: "code",
    label: "AOT code",
    when: "28, targeted",
    shifted: "compilation: C1 and C2 code for hot methods, compiled during training and stored in the cache, so they start out compiled. JEP 544 reports 65 to 80% faster startup on five framework benchmarks, against 50 to 70% for the cache alone.",
    cost: "the code only loads on the same CPU features and the same GC as the training run; otherwise it's skipped (the classes and profiles still work). and a bigger cache.",
    status: "targeted to jdk 28 (march 2027)",
    tone: "hot",
  },
  {
    id: "condense",
    label: "conden\u00adsers",
    when: "design",
    shifted: "anything you're willing to promise about: a condenser transforms the app ahead of time and may shift more work earlier in exchange for constraints you opt into (for example, no new classes at run time). they compose, and each one's output is still a normal java app.",
    cost: "only the constraints you pick. that's the whole idea: you choose your spot on the line.",
    status: "a design note from 2023, no JEP",
    tone: null,
  },
  {
    id: "native",
    label: "native image",
    when: "GraalVM",
    shifted: "everything: the app and the parts of the JDK it uses are compiled into one native executable at build time. no class loading, no warmup.",
    cost: "a closed world: reflection, proxies and resources need configuration, builds take minutes, and it's a separate toolchain (not part of OpenJDK).",
    status: "available outside OpenJDK",
    tone: null,
  },
];

export function Spectrum() {
  const [id, setId] = useState("code");
  const i = STOPS.findIndex((s) => s.id === id);
  const s = STOPS[i];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="relative px-2 pt-2">
        <div className="absolute top-[22px] right-4 left-4 h-px bg-line-2" aria-hidden />
        <div className="relative grid grid-cols-6 gap-1.5" role="group" aria-label="how much is done ahead of time">
          {STOPS.map((x, k) => (
            <button key={x.id} type="button" aria-pressed={x.id === id} onClick={() => setId(x.id)} className="group flex flex-col items-center gap-1.5 text-center">
              <span
                className="size-[14px] rounded-full transition-[background,box-shadow] duration-200"
                style={{
                  background: x.id === id ? "var(--hot)" : k <= i ? "color-mix(in srgb, var(--ink) 55%, var(--bg))" : "var(--bg)",
                  boxShadow: `inset 0 0 0 1.5px ${x.id === id ? "var(--hot)" : "var(--line-2)"}`,
                }}
              />
              <span className={`px-0.5 text-[10px] leading-tight [hyphens:manual] sm:text-11 ${x.id === id ? "text-hi" : "text-mute"}`}>{x.label}</span>
              <span className="hidden text-[10px] text-faint sm:block">{x.when}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-faint">
          <span>← every run does the work</span>
          <span>done before the run →</span>
        </div>
      </div>
      <div className="rounded-md bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-13 text-hi">
            {s.label} <span className="text-11 text-faint">· {s.when}</span>
          </span>
          <span className="text-11" style={{ color: s.tone ? `var(--${s.tone})` : "var(--mute)" }}>
            {s.status}
          </span>
        </div>
        <div className="grid gap-2 font-serif text-[16px] leading-[1.6] text-ink">
          <p>
            <span className="mr-2 font-mono text-11 text-faint">moved earlier</span>
            {s.shifted}
          </p>
          <p>
            <span className="mr-2 font-mono text-11 text-faint">you give up</span>
            {s.cost}
          </p>
        </div>
      </div>
    </div>
  );
}
