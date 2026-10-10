"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// parent delegation: the request walks up (ask your parent first), then back down
// (parent said no, look yourself). module counts come from a real jdk 25 run:
// ModuleLayer.boot().modules() grouped by getClassLoader(), launched from the classpath.

type L = "bootstrap" | "platform" | "app";
type Pick = { id: string; name: string; found: L | null; where: string };

const PICKS: Pick[] = [
  { id: "string", name: "java.lang.String", found: "bootstrap", where: "module java.base" },
  { id: "sql", name: "java.sql.Connection", found: "platform", where: "module java.sql" },
  { id: "util", name: "com.acme.Util", found: "app", where: "app.jar on the classpath" },
  { id: "missing", name: "com.acme.Missing", found: null, where: "" },
];

const LOADERS: { id: L; title: string; what: string }[] = [
  { id: "bootstrap", title: "bootstrap", what: "C++ inside the JVM. 21 modules: java.base, java.logging, java.xml... no java object, so getClassLoader() is null." },
  { id: "platform", title: "platform", what: "21 modules: java.sql, java.net.http, java.compiler, jdk.httpserver..." },
  { id: "app", title: "app (system)", what: "the classpath (and module path), plus 19 jdk tool modules." },
];

type Step = { at: L | "done"; dir: "up" | "down" | "found" | "fail" | "done"; note: string };

function plan(p: Pick): Step[] {
  const s: Step[] = [
    { at: "app", dir: "up", note: `your code asks the app loader for ${p.name}. it's not in the app loader's cache, so before looking anywhere it asks its parent.` },
    { at: "platform", dir: "up", note: "the platform loader hasn't loaded it either. it asks its parent too." },
  ];
  if (p.found === "bootstrap") {
    s.push({ at: "bootstrap", dir: "found", note: `the bootstrap loader owns ${p.where}. it defines ${p.name} and hands it back down.` });
    s.push({ at: "done", dir: "done", note: `the app loader returns the bootstrap's class. ${p.name}.class.getClassLoader() is null: that's how java spells "bootstrap".` });
    return s;
  }
  s.push({ at: "bootstrap", dir: "down", note: `the bootstrap loader has no ${p.name}. back down to the platform loader.` });
  if (p.found === "platform") {
    s.push({ at: "platform", dir: "found", note: `the platform loader finds it in ${p.where} and defines it.` });
    s.push({ at: "done", dir: "done", note: `the class's defining loader is platform, even though you asked the app loader. "who you asked" and "who defined it" can differ.` });
    return s;
  }
  s.push({ at: "platform", dir: "down", note: "the platform loader doesn't have it either. back down to the app loader." });
  if (p.found === "app") {
    s.push({ at: "app", dir: "found", note: `only now does the app loader look itself: com/acme/Util.class in ${p.where}. it defines the class.` });
    s.push({ at: "done", dir: "done", note: "defined by app. because parents go first, a jar on your classpath can never replace a JDK class." });
    return s;
  }
  s.push({ at: "app", dir: "fail", note: "the app loader searches the classpath too. nothing. the request fails." });
  s.push({ at: "done", dir: "done", note: "ClassNotFoundException: com.acme.Missing (or NoClassDefFoundError, if the class was needed by already-compiled code)." });
  return s;
}

export function Delegation() {
  const [pick, setPick] = useState(PICKS[2]);
  const steps = plan(pick);
  return <Inner key={pick.id} pick={pick} setPick={setPick} steps={steps} />;
}

function Inner({ pick, setPick, steps }: { pick: Pick; setPick: (p: Pick) => void; steps: Step[] }) {
  const s = useStepper(steps.length, { interval: 1800 });
  const st = steps[s.i];
  const finished = st.at === "done";

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-5 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-12 text-faint">loadClass(</span>
        {PICKS.map((p) => (
          <button key={p.id} className="word" aria-pressed={pick.id === p.id} onClick={() => setPick(p)}>
            {p.name}
          </button>
        ))}
        <span className="ml-1 text-12 text-faint">)</span>
      </div>

      <div className="flex flex-col gap-0">
        {LOADERS.map((l, i) => {
          const here = st.at === l.id;
          const defined = finished && pick.found === l.id;
          const tone = here ? (st.dir === "found" ? "var(--live)" : st.dir === "fail" ? "var(--dead)" : "var(--hot)") : defined ? "var(--live)" : "var(--line-2)";
          return (
            <div key={l.id}>
              {i > 0 && (
                <div className="flex h-7 items-center pl-6" aria-hidden>
                  <span className="h-full w-px bg-line-2" />
                  <span className="ml-3 text-11 text-faint">parent ↑</span>
                </div>
              )}
              <div
                className="grid gap-3 rounded-md bg-well px-4 py-3 transition-[box-shadow] duration-200 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                style={{ boxShadow: `inset 0 0 0 1px ${tone}` }}
              >
                <div className="min-w-0">
                  <div className="text-13 text-meta">{l.title} class loader</div>
                  <div className="mt-1 text-12 leading-[1.5] text-mute">{l.what}</div>
                </div>
                <div className="flex min-h-[28px] items-center sm:justify-end">
                  {here && (
                    <span
                      className="rounded-md px-2 py-1 text-12 whitespace-nowrap"
                      style={{ color: tone, boxShadow: `inset 0 0 0 1px ${tone}` }}
                    >
                      {st.dir === "up" ? "↑ ask parent" : st.dir === "down" ? "↓ not here" : st.dir === "found" ? "✓ defines it" : "✗ not found"}
                    </span>
                  )}
                  {!here && defined && <span className="text-12 text-live">defining loader</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex h-7 items-center pl-6" aria-hidden>
          <span className="h-full w-px bg-line-2" />
        </div>
        <div className="rounded-md bg-well px-4 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="text-faint">your code: </span>
          <span className="text-hi">Class.forName(&quot;{pick.name}&quot;)</span>
          {finished && (
            <span className={pick.found ? "text-live" : "text-dead"}>
              {pick.found ? `  → a Class, defined by ${pick.found}` : "  → ClassNotFoundException"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
