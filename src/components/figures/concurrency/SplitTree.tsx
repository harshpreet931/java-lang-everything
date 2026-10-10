"use client";

import { useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "./ui";

// divide and conquer, drawn as the tree of tasks it creates.
// sum(a[0..16)): split until a range is at most `threshold` long, sum the leaves
// directly, then combine on the way back up. the stepper goes: split level by level,
// compute the leaves, then join level by level.

const A = Array.from({ length: 16 }, (_, i) => i + 1);
type N = { lo: number; hi: number; depth: number; leaf: boolean; sum: number };

function tree(th: number) {
  const levels: N[][] = [];
  const rec = (lo: number, hi: number, d: number) => {
    const leaf = hi - lo <= th;
    (levels[d] ??= []).push({ lo, hi, depth: d, leaf, sum: A.slice(lo, hi).reduce((x, y) => x + y, 0) });
    if (!leaf) {
      const mid = (lo + hi) >> 1;
      rec(lo, mid, d + 1);
      rec(mid, hi, d + 1);
    }
  };
  rec(0, 16, 0);
  return levels;
}

export function SplitTree() {
  const [th, setTh] = useState(4);
  const levels = useMemo(() => tree(th), [th]);
  const depth = levels.length - 1;
  // steps: reveal levels 0..depth (split), then compute leaves, then join depth-1..0
  const count = depth + 1 + 1 + depth;
  const s = useStepper(count, { interval: 1300 });
  const shownDepth = Math.min(s.i, depth);
  const leavesDone = s.i >= depth + 1;
  const joinedTo = s.i > depth + 1 ? depth - (s.i - depth - 1) : Infinity; // levels >= this have sums
  const leaves = levels.flat().filter((n) => n.leaf).length;

  const hasSum = (n: N) => (n.leaf ? leavesDone : n.depth >= joinedTo);
  const note =
    s.i === 0
      ? "one task for the whole array. too big to just do, so it splits."
      : s.i <= depth
        ? `level ${s.i}: every task bigger than ${th} elements splits in half. one half is forked (pushed onto the worker's deque, where any idle worker can take it), the other half the current worker keeps for itself.`
        : s.i === depth + 1
          ? `${leaves} leaves of at most ${th} elements each. small enough: each one is summed with a plain loop, on whichever worker ends up holding it.`
          : joinedTo > 0
            ? "on the way back up, each task join()s its forked half and adds the two results."
            : "the root has its answer: 136. same as a plain loop, computed by several threads.";

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 text-13">
        <Row k="threshold =" w="12ch">
          <Words options={[2, 4, 8]} value={th} onChange={(v) => (setTh(v), s.go(0))} label="threshold" />
          <span className="basis-full text-11 text-faint sm:ml-2 sm:basis-auto">elements. at or below this, stop splitting</span>
        </Row>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[330px]">
          {levels.map((row, d) => (
            <div key={d} className="grid gap-1 py-1.5" style={{ gridTemplateColumns: `repeat(${2 ** d}, minmax(0, 1fr))` }}>
              {Array.from({ length: 2 ** d }, (_, k) => {
                const n = row.find((x) => x.lo === (k * 16) / 2 ** d);
                if (!n || d > shownDepth) return <span key={k} />;
                const done = hasSum(n);
                return (
                  <div
                    key={k}
                    className="obj-in mx-auto flex w-full max-w-[150px] min-w-0 flex-col items-center rounded-md bg-well px-1 py-1"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${done ? "var(--live)" : n.leaf && s.i >= depth ? "var(--hot)" : "var(--line-2)"}`,
                    }}
                  >
                    <span className="truncate text-[10px] leading-4 text-mute tabular sm:text-11">
                      {n.lo}..{n.hi}
                    </span>
                    <span className="text-11 leading-4 tabular sm:text-12" style={{ color: done ? "var(--live)" : "var(--faint)" }}>
                      {done ? n.sum : n.leaf ? "leaf" : "fork"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
