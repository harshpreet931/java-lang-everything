"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Row, Words, ring, NARR } from "./kit";

// Files.walk(root, maxDepth): depth-first, pre-order, lazy. the tree is the one the
// chapter's runnable example builds. order inside a directory is whatever the OS returns
// (the example sorts its output so it's stable); the depth-first shape is guaranteed.

type N = { name: string; depth: number; dir?: boolean; path: string };

const NODES: N[] = [
  { name: "site/", depth: 0, dir: true, path: "site" },
  { name: "build.gradle", depth: 1, path: "site/build.gradle" },
  { name: "docs/", depth: 1, dir: true, path: "site/docs" },
  { name: "readme.md", depth: 2, path: "site/docs/readme.md" },
  { name: "src/", depth: 1, dir: true, path: "site/src" },
  { name: "main/", depth: 2, dir: true, path: "site/src/main" },
  { name: "App.java", depth: 3, path: "site/src/main/App.java" },
  { name: "Util.java", depth: 3, path: "site/src/main/Util.java" },
];

const DEPTHS = [
  { v: 1, label: "1" },
  { v: 2, label: "2" },
  { v: 99, label: "unlimited" },
];

export function WalkOrder() {
  const [depth, setDepth] = useState(99);
  return (
    <div className="text-13">
      <Row k="maxDepth =" w="10ch" last>
        <Words label="max depth" options={DEPTHS} value={depth} onChange={setDepth} />
      </Row>
      <Walker key={depth} depth={depth} />
    </div>
  );
}

function Walker({ depth }: { depth: number }) {
  const visit = NODES.filter((n) => n.depth <= depth);
  const s = useStepper(visit.length + 1, { interval: 900 });
  const seen = visit.slice(0, s.i);
  const cur = s.i > 0 ? visit[s.i - 1] : undefined;

  return (
    <div {...s.keys} className="@container outline-none">
      <div className="mt-3 overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line)]">
        <Java code={`try (Stream<Path> s = Files.walk(root${depth === 99 ? "" : `, ${depth}`})) { ... }`} />
      </div>
      <div className="mt-4 grid gap-5 @[520px]:grid-cols-2">
        <div>
          <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">on disk</div>
          <ul className="grid gap-1">
            {NODES.map((n) => {
              const out = n.depth > depth;
              const on = cur?.path === n.path;
              const done = seen.some((x) => x.path === n.path);
              return (
                <li key={n.path} style={{ paddingLeft: `${n.depth * 2.2}ch` }}>
                  <span
                    className="inline-flex h-7 items-center rounded-[1px] px-2 text-12 transition-[box-shadow,color,opacity] duration-200"
                    style={{
                      boxShadow: on ? ring("hot") : done ? ring("line-2") : "none",
                      color: on ? "var(--hot)" : out ? "var(--faint)" : n.dir ? "var(--hi)" : "var(--ink)",
                      opacity: out ? 0.45 : 1,
                    }}
                  >
                    {n.name}
                    {out && <span className="ml-2 text-[10px] text-faint">too deep</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">what the stream hands you, in order</div>
          <ol className="grid gap-1 text-12">
            {seen.length === 0 && <li className="text-faint">nothing yet. the stream is lazy: no disk access until you pull.</li>}
            {seen.map((n, i) => (
              <li key={n.path} className="flex gap-2">
                <span className="w-[2ch] text-right text-faint tabular">{i + 1}</span>
                <span className={n === cur ? "text-hot" : "text-ink"}>{n.path}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className={`mt-4 min-h-[1.7em] ${NARR}`} aria-live="polite">
        {s.i === 0
          ? "press step. walk starts at the root itself, then goes depth-first."
          : s.atEnd
            ? `done: ${visit.length} paths. ${depth === 1 ? "depth 1 is the root plus Files.list(root)." : depth === 2 ? "main/ is visited, but nothing inside it." : "every directory is entered as soon as it's seen."}`
            : cur?.dir
              ? `${cur.name} is a directory, so the walk goes into it before moving on to its siblings.`
              : `${cur?.name} is a file. emit it, move to the next entry.`}
      </p>
      <StepControls s={s} className="mt-2" compact />
    </div>
  );
}
