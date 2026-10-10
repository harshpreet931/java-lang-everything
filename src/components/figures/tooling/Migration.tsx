"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Words } from "./kit";

// the two migration strategies from the JDK 9 module system docs (JEP 261 / "the state of the
// module system"), on a small made-up app. acme-json is a third-party jar with no module-info;
// logkit is third-party and already ships one.

type Kind = "cp" | "auto" | "named";
type Node = { id: string; label: string; r: number; c: number; mine: boolean };

const NODES: Node[] = [
  { id: "app", label: "app.jar", r: 0, c: 1, mine: true },
  { id: "billing", label: "billing.jar", r: 1, c: 0, mine: true },
  { id: "util", label: "util.jar", r: 2, c: 1, mine: true },
  { id: "json", label: "acme-json-2.1.jar", r: 2, c: 0, mine: false },
  { id: "log", label: "logkit-3.0.jar", r: 1, c: 2, mine: false },
];
const EDGES: [string, string][] = [
  ["app", "billing"],
  ["app", "log"],
  ["billing", "util"],
  ["billing", "json"],
  ["app", "util"],
];

type Frame = { kinds: Record<string, Kind>; hot: string[]; note: string; cmd: string };

const ALLCP: Record<string, Kind> = { app: "cp", billing: "cp", util: "cp", json: "cp", log: "cp" };

const PLANS: Record<"bottom" | "top", Frame[]> = {
  bottom: [
    { kinds: ALLCP, hot: [], note: "the starting point. five jars on the class path, all one big unnamed module. it works, it has always worked.", cmd: "java -cp app.jar:billing.jar:util.jar:acme-json-2.1.jar:logkit-3.0.jar com.app.Main" },
    {
      kinds: { ...ALLCP, util: "named" },
      hot: ["util"],
      note: "start at the bottom: util depends on nothing but the JDK. give it a module-info and move it to the module path. the class path still reads it.",
      cmd: "java -p util.jar --add-modules com.acme.util -cp app.jar:billing.jar:... com.app.Main",
    },
    {
      kinds: { ...ALLCP, util: "named", billing: "named", json: "auto" },
      hot: ["billing", "json"],
      note: "billing next. it needs acme-json, and a named module can't see the class path, so acme-json moves to the module path too, as an automatic module.",
      cmd: "java -p util.jar:billing.jar:acme-json-2.1.jar --add-modules com.acme.billing -cp app.jar:logkit-3.0.jar com.app.Main",
    },
    {
      kinds: { app: "named", billing: "named", util: "named", json: "auto", log: "named" },
      hot: ["app", "log"],
      note: "finally app. logkit already ships a module-info, so it's named the moment it lands on the module path. the class path is empty. done.",
      cmd: "java -p mods -m com.acme.app/com.app.Main",
    },
  ],
  top: [
    { kinds: ALLCP, hot: [], note: "same starting point: everything on the class path, one unnamed module.", cmd: "java -cp app.jar:billing.jar:util.jar:acme-json-2.1.jar:logkit-3.0.jar com.app.Main" },
    {
      kinds: { app: "auto", billing: "auto", util: "auto", json: "auto", log: "named" },
      hot: ["app", "billing", "util", "json"],
      note: "first put Automatic-Module-Name: com.acme.billing (and .util, .app) in your own jars' manifests, then move every jar to the module path. plain jars become automatic modules. logkit is already named.",
      cmd: "java -p mods -m com.acme.app/com.app.Main",
    },
    {
      kinds: { app: "named", billing: "auto", util: "auto", json: "auto", log: "named" },
      hot: ["app"],
      note: "now app gets a real module-info: requires com.acme.billing, com.acme.util, logkit and acme.json. that last one is derived from a file name, so you're betting it never changes.",
      cmd: "java -p mods -m com.acme.app/com.app.Main",
    },
    {
      kinds: { app: "named", billing: "named", util: "named", json: "auto", log: "named" },
      hot: ["billing", "util"],
      note: "convert billing and util whenever, keeping the names they already advertised. acme-json stays automatic until its maintainers ship a module-info, and then your requires line may need a new name.",
      cmd: "java -p mods -m com.acme.app/com.app.Main",
    },
  ],
};

const STYLE: Record<Kind, { tag: string; border: string; text: string; dash?: boolean }> = {
  cp: { tag: "class path", border: "var(--line-2)", text: "var(--mute)", dash: true },
  auto: { tag: "automatic", border: "var(--mute)", text: "var(--ink)", dash: true },
  named: { tag: "named", border: "var(--hi)", text: "var(--hi)" },
};

const cx = (c: number) => (c + 0.5) * (100 / 3);
const cy = (r: number) => (r + 0.5) * (100 / 3);

export function Migration() {
  const [plan, setPlan] = useState<"bottom" | "top">("bottom");
  const frames = PLANS[plan];
  const s = useStepper(frames.length, { interval: 2200 });
  const f = frames[Math.min(s.i, frames.length - 1)];

  return (
    <div {...s.keys} className="@container outline-none" aria-label="module migration, step by step">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">plan =</span>
        <Words
          label="migration strategy"
          options={[
            { v: "bottom" as const, label: "bottom-up" },
            { v: "top" as const, label: "top-down" },
          ]}
          value={plan}
          onChange={(v) => (setPlan(v), s.reset())}
        />
      </div>

      <div className="relative h-[210px] @[560px]:h-[230px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {EDGES.map(([a, b]) => {
            const A = NODES.find((n) => n.id === a)!;
            const B = NODES.find((n) => n.id === b)!;
            return (
              <line
                key={a + b}
                x1={cx(A.c)}
                y1={cy(A.r)}
                x2={cx(B.c)}
                y2={cy(B.r)}
                stroke="var(--ref)"
                strokeOpacity={0.55}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {NODES.map((n) => {
          const k = f.kinds[n.id];
          const st = STYLE[k];
          const hot = f.hot.includes(n.id);
          return (
            <div
              key={n.id}
              className="absolute w-[31%] -translate-x-1/2 -translate-y-1/2 rounded-md bg-bg px-2 py-1.5 text-center transition-[border-color,color] duration-200 ease-jle"
              style={{
                left: `${cx(n.c)}%`,
                top: `${cy(n.r)}%`,
                border: `1px ${st.dash ? "dashed" : "solid"} ${hot ? "var(--hot)" : st.border}`,
              }}
            >
              <div className="truncate text-12" style={{ color: hot ? "var(--hot)" : st.text }}>
                {n.label}
              </div>
              <div className="text-[10px] leading-[14px] text-faint">
                {st.tag}
                {!n.mine && " · 3rd party"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 border border-dashed border-line-2 align-middle" /> class path (unnamed)
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 border border-dashed border-mute align-middle" /> automatic
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 border border-hi align-middle" /> named
        </span>
        <span>
          <span className="mr-1.5 inline-block h-px w-4 bg-ref align-middle" /> depends on
        </span>
      </div>

      <p className="mt-4 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {f.note}
      </p>
      <pre className="mt-2 overflow-x-auto rounded-md bg-bg px-3 py-2 text-12 whitespace-pre text-mute shadow-[inset_0_0_0_1px_var(--line-2)]">
        <span className="text-faint">$ </span>
        {f.cmd}
      </pre>
      <StepControls s={s} className="mt-3" />
    </div>
  );
}
