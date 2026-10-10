"use client";

import { useId } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Narration } from "./kit";

// a HashSet<Point> with the default 16 buckets, following jdk 25's HashMap exactly:
// hash = h ^ (h >>> 16), bucket = hash & 15. Point.hashCode() is Objects.hash(x, y), so
// (1, 2) → 31 * (31 + 1) + 2 = 994 → bucket 2, and (7, 2) → 31 * (31 + 7) + 2 = 1180 → bucket 12.
// the printed results match a real run (Vanish.java in the chapter).

const CODE = `Set<Point> set = new HashSet<>();
Point p = new Point(1, 2);
set.add(p);
p.x = 7;
set.contains(p);
set.remove(p);
set.add(p);
set.contains(new Point(1, 2));`;

const hashOf = (x: number, y: number) => 31 * (31 + x) + y;
const spread = (h: number) => (h ^ (h >>> 16)) & 15;

type Entry = { bucket: number; hash: number };
type Step = { line: number; x: number; entries: Entry[]; look?: { bucket: number; ok: boolean; probe: string }; out?: string; note: string };

const STEPS: Step[] = [
  { line: 2, x: 1, entries: [], note: "an empty HashSet: 16 buckets, nothing in them. p is a Point(1, 2) whose hashCode() uses both fields." },
  {
    line: 3,
    x: 1,
    entries: [{ bucket: 2, hash: 994 }],
    note: "add(p): hashCode() is 994, the spread keeps it 994, and 994 & 15 is 2. the entry goes in bucket 2, and it remembers the hash it was filed under.",
  },
  {
    line: 4,
    x: 7,
    entries: [{ bucket: 2, hash: 994 }],
    note: "p.x = 7. the set isn't told. the entry still sits in bucket 2 with its old hash, pointing at an object whose hashCode() is now 1180.",
  },
  {
    line: 5,
    x: 7,
    entries: [{ bucket: 2, hash: 994 }],
    look: { bucket: 12, ok: false, probe: "p, hash 1180" },
    out: "false",
    note: "contains(p) computes 1180 → bucket 12. bucket 12 is empty. so the set says it doesn't contain the object that is, in fact, inside it.",
  },
  {
    line: 6,
    x: 7,
    entries: [{ bucket: 2, hash: 994 }],
    look: { bucket: 12, ok: false, probe: "p, hash 1180" },
    out: "false",
    note: "remove(p) looks in the same wrong bucket and removes nothing. size() is still 1. there's no way to get this entry out except clearing the whole set.",
  },
  {
    line: 7,
    x: 7,
    entries: [
      { bucket: 2, hash: 994 },
      { bucket: 12, hash: 1180 },
    ],
    note: "add(p) finds bucket 12 empty and adds it again. the same object is in the set twice, and printing it shows [(7, 2), (7, 2)]. a Set with a duplicate.",
  },
  {
    line: 8,
    x: 7,
    entries: [
      { bucket: 2, hash: 994 },
      { bucket: 12, hash: 1180 },
    ],
    look: { bucket: 2, ok: false, probe: "Point(1, 2), hash 994" },
    out: "false",
    note: "and searching with what it used to be? Point(1, 2) hashes to 994, the right bucket, the hash even matches. then equals compares (1, 2) with the object, which is (7, 2) now. false.",
  },
];

export function MutableKey() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const st = STEPS[s.i];
  const uid = useId().replace(/:/g, "");
  const W = 336;
  const cw = 38;
  const ch = 34;
  const gx = (W - 8 * cw) / 2;
  const cell = (b: number) => ({ x: gx + (b % 8) * cw, y: 8 + Math.floor(b / 8) * (ch + 22) });
  const obj = { x: W / 2 - 96, y: 132, w: 192, h: 44 };

  return (
    <div {...s.keys} className="@container grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="a mutable key inside a HashSet">
      <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CodePanel code={CODE} hot={[st.line]} file="Vanish.java" />
        <div className="min-w-0">
          <svg viewBox={`0 0 ${W} 190`} className="mx-auto block w-full max-w-[420px]" style={{ fontFamily: "var(--font-code)" }} role="img"
            aria-label={`${st.entries.length} entries, p is (${st.x}, 2)`}>
            <defs>
              <marker id={`${uid}-r`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
              </marker>
            </defs>
            {Array.from({ length: 16 }, (_, b) => {
              const c = cell(b);
              const looking = st.look?.bucket === b;
              return (
                <g key={b}>
                  <rect x={c.x + 2} y={c.y} width={cw - 4} height={ch} rx={4} fill={looking ? "color-mix(in srgb, var(--hot) 18%, var(--bg))" : "var(--bg)"}
                    stroke={looking ? "var(--hot)" : "var(--line-2)"} strokeWidth={looking ? 1.5 : 1} className="transition-[fill,stroke] duration-200" />
                  <text x={c.x + cw / 2} y={c.y + ch + 12} textAnchor="middle" fontSize={9} fill={looking ? "var(--hot)" : "var(--faint)"}>
                    {b}
                  </text>
                </g>
              );
            })}
            {st.entries.map((e) => {
              const c = cell(e.bucket);
              return (
                <g key={e.bucket}>
                  <text x={c.x + cw / 2} y={c.y + 14} textAnchor="middle" fontSize={9} fill="var(--mute)">
                    h={e.hash}
                  </text>
                  <circle cx={c.x + cw / 2} cy={c.y + 24} r={2.5} fill="var(--ref)" />
                  <line x1={c.x + cw / 2} y1={c.y + 24} x2={obj.x + obj.w / 2 + (e.bucket === 2 ? -20 : 20)} y2={obj.y - 2} stroke="var(--ref)" strokeWidth={1.2} markerEnd={`url(#${uid}-r)`} />
                </g>
              );
            })}
            <rect x={obj.x} y={obj.y} width={obj.w} height={obj.h} rx={5} fill="var(--bg)" stroke={s.i === 2 ? "var(--hot)" : "var(--line-2)"} strokeWidth={s.i === 2 ? 1.5 : 1} />
            <text x={W / 2} y={obj.y + 17} textAnchor="middle" fontSize={11} fill="var(--hi)">
              p: Point(<tspan fill={s.i >= 2 ? "var(--hot)" : "var(--hi)"}>{st.x}</tspan>, 2)
            </text>
            <text x={W / 2} y={obj.y + 33} textAnchor="middle" fontSize={9.5} fill="var(--mute)">
              hashCode() = {hashOf(st.x, 2)} → bucket {spread(hashOf(st.x, 2))}
            </text>
          </svg>
          <div className="mt-1 min-h-[1.6em] text-center text-12" aria-live="polite">
            {st.look && (
              <>
                <span className="text-faint">looking up {st.look.probe} in bucket {st.look.bucket}: </span>
                <span className="text-dead">{st.out}</span>
              </>
            )}
            {!st.look && <span className="text-faint">size() = {st.entries.length}</span>}
          </div>
        </div>
      </div>
      <Narration>{st.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
