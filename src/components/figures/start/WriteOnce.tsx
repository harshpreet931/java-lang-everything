"use client";

import { useState } from "react";

// one .class file, three JVMs, three kinds of machine code.
// Main.class is the real hello world from javac 25: 414 bytes, starts ca fe ba be 00 00 00 45
// (0x45 = 69 = the class file version for java 25).

const OS = [
  { id: "linux", jvm: "linux x64", cpu: "x86-64 machine code", note: "a linux JDK has a libjvm.so built for x86-64." },
  { id: "mac", jvm: "macOS arm64", cpu: "arm64 machine code", note: "a mac JDK has a libjvm.dylib built for apple silicon." },
  { id: "windows", jvm: "windows x64", cpu: "x86-64 machine code", note: "a windows JDK has a jvm.dll built for x86-64." },
] as const;

const SOURCES = [
  { file: "Main.java", tool: "javac", on: true },
  { file: "Main.kt", tool: "kotlinc" },
  { file: "Main.scala", tool: "scalac" },
  { file: "core.clj", tool: "clojure" },
];

export function WriteOnce() {
  const [sel, setSel] = useState(1);

  return (
    <div className="font-mono @container">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">run on =</span>
        <div className="flex gap-1">
          {OS.map((o, i) => (
            <button key={o.id} className="word" aria-pressed={sel === i} onClick={() => setSel(i)}>
              {o.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-center gap-y-3 @[600px]:grid-cols-[minmax(0,0.9fr)_44px_minmax(0,1fr)_56px_minmax(0,1.1fr)]">
        {/* sources */}
        <div className="flex flex-col gap-1.5">
          {SOURCES.map((s) => (
            <div
              key={s.file}
              className={`flex items-baseline justify-between gap-3 rounded-md px-3 py-1.5 text-12 ${
                s.on ? "bg-well shadow-[inset_0_0_0_1px_var(--line-2)]" : "opacity-55 shadow-[inset_0_0_0_1px_var(--line)]"
              }`}
            >
              <span className={s.on ? "text-hi" : "text-mute"}>{s.file}</span>
              <span className="text-11 text-faint">{s.tool}</span>
            </div>
          ))}
        </div>

        <Arrow />

        {/* the class file */}
        <div className="rounded-md bg-well px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--hi)]">
          <div className="flex items-baseline justify-between gap-3 text-13">
            <span className="text-hi">Main.class</span>
            <span className="text-11 text-faint tabular">414 bytes</span>
          </div>
          <div className="mt-2 text-12 leading-[1.6] tabular">
            <span className="text-hot">ca fe ba be</span> <span className="text-mute">00 00</span> <span className="text-hi">00 45</span>
            <span className="text-faint"> 00 1d 0a 00 02 00 03 07 …</span>
          </div>
          <div className="mt-2 text-11 leading-[1.5] text-faint">bytecode. not x86, not arm. the same bytes everywhere.</div>
        </div>

        {/* fan out */}
        <div className="relative hidden h-full min-h-[180px] @[600px]:block" aria-hidden>
          <svg fontFamily="var(--font-code), monospace" className="absolute inset-0 h-full w-full" viewBox="0 0 64 300" preserveAspectRatio="none">
            {[50, 150, 250].map((y, i) => (
              <path
                key={y}
                d={`M 0 150 C 32 150, 32 ${y}, 64 ${y}`}
                fill="none"
                stroke={i === sel ? "var(--hot)" : "var(--line-2)"}
                strokeWidth={i === sel ? 1.5 : 1}
                vectorEffect="non-scaling-stroke"
                className="transition-[stroke] duration-200"
              />
            ))}
          </svg>
        </div>
        <div className="text-center text-mute @[600px]:hidden" aria-hidden>
          ↓
        </div>

        {/* the JVMs */}
        <div className="flex flex-col gap-2.5">
          {OS.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setSel(i)}
              className="rounded-md bg-well px-3 py-2 text-left transition-[box-shadow,opacity] duration-200 ease-jle"
              style={{
                boxShadow: `inset 0 0 0 1px ${i === sel ? "var(--meta)" : "var(--line)"}`,
                opacity: i === sel ? 1 : 0.6,
              }}
              aria-pressed={i === sel}
            >
              <span className="block text-12">
                <span style={{ color: "var(--meta)" }}>JVM</span>
                <span className="text-ink"> · {o.jvm}</span>
              </span>
              <span className={`mt-0.5 block text-11 ${i === sel ? "text-hot" : "text-faint"}`}>→ {o.cpu}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-mute" aria-live="polite">
        {OS[sel].note} the <span className="text-hi">.class</span> didn&apos;t change. only the JVM did.
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-mute" aria-hidden>
      <span className="@[600px]:hidden">↓</span>
      <span className="hidden w-full items-center @[600px]:flex">
        <span className="h-px flex-1 bg-line-2" />
        <span className="-ml-1 text-[10px] leading-none">▶</span>
      </span>
    </div>
  );
}
