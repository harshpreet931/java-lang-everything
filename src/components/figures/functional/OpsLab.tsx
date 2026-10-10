"use client";

import { useState } from "react";
import { Chip, Java, Narrate, Row, Words, tint, useWidth } from "./kit";

// one input, one intermediate operation, the output. every output below is what
// jdk 25 prints for Stream.of(3, 1, 4, 1, 5, 9, 2, 6).<op>.toList().
// lines connect each output to the input it came from. a "meta" band in the middle
// is the helper state a stateful operation has to keep.

type In = { v: string; group?: number };
type Op = {
  id: string;
  code: string;
  input?: In[];
  /** for each output element: [input index, label] */
  out: [number, string][];
  /** input indices that were pulled and rejected */
  dropped?: number[];
  /** input indices never pulled at all (short-circuit) */
  never?: number[];
  kind: "stateless" | "stateful";
  short?: boolean;
  buffer?: string;
  note: string;
};

const IN: In[] = [3, 1, 4, 1, 5, 9, 2, 6].map((v) => ({ v: String(v) }));
const NESTED: In[] = [
  { v: "1", group: 0 },
  { v: "2", group: 0 },
  { v: "3", group: 1 },
  { v: "", group: 2 },
  { v: "4", group: 3 },
  { v: "5", group: 3 },
  { v: "6", group: 3 },
];

const OPS: Op[] = [
  {
    id: "filter",
    code: "filter(n -> n % 2 == 0)",
    out: [[2, "4"], [6, "2"], [7, "6"]],
    dropped: [0, 1, 3, 4, 5],
    kind: "stateless",
    note: "each element is judged on its own. keep or drop, nothing remembered.",
  },
  {
    id: "map",
    code: "map(n -> n * 10)",
    out: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, String(Number(IN[i].v) * 10)] as [number, string]),
    kind: "stateless",
    note: "one in, one out, same order. the type can change too (map(String::valueOf) gives a Stream<String>).",
  },
  {
    id: "flatMap",
    code: "flatMap(List::stream)",
    input: NESTED,
    out: [[0, "1"], [1, "2"], [2, "3"], [4, "4"], [5, "5"], [6, "6"]],
    kind: "stateless",
    note: "each element becomes a whole stream, and those streams are poured into one. the empty list contributes nothing. plain map(List::stream) would give you a Stream<Stream<Integer>> instead: 4 elements, each a stream.",
  },
  {
    id: "distinct",
    code: "distinct()",
    out: [[0, "3"], [1, "1"], [2, "4"], [4, "5"], [5, "9"], [6, "2"], [7, "6"]],
    dropped: [3],
    kind: "stateful",
    buffer: "seen = {3, 1, 4, 5, 9, 2, 6}",
    note: "it has to remember every element it has let through (a set, using equals and hashCode). the second 1 is a repeat, so it's dropped. the first occurrence wins.",
  },
  {
    id: "sorted",
    code: "sorted()",
    out: [[1, "1"], [3, "1"], [6, "2"], [0, "3"], [2, "4"], [4, "5"], [7, "6"], [5, "9"]],
    kind: "stateful",
    buffer: "buffer: all 8, then sort",
    note: "a barrier. nothing can come out until every element has gone in, because the last element might be the smallest. the two 1s keep their original order (the sort is stable).",
  },
  {
    id: "limit",
    code: "limit(3)",
    out: [[0, "3"], [1, "1"], [2, "4"]],
    never: [3, 4, 5, 6, 7],
    kind: "stateful",
    short: true,
    buffer: "count = 3",
    note: "counts what passes. after 3 it stops pulling, so the rest are never even read from the source.",
  },
  {
    id: "skip",
    code: "skip(3)",
    out: [[3, "1"], [4, "5"], [5, "9"], [6, "2"], [7, "6"]],
    dropped: [0, 1, 2],
    kind: "stateful",
    buffer: "count = 3",
    note: "the mirror of limit: throws away the first 3, keeps the rest. it can't short-circuit, it needs to see them all.",
  },
  {
    id: "takeWhile",
    code: "takeWhile(n -> n < 5)",
    out: [[0, "3"], [1, "1"], [2, "4"], [3, "1"]],
    dropped: [4],
    never: [5, 6, 7],
    kind: "stateful",
    short: true,
    note: "takes elements until the first one that fails, then stops for good. 5 fails, so 9, 2 and 6 are never pulled. filter(n -> n < 5) would also have kept the 2.",
  },
  {
    id: "dropWhile",
    code: "dropWhile(n -> n < 5)",
    out: [[4, "5"], [5, "9"], [6, "2"], [7, "6"]],
    dropped: [0, 1, 2, 3],
    kind: "stateful",
    note: "drops elements while the test passes. once one fails, everything after it goes through, even 2, which is less than 5.",
  },
];

