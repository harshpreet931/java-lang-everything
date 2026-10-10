"use client";

import { useState } from "react";
import { Arrowhead, Row, Term, Words } from "./kit";

// the task graph of a real gradle 9.8.1 project (plugins { application }), from
// `gradle build --task-graph`. the "after you change..." states are from real runs of
// `gradle build --console=plain` on jdk 25 after each edit.

type T =
  | "processResources"
  | "compileJava"
  | "classes"
  | "jar"
  | "compileTestJava"
  | "processTestResources"
  | "startScripts"
  | "testClasses"
  | "distTar"
  | "distZip"
  | "test"
  | "assemble"
  | "check"
  | "build";

const LIFECYCLE = new Set<T>(["classes", "testClasses", "assemble", "check", "build"]);
const ACTIONABLE: T[] = ["compileJava", "processResources", "jar", "startScripts", "distTar", "distZip", "compileTestJava", "test"];

// task → what it depends on
const DEPS: Record<T, T[]> = {
  processResources: [],
  compileJava: [],
  classes: ["compileJava", "processResources"],
  jar: ["classes", "compileJava"],
  compileTestJava: ["classes", "compileJava"],
  processTestResources: [],
  startScripts: ["jar"],
  testClasses: ["compileTestJava", "processTestResources"],
  distTar: ["jar", "startScripts"],
  distZip: ["jar", "startScripts"],
  test: ["classes", "compileJava", "compileTestJava", "testClasses"],
  assemble: ["distTar", "distZip", "jar"],
  check: ["test"],
  build: ["assemble", "check"],
};

// the order gradle printed them in
const ORDER: T[] = [
  "compileJava",
  "processResources",
  "classes",
  "jar",
  "startScripts",
  "distTar",
  "distZip",
  "assemble",
  "compileTestJava",
  "processTestResources",
  "testClasses",
  "test",
  "check",
  "build",
];

// [col, row] in the drawing
const POS: Record<T, [number, number]> = {
  processResources: [0, 0],
  compileJava: [0, 1.1],
  classes: [1, 0.55],
  jar: [2, 0],
  compileTestJava: [2, 1.5],
  processTestResources: [2, 2.5],
  startScripts: [3, 0],
  testClasses: [3, 2],
  distTar: [4, -0.1],
  distZip: [4, 0.9],
  test: [4, 2],
  assemble: [5, 0.4],
  check: [5, 2],
  build: [6, 1.2],
};

// what we draw: the transitive reduction (test -> compileJava is implied by
// test -> testClasses -> compileTestJava -> classes -> compileJava, and so on).
const DRAW: Record<T, T[]> = {
  processResources: [],
  compileJava: [],
  classes: ["compileJava", "processResources"],
  jar: ["classes"],
  compileTestJava: ["classes"],
  processTestResources: [],
  startScripts: ["jar"],
  testClasses: ["compileTestJava", "processTestResources"],
  distTar: ["startScripts"],
  distZip: ["startScripts"],
  test: ["testClasses"],
  assemble: ["distTar", "distZip"],
  check: ["test"],
  build: ["assemble", "check"],
};

type Change = "first" | "nothing" | "test" | "body" | "abi" | "resource";
// which actionable tasks did work after each change (real runs)
const DID: Record<Change, T[]> = {
  first: ACTIONABLE,
  nothing: [],
  test: ["compileTestJava", "test"],
  body: ["compileJava", "jar", "startScripts", "distTar", "distZip", "test"],
  abi: ["compileJava", "jar", "startScripts", "distTar", "distZip", "compileTestJava", "test"],
  resource: ["processResources", "jar", "startScripts", "distTar", "distZip", "test"],
};
const WHY: Record<Change, string> = {
  first: "a clean checkout: nothing has outputs yet, so everything runs.",
  nothing: "same inputs, same outputs. gradle fingerprints every task's inputs and skips them all.",
  test: "only the test side reran. the main jar, the start scripts and the zips didn't move.",
  body: "compileJava reran, but compileTestJava didn't: a method body changed, the class's public API (its ABI) didn't, so nothing compiled against it needs recompiling. tests still rerun.",
  abi: "a new public method changes the ABI, so code compiled against App (the tests) has to recompile too.",
  resource: "a .properties file changed: processResources and everything downstream of the jar reran. javac didn't.",
};

const closure = (t: T, acc = new Set<T>()) => {
  if (acc.has(t)) return acc;
  acc.add(t);
  DEPS[t].forEach((d) => closure(d, acc));
  return acc;
};

type State = "ran" | "up" | "nosrc" | "out";

function states(target: T, change: Change): Record<T, State> {
  const inG = closure(target);
  const s = {} as Record<T, State>;
  for (const t of ORDER) {
    if (!inG.has(t)) s[t] = "out";
    else if (t === "processTestResources") s[t] = "nosrc";
    else if (!LIFECYCLE.has(t)) s[t] = DID[change].includes(t) ? "ran" : "up";
  }
  // lifecycle tasks: up-to-date only if everything they depend on was
  for (const t of ORDER) {
    if (!inG.has(t) || !LIFECYCLE.has(t)) continue;
    s[t] = DEPS[t].some((d) => s[d] === "ran") ? "ran" : "up";
  }
  return s;
}


