"use client";

import { useId } from "react";

// HashSet, opened up: one field, a HashMap, whose every value is the same object.
// from jdk 25's HashSet.java: static final Object PRESENT = new Object();
// add(e) is map.put(e, PRESENT) == null.

const KEYS = ["pear", "apple", "fig", "kiwi"];

export function PresentMap() {
  const id = useId().replace(/:/g, "");
  const ah = `pm-${id}`;
  const rowY = (i: number) => 96 + i * 40;
  return (
    <svg viewBox="0 0 520 250" fontFamily="var(--font-code)" className="block w-full max-w-[620px]" role="img" aria-label="a HashSet holds one field, a HashMap. each of its entries has the element as the key and the same shared PRESENT object as the value.">
      <defs>
        <marker id={ah} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
        </marker>
      </defs>

      {/* the HashSet */}
      <rect x={10} y={14} width={150} height={52} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={22} y={34} fontSize={12} fill="var(--hi)">
        HashSet
      </text>
      <text x={22} y={54} fontSize={11} fill="var(--mute)">
        map
      </text>
      <circle cx={142} cy={50} r={3.5} fill="var(--ref)" />
      <path d="M145 50 C 180 50, 180 30, 212 30" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />

      {/* the HashMap and its entries */}
      <rect x={214} y={14} width={120} height={32} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={226} y={34} fontSize={12} fill="var(--hi)">
        HashMap
      </text>
      <text x={214} y={78} fontSize={10} fill="var(--faint)">
        entries: key → value
      </text>
      {KEYS.map((k, i) => (
        <g key={k}>
          <rect x={214} y={rowY(i)} width={150} height={28} rx={3} fill="var(--bg)" stroke="var(--line-2)" />
          <line x1={294} y1={rowY(i)} x2={294} y2={rowY(i) + 28} stroke="var(--line)" />
          <text x={224} y={rowY(i) + 18} fontSize={11} fill="var(--hi)">
            &quot;{k}&quot;
          </text>
          <circle cx={330} cy={rowY(i) + 14} r={3.5} fill="var(--ref)" />
          <path
            d={`M333 ${rowY(i) + 14} C 380 ${rowY(i) + 14}, 390 ${170}, 414 ${170}`}
            fill="none"
            stroke="var(--ref)"
            strokeWidth={1.25}
            markerEnd={i === 0 ? `url(#${ah})` : undefined}
            opacity={0.9}
          />
        </g>
      ))}

      {/* the one shared object */}
      <rect x={416} y={150} width={96} height={40} rx={4} fill="var(--bg)" stroke="var(--hot)" />
      <text x={428} y={167} fontSize={11} fill="var(--hi)">
        Object
      </text>
      <text x={428} y={182} fontSize={10} fill="var(--hot)">
        PRESENT
      </text>
      <text x={416} y={210} fontSize={9} fill="var(--faint)">
        static final, one
      </text>
      <text x={416} y={222} fontSize={9} fill="var(--faint)">
        for every HashSet
      </text>

    </svg>
  );
}