export function OpsLab() {
  const [id, setId] = useState("flatMap");
  const op = OPS.find((o) => o.id === id)!;
  const input = op.input ?? IN;
  const [ref, w] = useWidth<HTMLDivElement>(640);

  const n = Math.max(input.length, op.out.length, 8);
  const pad = 8;
  const step = Math.min(78, (w - pad * 2) / n);
  const r = Math.max(10, Math.min(16, step * 0.4));
  const x = (i: number) => pad + step * (i + 0.5);
  const yIn = 26;
  const yOut = 168;
  const mid = (yIn + yOut) / 2;
  const H = 196;
  const dropped = new Set(op.dropped);
  const never = new Set(op.never);

  // group outlines for nested input
  const groups = op.input
    ? [...new Set(op.input.map((e) => e.group!))].map((g) => {
        const idx = op.input!.map((e, i) => (e.group === g ? i : -1)).filter((i) => i >= 0);
        return { g, from: Math.min(...idx), to: Math.max(...idx), empty: idx.every((i) => op.input![i].v === "") };
      })
    : [];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Row k="op =" w="5ch" last>
        <Words options={OPS.map((o) => ({ v: o.id, label: o.id }))} value={id} onChange={setId} label="intermediate operation" />
      </Row>

      <div className="overflow-x-auto text-13 whitespace-pre">
        <Java code={op.input ? "Stream.of(List.of(1, 2), List.of(3), List.of(), List.of(4, 5, 6))" : "Stream.of(3, 1, 4, 1, 5, 9, 2, 6)"} />
        <span className="text-hot">
          <Java code={"\n    ." + op.code} />
        </span>
        <Java code={"\n    .toList()"} />
      </div>

      <div ref={ref} className="relative min-w-0 overflow-hidden">
        <style>{`@keyframes opslab-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}@keyframes opslab-line{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}@media (prefers-reduced-motion: reduce){.opslab-a{animation:none!important}}`}</style>
        <svg key={op.id} width={w} height={H} className="block" role="img" aria-label={`${op.code}: ${input.map((e) => e.v).join(", ")} becomes ${op.out.map((o) => o[1]).join(", ")}`}>
          <text fontFamily="var(--font-code)" x={pad} y={10} fontSize={10} fill="var(--faint)">
            in
          </text>
          <text fontFamily="var(--font-code)" x={pad} y={H - 2} fontSize={10} fill="var(--faint)">
            out
          </text>

          {op.buffer && (
            <g className="opslab-a" style={{ animation: "opslab-in 260ms cubic-bezier(0.2,0,0,1) both" }}>
              <rect x={pad} y={mid - 13} width={w - pad * 2} height={26} rx={2} fill={tint("meta", 8)} stroke="var(--meta)" strokeOpacity={0.55} />
              <text fontFamily="var(--font-code)" x={w / 2} y={mid + 4} fontSize={11} textAnchor="middle" fill="var(--meta)">
                {op.buffer}
              </text>
            </g>
          )}

          {groups.map((g) => (
            <rect
              key={g.g}
              x={x(g.from) - r - 4}
              y={yIn - r - 4}
              width={x(g.to) - x(g.from) + 2 * r + 8}
              height={2 * r + 8}
              rx={4}
              fill="none"
              stroke="var(--line-2)"
              strokeDasharray={g.empty ? "3 3" : undefined}
            />
          ))}

          {/* lines */}
          {op.out.map(([src], j) => {
            const x1 = x(src);
            const x2 = x(j);
            const d = `M ${x1} ${yIn + r} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${yOut - r}`;
            const len = Math.hypot(x2 - x1, yOut - yIn) * 1.2;
            return (
              <path
                key={j}
                d={d}
                fill="none"
                stroke="var(--line-2)"
                strokeWidth={1.25}
                className="opslab-a"
                style={{
                  ["--len" as string]: len,
                  strokeDasharray: len,
                  animation: `opslab-line 420ms cubic-bezier(0.2,0,0,1) ${op.id === "sorted" ? 260 : j * 70}ms both`,
                }}
              />
            );
          })}

          {/* input marbles */}
          {input.map((e, i) =>
            e.v === "" ? (
              <text fontFamily="var(--font-code)" key={i} x={x(i)} y={yIn + 4} fontSize={10} textAnchor="middle" fill="var(--faint)">
                empty
              </text>
            ) : (
              <g key={i} opacity={never.has(i) ? 0.3 : 1}>
                <circle
                  cx={x(i)}
                  cy={yIn}
                  r={r}
                  fill={dropped.has(i) ? tint("dead", 14) : "var(--bg)"}
                  stroke={dropped.has(i) ? "var(--dead)" : never.has(i) ? "var(--line-2)" : "var(--mute)"}
                  strokeDasharray={never.has(i) ? "2 3" : undefined}
                />
                <text fontFamily="var(--font-code)" x={x(i)} y={yIn + 4} fontSize={11} textAnchor="middle" fill={dropped.has(i) ? "var(--dead)" : "var(--hi)"}>
                  {e.v}
                </text>
              </g>
            ),
          )}

          {/* output marbles */}
          {op.out.map(([, label], j) => (
            <g
              key={j}
              className="opslab-a"
              style={{ animation: `opslab-in 300ms cubic-bezier(0.2,0,0,1) ${(op.id === "sorted" ? 420 : 120) + j * 70}ms both` }}
            >
              <circle cx={x(j)} cy={yOut} r={r} fill={tint("live", 12)} stroke="var(--live)" />
              <text fontFamily="var(--font-code)" x={x(j)} y={yOut + 4} fontSize={11} textAnchor="middle" fill="var(--live)">
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={op.kind === "stateful" ? "meta" : undefined}>{op.kind}</Chip>
        {op.short && <Chip>short-circuiting</Chip>}
        {(op.never?.length ?? 0) > 0 && <Chip>dashed: never pulled</Chip>}
        {(op.dropped?.length ?? 0) > 0 && <Chip tone="dead">red: pulled, then dropped</Chip>}
      </div>
<Narrate>{op.note}</Narrate>
    </div>
  );
}
