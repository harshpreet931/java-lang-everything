"use client";

import { useId } from "react";

// ArrayList<Integer> vs int[]: three hops vs zero.
// sizes assume the HotSpot defaults on a 64-bit JVM under 32 GB of heap
// (compressed oops + compressed class pointers): 12-byte header, 4-byte references.

export function BoxedList() {
  const id = useId().replace(/:/g, "");
  const ah = `bl-ah-${id}`;
  const cellX = (i: number) => 20 + i * 30;
  const ints = [
    { v: "7", x: 14 },
    { v: "42", x: 80 },
    { v: "1000", x: 146 },
  ];
  return (
    <svg fontFamily="var(--font-code)" viewBox="0 0 380 330" className="block w-full max-w-[560px]" role="img" aria-label="an ArrayList of Integer: the list object points at an Object array, whose first three slots point at three separate Integer objects. below, an int array holds the three values directly.">
      <defs>
        <marker id={ah} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
        </marker>
      </defs>

      {/* local */}
      <text x={20} y={14} fontSize={10} fill="var(--faint)">
        stack
      </text>
      <rect x={20} y={22} width={74} height={28} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={30} y={40} fontSize={11} fill="var(--mute)">
        list
      </text>
      <circle cx={82} cy={36} r={3.5} fill="var(--ref)" />
      <path d="M85 36 C 110 36, 110 30, 128 30" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />

      {/* the ArrayList object */}
      <rect x={130} y={10} width={170} height={70} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={140} y={28} fontSize={11} fill="var(--hi)">
        ArrayList
      </text>
      <text x={140} y={48} fontSize={11} fill="var(--mute)">
        size
      </text>
      <text x={290} y={48} fontSize={11} fill="var(--hi)" textAnchor="end">
        3
      </text>
      <line x1={140} y1={55} x2={290} y2={55} stroke="var(--line)" />
      <text x={140} y={70} fontSize={11} fill="var(--mute)">
        elementData
      </text>
      <circle cx={284} cy={66} r={3.5} fill="var(--ref)" />
      <path d="M287 66 C 340 66, 340 106, 322 119" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />

      {/* Object[10] */}
      <text x={20} y={102} fontSize={10} fill="var(--faint)">
        Object[10] · 4 B per slot
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={cellX(i)} y={121} width={30} height={28} fill="var(--bg)" stroke="var(--line-2)" />
          {i < 3 ? (
            <circle cx={cellX(i) + 15} cy={135} r={3.5} fill="var(--ref)" />
          ) : (
            <text x={cellX(i) + 15} y={139} fontSize={11} textAnchor="middle" fill="var(--faint)">
              ·
            </text>
          )}
          <text x={cellX(i) + 15} y={116} fontSize={9} textAnchor="middle" fill="var(--faint)">
            {i}
          </text>
        </g>
      ))}

      {/* Integer boxes */}
      {ints.map((n, i) => (
        <g key={n.v}>
          <path
            d={`M${cellX(i) + 15} 138 C ${cellX(i) + 15} 170, ${n.x + 28} 166, ${n.x + 28} 186`}
            fill="none"
            stroke="var(--ref)"
            strokeWidth={1.25}
            markerEnd={`url(#${ah})`}
          />
          <rect x={n.x} y={188} width={58} height={40} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
          <text x={n.x + 8} y={204} fontSize={10} fill="var(--mute)">
            Integer
          </text>
          <text x={n.x + 8} y={220} fontSize={11} fill="var(--hi)">
            {n.v}
          </text>
        </g>
      ))}
      <text x={216} y={204} fontSize={10} fill="var(--faint)">
        16 B each:
      </text>
      <text x={216} y={218} fontSize={10} fill="var(--faint)">
        12 header + 4 int
      </text>

      {/* the int[] alternative */}
      <line x1={20} y1={250} x2={360} y2={250} stroke="var(--line)" strokeDasharray="3 4" />
      <text x={20} y={274} fontSize={10} fill="var(--faint)">
        int[3] · the values themselves
      </text>
      {["7", "42", "1000"].map((v, i) => (
        <g key={v}>
          <rect x={cellX(i)} y={282} width={30} height={28} fill="var(--bg)" stroke="var(--line-2)" />
          <text x={cellX(i) + 15} y={300} fontSize={v.length > 3 ? 10 : 11} textAnchor="middle" fill="var(--hi)">
            {v}
          </text>
        </g>
      ))}
      <text x={124} y={300} fontSize={10} fill="var(--faint)">
        4 B per element. no arrows, no boxes.
      </text>
    </svg>
  );
}
