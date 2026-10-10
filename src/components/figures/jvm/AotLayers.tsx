"use client";

import { useState } from "react";

// what a startup archive can hold, by jdk release. JEP numbers and releases checked
// on openjdk.org/jeps: 310 (10), 341 (12), 350 (13), 483 (24), 514 (25), 515 (25),
// 516 (26), 544 (targeted to 28).

type Layer = { since: number; jep: string; label: string; what: string; tone?: "hot" };

const LAYERS: Layer[] = [
  { since: 10, jep: "JEP 310 · 341 · 350", label: "parsed classes", what: "CDS: class metadata already parsed and laid out, mapped straight into memory. the JDK ships an archive for its own classes (default since 12), AppCDS covers yours (10), dynamic archives build it at exit (13)." },
  { since: 24, jep: "JEP 483", label: "loaded + linked classes", what: "the AOT cache: classes are not just parsed but already loaded and linked, with constant pool entries resolved, as if the training run had just happened. lambdas and other hidden classes included." },
  { since: 25, jep: "JEP 514", label: "one-step training", what: "-XX:AOTCacheOutput=app.aot does the training run and builds the cache in one command. java 24 needed two (record, then create)." },
  { since: 25, jep: "JEP 515", label: "method profiles", what: "the training run's profiles (call counts, branch and type profiles) are saved too, so C2 can compile hot methods with real data right after startup instead of waiting for tier 3 to collect it again." },
  { since: 26, jep: "JEP 516", label: "cached objects, any GC", what: "pre-built heap objects (interned strings, the module graph and more) become loadable by every collector, ZGC included. on 25 they're tied to how the heap was laid out at build time: in the test in this chapter, ZGC couldn't use a cache built under the default G1 at all." },
  { since: 28, jep: "JEP 544", label: "compiled code", what: "targeted to java 28: machine code compiled during training is stored in the cache, so hot methods start out compiled. falls back to the normal JIT if the CPU or GC doesn't match." },
];

const VERSIONS = [21, 24, 25, 26, 27, 28];

export function AotLayers() {
  const [v, setV] = useState(25);
  const [sel, setSel] = useState(1);
  const info = LAYERS[sel];
  return (
    <div className="@container">
      <div className="grid grid-cols-[8ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3 text-13">
        <span className="text-faint">java =</span>
        <div className="flex flex-wrap gap-1">
          {VERSIONS.map((x) => (
            <button key={x} className="word" aria-pressed={v === x} onClick={() => setV(x)}>
              {x}
              {x === 25 ? " (lts)" : x === 28 ? " (dev)" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-5 @[620px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col-reverse gap-1.5">
          {LAYERS.map((l, i) => {
            const on = v >= l.since;
            const isSel = sel === i;
            return (
              <button
                key={l.label}
                onClick={() => setSel(i)}
                aria-pressed={isSel}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-3 py-2 text-left transition-[opacity,box-shadow,background-color] duration-200"
                style={{
                  opacity: on ? 1 : 0.35,
                  background: isSel ? "var(--well-2)" : on ? "color-mix(in srgb, var(--live) 9%, transparent)" : "transparent",
                  boxShadow: `inset 0 0 0 1px ${isSel ? "var(--mute)" : on ? "var(--live)" : "var(--line-2)"}`,
                  borderStyle: on ? "solid" : "dashed",
                }}
              >
                <span className={`text-13 ${on ? "text-hi" : "text-mute"}`}>{l.label}</span>
                <span className="text-11 text-faint tabular">
                  {l.jep} · {l.since === 28 ? "28, targeted" : l.since}
                </span>
              </button>
            );
          })}
          <div className="mt-1 text-11 text-faint">what java {v} can archive (bottom layer first)</div>
        </div>
        <div className="min-w-0" aria-live="polite">
          <div className="text-11 text-faint">{info.jep}</div>
          <div className="mt-1 text-15 text-hi">{info.label}</div>
          <p className="mt-2 font-serif text-17 leading-[1.6] text-ink">{info.what}</p>
          <p className="mt-3 text-12 text-mute">
            {v >= info.since ? (
              <span className="text-live">available in java {v}.</span>
            ) : (
              <span>not in java {v}. arrives in {info.since}{info.since === 28 ? " (targeted)" : ""}.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
