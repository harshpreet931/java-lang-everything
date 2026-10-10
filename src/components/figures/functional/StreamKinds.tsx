"use client";

import { useId, useState } from "react";
import { Java, useWidth } from "./kit";

// the four kinds of stream and the methods that move between them.
// widening between primitives is asXStream(); narrowing needs mapToX(f);
// getting back to objects is boxed() or mapToObj(f). all real jdk 25 methods.

type K = "S" | "I" | "L" | "D";
const NAME: Record<K, string> = { S: "Stream<T>", I: "IntStream", L: "LongStream", D: "DoubleStream" };

const EDGES: { from: K; to: K; label: string }[] = [
  { from: "S", to: "I", label: "mapToInt(f)" },
  { from: "S", to: "L", label: "mapToLong(f)" },
  { from: "S", to: "D", label: "mapToDouble(f)" },
  { from: "I", to: "S", label: "boxed() · mapToObj(f)" },
  { from: "L", to: "S", label: "boxed() · mapToObj(f)" },
  { from: "D", to: "S", label: "boxed() · mapToObj(f)" },
  { from: "I", to: "L", label: "asLongStream()" },
  { from: "I", to: "D", label: "asDoubleStream()" },
  { from: "L", to: "D", label: "asDoubleStream()" },
  { from: "L", to: "I", label: "mapToInt(f)" },
  { from: "D", to: "I", label: "mapToInt(f)" },
  { from: "D", to: "L", label: "mapToLong(f)" },
];

const INFO: Record<K, { holds: string; make: string; extra: string; ex: string }> = {
  S: {
    holds: "references to objects. an Integer here is a full object on the heap.",
    make: "list.stream(), Stream.of(...), Stream.iterate(...)",
    extra: "collect, reduce, min/max(comparator) → Optional<T>",
    ex: "words.stream().mapToInt(String::length).sum()",
  },
  I: {
    holds: "raw ints. no objects, no boxing.",
    make: "IntStream.range(a, b), rangeClosed, of, iterate, \"text\".chars(), new Random().ints()",
    extra: "sum() → int, average() → OptionalDouble, max() → OptionalInt, summaryStatistics()",
    ex: "IntStream.rangeClosed(1, 5).sum()",
  },
  L: {
    holds: "raw longs.",
    make: "LongStream.range(a, b), rangeClosed, of",
    extra: "sum() → long, average(), max() → OptionalLong, summaryStatistics()",
    ex: "IntStream.rangeClosed(1, 100_000).asLongStream().sum()",
  },
  D: {
    holds: "raw doubles.",
    make: "DoubleStream.of(...), Arrays.stream(double[]), new Random().doubles()",
    extra: "sum() (compensated, so less rounding error), average(), max() → OptionalDouble",
    ex: "DoubleStream.of(1.5, 2.5).sum()",
  },
};

export function StreamKinds() {
  const [sel, setSel] = useState<K>("I");
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const uid = useId().replace(/:/g, "");
  const H = 272;
  const narrow = w < 520;
  const pos: Record<K, { x: number; y: number }> = {
    S: { x: w / 2, y: 34 },
    I: { x: w / 6, y: 166 },
    L: { x: w / 2, y: 166 },
    D: { x: (5 * w) / 6, y: 166 },
  };
  const nodeW = Math.min(124, w / 3 - 10);
  const out = EDGES.filter((e) => e.from === sel);
  const info = INFO[sel];

  const path = (e: (typeof EDGES)[number]) => {
    const a = pos[e.from];
    const b = pos[e.to];
    if (e.from === "S" || e.to === "S") {
      const down = e.from === "S";
      const x1 = a.x + (down ? (b.x - a.x) * 0.15 : 0);
      const y1 = down ? a.y + 16 : a.y - 16;
      const x2 = b.x + (down ? 0 : (a.x - b.x) * 0.15);
      const y2 = down ? b.y - 16 : b.y + 16;
      return { d: `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 };
    }
    const right = b.x > a.x;
    const dy = right ? 1 : -1;
    const span = Math.abs(b.x - a.x);
    const bend = 22 + span * 0.12;
    const y = a.y + dy * 16;
    const cy = a.y + dy * (16 + bend);
    return { d: `M ${a.x} ${y} C ${a.x} ${cy}, ${b.x} ${cy}, ${b.x} ${y}`, lx: (a.x + b.x) / 2, ly: a.y + dy * (16 + bend * 0.78) };
  };

  return (
    <div className="grid gap-4">
      <div ref={ref} className="min-w-0 overflow-hidden">
        <svg width={w} height={H} className="block" role="img" aria-label={`conversions from ${NAME[sel]}: ${out.map((e) => `${e.label} to ${NAME[e.to]}`).join("; ")}`}>
          <defs>
            <marker id={`${uid}-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--hot)" />
            </marker>
          </defs>
          {out.map((e) => {
            const p = path(e);
            return <path key={e.from + e.to} d={p.d} fill="none" stroke="var(--hot)" strokeWidth={1.25} markerEnd={`url(#${uid}-a)`} />;
          })}
          {!narrow && out.map((e) => {
            const p = path(e);
            const label = e.label;
            return (
              <g key={`l${e.from}${e.to}`}>
                <rect x={p.lx - label.length * 3.4 - 5} y={p.ly - 9} width={label.length * 6.8 + 10} height={18} rx={3} fill="var(--well)" />
                <text x={p.lx} y={p.ly + 4} fontSize={11} textAnchor="middle" fontFamily="var(--font-code)" fill="var(--hot)">
                  {label}
                </text>
              </g>
            );
          })}
          {(Object.keys(pos) as K[]).map((k) => {
            const on = k === sel;
            return (
              <g key={k} onClick={() => setSel(k)} className="cursor-pointer">
                <rect
                  x={pos[k].x - nodeW / 2}
                  y={pos[k].y - 16}
                  width={nodeW}
                  height={32}
                  rx={6}
                  fill={on ? "var(--well-2)" : "var(--bg)"}
                  stroke={on ? "var(--hi)" : "var(--line-2)"}
                />
                <text x={pos[k].x} y={pos[k].y + 4} fontSize={12} textAnchor="middle" fontFamily="var(--font-code)" fill={on ? "var(--hi)" : "var(--ink)"}>
                  {NAME[k]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="stream kind">
        {(Object.keys(NAME) as K[]).map((k) => (
          <button key={k} className="word" aria-pressed={sel === k} onClick={() => setSel(k)}>
            {NAME[k]}
          </button>
        ))}
      </div>

      <div className="grid gap-x-6 gap-y-2 border-t border-line pt-4 text-12 sm:grid-cols-[12ch_minmax(0,1fr)]" aria-live="polite">
        <span className="text-faint">holds</span>
        <span className="font-serif text-16 leading-[1.5] text-ink">{info.holds}</span>
        <span className="text-faint">leaves via</span>
        <span className="flex flex-col gap-0.5 text-ink">
          {out.map((e) => (
            <span key={e.to}>
              <span className="text-hot">{e.label}</span>
              <span className="text-faint"> → </span>
              {NAME[e.to]}
            </span>
          ))}
        </span>
        <span className="text-faint">make one</span>
        <span className="text-ink">{info.make}</span>
        <span className="text-faint">only here</span>
        <span className="text-ink">{info.extra}</span>
        <span className="text-faint">example</span>
        <span className="min-w-0 overflow-x-auto whitespace-pre text-13">
          <Java code={info.ex} />
        </span>
      </div>
    </div>
  );
}
