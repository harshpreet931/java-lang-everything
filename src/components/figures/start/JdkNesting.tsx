"use client";

import { useState, type ReactNode } from "react";

// JDK ⊃ runtime ⊃ JVM, as three nested boxes you can click.
// numbers measured on temurin 25.0.4.1, macOS aarch64:
//   whole JDK 294 MB, 30 programs in bin/, 69 modules (22 java.*, 47 jdk.*),
//   lib/modules (the class library) 138 MB, libjvm.dylib (the JVM itself) 19 MB.
//   jlink --add-modules java.base → a 45 MB runtime that can still run hello world.

type Layer = "jdk" | "runtime" | "jvm";

const INFO: Record<Layer, { title: string; who: string; body: ReactNode; size: string }> = {
  jdk: {
    title: "JDK · java development kit",
    who: "you, writing code",
    body: (
      <>
        the whole download. everything in the runtime, plus the tools for making programs: <code>javac</code> to compile,{" "}
        <code>jshell</code> to play, <code>jar</code> to package, <code>jdb</code> to debug, <code>javap</code> to peek at bytecode,{" "}
        <code>jlink</code> to build a trimmed runtime. 30 programs in <code>bin/</code>.
      </>
    ),
    size: "294 MB on disk",
  },
  runtime: {
    title: "runtime · what used to be called the JRE",
    who: "a server, running your code",
    body: (
      <>
        the JVM plus the standard library: <code>String</code>, <code>ArrayList</code>, <code>HashMap</code>, files, sockets, http,
        threads. shipped as 69 modules, from <code>java.base</code> (always there) to <code>java.desktop</code>. no compiler.
      </>
    ),
    size: "138 MB of class library",
  },
  jvm: {
    title: "JVM · java virtual machine",
    who: "the thing doing the work",
    body: (
      <>
        one native program (<code>libjvm</code>) that loads <code>.class</code> files, checks them, runs the bytecode in an
        interpreter, compiles the hot parts to machine code with the JIT, and cleans up dead objects with the GC.
      </>
    ),
    size: "19 MB of native code",
  },
};

export function JdkNesting() {
  const [sel, setSel] = useState<Layer>("jvm");
  const box = (l: Layer) =>
    `relative rounded-md transition-[box-shadow,background-color] duration-200 ease-jle text-left w-full ${
      sel === l ? "shadow-[inset_0_0_0_1px_var(--hi)]" : "shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--mute)]"
    }`;
  const label = (l: Layer, text: string) => (
    <span className={`text-12 ${sel === l ? "text-hi" : "text-mute"}`}>{text}</span>
  );
  const chips = (xs: string[], tone?: string) => (
    <span className="mt-2 flex flex-wrap gap-1">
      {xs.map((x) => (
        <span
          key={x}
          className="rounded-sm px-1.5 text-11 leading-[20px]"
          style={{
            color: tone ? `var(--${tone})` : "var(--ink)",
            boxShadow: `inset 0 0 0 1px ${tone ? `color-mix(in srgb, var(--${tone}) 45%, transparent)` : "var(--line)"}`,
          }}
        >
          {x}
        </span>
      ))}
    </span>
  );

  const info = INFO[sel];

  return (
    <div className="font-mono grid gap-6">
      {/* the words are the accessible control. the boxes are also clickable, as a shortcut */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">layer =</span>
        <div className="flex gap-1">
          {(["jdk", "runtime", "jvm"] as Layer[]).map((l) => (
            <button key={l} className="word" aria-pressed={sel === l} onClick={() => setSel(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div onClick={() => setSel("jdk")} className={`${box("jdk")} -mt-2 cursor-pointer bg-well p-3 sm:p-4`}>
        {label("jdk", "JDK")}
        {chips(["javac", "jshell", "jar", "javadoc", "jdb", "javap", "jlink", "jpackage", "jcmd", "jfr", "+20 more"])}
        <div
          onClick={(e) => (e.stopPropagation(), setSel("runtime"))}
          className={`${box("runtime")} mt-4 cursor-pointer bg-bg p-3 sm:p-4`}
        >
          {label("runtime", "runtime (the old \"JRE\")")}
          {chips(["java.base", "java.net.http", "java.sql", "java.xml", "java.logging", "java.desktop", "+63 more modules"])}
          <div
            onClick={(e) => (e.stopPropagation(), setSel("jvm"))}
            className={`mt-4 w-full cursor-pointer rounded-md bg-well p-3 text-left transition-[box-shadow] duration-200 ease-jle sm:p-4 ${
              sel === "jvm" ? "shadow-[inset_0_0_0_1px_var(--meta)]" : "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--meta)_45%,transparent)]"
            }`}
          >
            <span className="text-12" style={{ color: "var(--meta)" }}>
              JVM
            </span>
            {chips(["class loader", "verifier", "interpreter", "JIT (C1, C2)", "garbage collector", "threads"], "meta")}
          </div>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 border-t border-line pt-4 text-13 sm:grid-cols-[minmax(0,1fr)_auto]" aria-live="polite">
        <div className="min-w-0">
          <div className="text-hi">{info.title}</div>
          <p className="mt-1.5 font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink">{info.body}</p>
        </div>
        <div className="flex flex-col gap-1 text-12 sm:text-right">
          <span>
            <span className="text-faint">for </span>
            <span className="text-mute">{info.who}</span>
          </span>
          <span className="text-faint tabular">{info.size}</span>
        </div>
      </div>
    </div>
  );
}
