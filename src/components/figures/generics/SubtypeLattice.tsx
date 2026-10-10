"use client";

import { useId, useState } from "react";
import { Chip, Narrate, useWidth } from "../functional/kit";

// which List types are subtypes of which. every edge (and every missing edge) was
// checked with javac 25 by assigning a variable of one type to the other:
// e.g. `List<Number> t = (List<Integer>) src` fails with
// "incompatible types: List<Integer> cannot be converted to List<Number>".

type Id = "top" | "ext" | "sup" | "dbl" | "int" | "num" | "obj";
type N = { id: Id; full: string; short: string; wild: boolean };

const NODES: N[] = [
  { id: "top", full: "List<?>", short: "List<?>", wild: true },
  { id: "ext", full: "List<? extends Number>", short: "<? extends Number>", wild: true },
  { id: "sup", full: "List<? super Integer>", short: "<? super Integer>", wild: true },
  { id: "dbl", full: "List<Double>", short: "<Double>", wild: false },
  { id: "int", full: "List<Integer>", short: "<Integer>", wild: false },
  { id: "num", full: "List<Number>", short: "<Number>", wild: false },
  { id: "obj", full: "List<Object>", short: "<Object>", wild: false },
];

// child → parent ("is a subtype of")
const EDGES: [Id, Id][] = [
  ["dbl", "ext"],
  ["int", "ext"],
  ["int", "sup"],
  ["num", "ext"],
  ["num", "sup"],
  ["obj", "sup"],
  ["ext", "top"],
  ["sup", "top"],
];

const up = (id: Id): Id[] => {
  const out = new Set<Id>();
  const walk = (x: Id) => EDGES.filter(([c]) => c === x).forEach(([, p]) => (out.add(p), walk(p)));
  walk(id);
  return [...out];
};
const down = (id: Id): Id[] => NODES.filter((n) => up(n.id).includes(id)).map((n) => n.id);

const INFO: Record<Id, { reads: string; writes: string; note: string }> = {
  top: { reads: "Object", writes: "nothing (only null)", note: "a list of some type you don't know. every List fits here, and in exchange you learn nothing about the elements: they read as Object, and you can't add anything but null." },
  ext: { reads: "Number", writes: "nothing (only null)", note: "a list of some subtype of Number. a List<Double> fits, so does a List<Integer>. everything you read is guaranteed to be a Number. but you can't add, because the list might be the List<Double> and you're holding an Integer." },
  sup: { reads: "Object", writes: "Integer (and null)", note: "a list that some Integer can go into: a List<Integer>, List<Number> or List<Object>. adding an Integer is always safe. reading gives you only Object, because it might be the List<Object>." },
  dbl: { reads: "Double", writes: "Double", note: "a List<Double> is a List<? extends Number> (it produces Numbers). it is not a List<? super Integer>: you can't put an Integer in it." },
  int: { reads: "Integer", writes: "Integer", note: "the one everyone gets wrong: a List<Integer> is not a List<Number> (the red dashed line). if it were, you could add a Double to it through the Number view. it does fit both wildcards." },
  num: { reads: "Number", writes: "any Number", note: "a List<Number> fits both wildcards: it produces Numbers, and an Integer can go in. but it's still not a List<Object>, invariance goes both ways." },
  obj: { reads: "Object", writes: "anything", note: "a List<Object> can take an Integer, so it's a List<? super Integer>. it doesn't produce Numbers, so it's not a List<? extends Number>." },
};

