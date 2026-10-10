"use client";

import { useId } from "react";

// CopyOnWriteArrayList mid-iteration: the list's `array` field already points at a new,
// bigger copy (add copied it), while the iterator's `snapshot` still points at the old one.
// field names are the real ones from jdk 25 (CopyOnWriteArrayList.array, COWIterator.snapshot / cursor).

export function CowSnapshot() {
  const id = useId().replace(/:/g, "");
  const ah = `cow-${id}`;
  const cells = (x: number, y: number, vals: string[], hot?: number) =>
    vals.map((v, i) => (
      <g key={`${x}-${i}`}>
        <rect x={x + i * 30} y={y} width={30} height={28} fill="var(--bg)" stroke={hot === i ? "var(--hot)" : "var(--line-2)"} />
        <text x={x + i * 30 + 15} y={y + 18} textAnchor="middle" fontSize={12} fill={hot === i ? "var(--hot)" : "var(--hi)"}>
          {v}
        </text>
      </g>
    ));
  return (
    <svg viewBox="0 0 520 250" fontFamily="var(--font-code)" className="block w-full max-w-[600px]" role="img" aria-label="a CopyOnWriteArrayList whose array field points at a new 4-element array, while an iterator's snapshot field still points at the old 3-element array">
      <defs>
        <marker id={ah} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
        </marker>
      </defs>
      <text x={10} y={16} fontSize={10} fill="var(--faint)">
        stack
      </text>
      <rect x={10} y={24} width={90} height={60} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={20} y={46} fontSize={11} fill="var(--mute)">
        list
      </text>
      <circle cx={86} cy={42} r={3.5} fill="var(--ref)" />
      <text x={20} y={72} fontSize={11} fill="var(--mute)">
        it
      </text>
      <circle cx={86} cy={68} r={3.5} fill="var(--ref)" />

      {/* the list */}
      <path d="M89 42 C 120 42, 120 34, 150 34" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
      <rect x={152} y={16} width={180} height={44} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={162} y={33} fontSize={11} fill="var(--hi)">
        CopyOnWriteArrayList
      </text>
      <text x={162} y={51} fontSize={11} fill="var(--mute)">
        array
      </text>
      <circle cx={318} cy={47} r={3.5} fill="var(--ref)" />
      <path d="M321 47 C 380 47, 390 70, 390 92" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
      <text x={340} y={140} fontSize={10} fill="var(--faint)">
        new copy
      </text>
      {cells(340, 96, ["a", "b", "c", "d"], 3)}

      {/* the iterator */}
      <path d="M89 68 C 120 68, 120 150, 150 150" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
      <rect x={152} y={130} width={150} height={62} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={162} y={147} fontSize={11} fill="var(--hi)">
        COWIterator
      </text>
      <text x={162} y={165} fontSize={11} fill="var(--mute)">
        snapshot
      </text>
      <circle cx={288} cy={161} r={3.5} fill="var(--ref)" />
      <text x={162} y={183} fontSize={11} fill="var(--mute)">
        cursor
      </text>
      <text x={290} y={183} fontSize={11} fill="var(--hi)" textAnchor="end">
        1
      </text>
      <path d="M291 161 C 320 161, 320 214, 336 214" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
      <text x={340} y={196} fontSize={10} fill="var(--faint)">
        old array (unchanged)
      </text>
      {cells(340, 200, ["a", "b", "c"])}
    </svg>
  );
}