export function GradleTaskGraph() {
  const [target, setTarget] = useState<T>("build");
  const [change, setChange] = useState<Change>("body");
  const st = states(target, change);
  const inG = closure(target);
  const acts = ACTIONABLE.filter((t) => inG.has(t));
  const ran = acts.filter((t) => st[t] === "ran").length;
  const log = [
    `$ gradle ${target}`,
    ...ORDER.filter((t) => inG.has(t)).map(
      (t) => `> Task :${t}${st[t] === "up" ? " UP-TO-DATE" : st[t] === "nosrc" ? " NO-SOURCE" : ""}`,
    ),
    "BUILD SUCCESSFUL",
    `${acts.length} actionable task${acts.length === 1 ? "" : "s"}: ${
      ran === acts.length ? `${ran} executed` : ran === 0 ? `${acts.length} up-to-date` : `${ran} executed, ${acts.length - ran} up-to-date`
    }`,
  ].join("\n");

  return (
    <div className="@container">
      <Row k="gradle =" w="13ch">
        <Words
          label="which task to run"
          options={(["build", "test", "assemble", "jar", "compileTestJava"] as T[]).map((t) => ({ v: t, label: t }))}
          value={target}
          onChange={setTarget}
        />
      </Row>
      <Row k="after you =" w="13ch" last>
        <Words
          label="what changed since the last build"
          options={[
            { v: "first" as Change, label: "clone it" },
            { v: "nothing" as Change, label: "change nothing" },
            { v: "test" as Change, label: "edit a test" },
            { v: "body" as Change, label: "edit a method body" },
            { v: "abi" as Change, label: "add a public method" },
            { v: "resource" as Change, label: "edit a resource" },
          ]}
          value={change}
          onChange={setChange}
        />
      </Row>

      <div className="mt-4">
        <div className="hidden @[600px]:block">
          <Graph st={st} inG={inG} onPick={setTarget} vertical={false} />
        </div>
        <div className="@[600px]:hidden">
          <Graph st={st} inG={inG} onPick={setTarget} vertical />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-[3px] border border-hot align-middle" /> did work
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-[3px] border border-faint align-middle" /> skipped
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-[3px] border border-dashed border-faint align-middle" /> lifecycle task (no action of its own)
        </span>
        <span>→ runs before (implied edges hidden)</span>
      </div>

      <div className="mt-4 grid gap-4 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <p className="font-serif text-17 leading-[1.55] text-ink" aria-live="polite">
          {WHY[change]}
        </p>
        <Term label="--console=plain" text={log} marks={{ "UP-TO-DATE": "live", "BUILD SUCCESSFUL": "live" }} />
      </div>
    </div>
  );
}

function Graph({ st, inG, onPick, vertical }: { st: Record<T, State>; inG: Set<T>; onPick: (t: T) => void; vertical: boolean }) {
  const W = vertical ? 112 : 126;
  const H = 30;
  // horizontal: columns left to right. vertical: columns top to bottom, rows become lanes.
  const at = (t: T) => {
    const [c, r] = POS[t];
    return vertical ? { x: 6 + (r + 0.15) * 120, y: 8 + c * 58 } : { x: 6 + c * 136, y: 12 + (r + 0.1) * 50 };
  };
  const vw = vertical ? 438 : 950;
  const vh = vertical ? 390 : 176;
  const color = (t: T) => (st[t] === "ran" ? "var(--hot)" : st[t] === "out" ? "var(--line-2)" : "var(--faint)");
  const id = vertical ? "gtg-v" : "gtg-h";
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="block w-full" role="img" aria-label="the task graph. click a task to make it the target">
      <defs>
        <Arrowhead id={`${id}-ah`} color="var(--line-2)" />
        <Arrowhead id={`${id}-on`} color="var(--mute)" />
      </defs>
      {ORDER.flatMap((t) =>
        DRAW[t].map((d) => {
          const A = at(d);
          const B = at(t);
          const on = inG.has(t) && inG.has(d);
          const path = vertical
            ? `M ${A.x + W / 2} ${A.y + H} C ${A.x + W / 2} ${A.y + H + 14}, ${B.x + W / 2} ${B.y - 14}, ${B.x + W / 2} ${B.y - 2}`
            : `M ${A.x + W} ${A.y + H / 2} C ${A.x + W + 14} ${A.y + H / 2}, ${B.x - 14} ${B.y + H / 2}, ${B.x - 2} ${B.y + H / 2}`;
          return (
            <path
              key={d + t}
              d={path}
              fill="none"
              stroke={on ? "var(--mute)" : "var(--line-2)"}
              strokeWidth={1}
              markerEnd={`url(#${id}-${on ? "on" : "ah"})`}
            />
          );
        }),
      )}
      {ORDER.map((t) => {
        const { x, y } = at(t);
        const s = st[t];
        const life = LIFECYCLE.has(t);
        return (
          <g key={t} onClick={() => onPick(t)} style={{ cursor: "pointer" }}>
            <rect
              x={x}
              y={y}
              width={W}
              height={H}
              rx={5}
              fill={s === "ran" ? "color-mix(in srgb, var(--hot) 12%, var(--bg))" : "var(--bg)"}
              stroke={color(t)}
              strokeDasharray={life ? "3 3" : undefined}
            />
            <text x={x + W / 2} y={y + 13} fontSize={t.length > 16 ? (vertical ? 9 : 9.5) : 11} textAnchor="middle" fontFamily="var(--font-code)" fill={s === "out" ? "var(--faint)" : s === "ran" ? "var(--hi)" : "var(--mute)"}>
              {t}
            </text>
            <text x={x + W / 2} y={y + 25} fontSize={9} textAnchor="middle" fontFamily="var(--font-code)" fill={color(t)}>
              {s === "ran" ? (life ? "ran" : "did work") : s === "up" ? "UP-TO-DATE" : s === "nosrc" ? "NO-SOURCE" : "not needed"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