export function SubtypeLattice() {
  const uid = useId().replace(/:/g, "");
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const [sel, setSel] = useState<Id>("int");
  const narrow = w < 560;

  const W = narrow ? 330 : 680;
  const H = narrow ? 345 : 335;
  const pos: Record<Id, [number, number]> = narrow
    ? { top: [165, 34], ext: [86, 150], sup: [246, 150], dbl: [42, 280], int: [124, 280], num: [206, 280], obj: [288, 280] }
    : { top: [340, 40], ext: [190, 155], sup: [490, 155], dbl: [95, 275], int: [262, 275], num: [418, 275], obj: [585, 275] };
  const bw = (n: N) => (narrow ? n.short.length * 6.7 + 14 : n.full.length * 7.3 + 22);
  const bh = 28;

  const node = NODES.find((n) => n.id === sel)!;
  const related = node.wild ? down(sel) : up(sel);
  const lit = new Set<Id>([sel, ...related]);
  const edgeLit = ([c, p]: [Id, Id]) => lit.has(c) && lit.has(p);
  const info = INFO[sel];

  const [ix, iy] = pos.int;
  const [nx] = pos.num;

  return (
    <div ref={ref} className="grid gap-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`subtype lattice of List types. selected ${node.full}`}>
        <defs>
          <marker id={`${uid}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--line-2)" />
          </marker>
          <marker id={`${uid}-l`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--live)" />
          </marker>
        </defs>

        {EDGES.map(([c, p]) => {
          const [x1, y1] = pos[c];
          const [x2, y2] = pos[p];
          const on = edgeLit([c, p]);
          return (
            <line
              key={c + p}
              x1={x1}
              y1={y1 - bh / 2}
              x2={x2}
              y2={y2 + bh / 2 + 2}
              stroke={on ? "var(--live)" : "var(--line-2)"}
              strokeWidth={on ? 1.6 : 1.2}
              markerEnd={`url(#${uid}-${on ? "l" : "a"})`}
              style={{ transition: "stroke 200ms cubic-bezier(0.2,0,0,1)" }}
            />
          );
        })}

        {/* the edge that isn't there */}
        <path
          d={`M ${ix} ${iy + bh / 2} Q ${(ix + nx) / 2} ${iy + bh / 2 + 46} ${nx} ${iy + bh / 2}`}
          fill="none"
          stroke="var(--dead)"
          strokeWidth={1.3}
          strokeDasharray="4 4"
          opacity={sel === "int" || sel === "num" ? 1 : 0.45}
        />
        <g opacity={sel === "int" || sel === "num" ? 1 : 0.45}>
          <circle cx={(ix + nx) / 2} cy={iy + bh / 2 + 23} r={8} fill="var(--bg)" stroke="var(--dead)" strokeWidth={1.2} />
          <text x={(ix + nx) / 2} y={iy + bh / 2 + 26.5} textAnchor="middle" fontSize={10} fill="var(--dead)" fontFamily="var(--font-code)">
            ✗
          </text>
        </g>

        {NODES.map((n) => {
          const [x, y] = pos[n.id];
          const bwN = bw(n);
          const isSel = n.id === sel;
          const on = lit.has(n.id);
          const stroke = isSel ? "var(--hot)" : on ? "var(--live)" : "var(--line-2)";
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={n.full}
              onClick={() => setSel(n.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(n.id))}
              className="cursor-pointer outline-none"
              style={{ opacity: on ? 1 : 0.4, transition: "opacity 200ms cubic-bezier(0.2,0,0,1)" }}
            >
              <rect x={x - bwN / 2} y={y - bh / 2} width={bwN} height={bh} rx={6} fill={isSel ? "var(--well-2)" : "var(--bg)"} stroke={stroke} strokeWidth={isSel ? 1.6 : 1.2} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={narrow ? 11 : 12} fill={isSel ? "var(--hot)" : on ? "var(--hi)" : "var(--ink)"} fontFamily="var(--font-code)">
                {narrow ? n.short : n.full}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid gap-2 text-12">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[11ch] text-faint">{node.wild ? "accepts" : "fits into"}</span>
          {related.length ? (
            related.map((r) => (
              <Chip key={r} tone="live">
                {NODES.find((n) => n.id === r)!.full}
              </Chip>
            ))
          ) : (
            <span className="text-faint">only itself</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[11ch] text-faint">get() gives</span>
          <Chip>{info.reads}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[11ch] text-faint">add() takes</span>
          <Chip>{info.writes}</Chip>
        </div>
      </div>

      <Narrate minH="4.6em">{info.note}</Narrate>
    </div>
  );
}
