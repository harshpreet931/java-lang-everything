"use client";

import { useState } from "react";
import { Java, Narration, Words } from "./kit";

// item 31. which arguments compile, with and without wildcards. a producer (you read
// from it) wants `? extends`, a consumer (you write into it) wants `? super`.
// every cell was checked with javac 25.

type Arg = { t: string; sum: [boolean, boolean]; fill: [boolean, boolean] };

// [without wildcard, with wildcard]
const ARGS: Arg[] = [
  { t: "List<Integer>", sum: [false, true], fill: [true, true] },
  { t: "List<Double>", sum: [false, true], fill: [false, false] },
  { t: "List<Number>", sum: [true, true], fill: [false, true] },
  { t: "List<Object>", sum: [false, false], fill: [false, true] },
];

export function PecsGrid() {
  const [wild, setWild] = useState<0 | 1>(0);

  const sig = {
    sum: wild ? "double sum(Collection<? extends Number> xs)" : "double sum(Collection<Number> xs)",
    fill: wild ? "void fillZeros(List<? super Integer> out)" : "void fillZeros(List<Integer> out)",
  };

  const cell = (ok: boolean) => (
    <span
      className="flex h-8 items-center justify-center rounded-sm text-12 transition-colors duration-200"
      style={{
        color: ok ? "var(--live)" : "var(--dead)",
        background: `color-mix(in srgb, var(--${ok ? "live" : "dead"}) 9%, var(--bg))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${ok ? "live" : "dead"}) 45%, transparent)`,
      }}
    >
      {ok ? "compiles" : "error"}
    </span>
  );

  return (
    <div className="@container grid gap-4">
      <div className="grid grid-cols-[11ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3">
        <span className="text-12 text-faint">wildcards =</span>
        <Words
          label="use wildcards"
          value={wild}
          onChange={setWild}
          options={[
            { v: 0, label: "off" },
            { v: 1, label: "on (PECS)" },
          ]}
        />
      </div>

      <div className="grid gap-1.5 overflow-x-auto">
        <div className="grid min-w-[440px] grid-cols-[13ch_minmax(0,1fr)_minmax(0,1fr)] items-end gap-1.5 text-12">
          <span className="text-faint">argument</span>
          <span className="text-faint">
            sum(xs) <span className="text-ink">reads</span>: producer
          </span>
          <span className="text-faint">
            fillZeros(out) <span className="text-ink">writes</span>: consumer
          </span>
        </div>
        {ARGS.map((a) => (
          <div key={a.t} className="grid min-w-[440px] grid-cols-[13ch_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
            <span className="text-12 text-hi">{a.t}</span>
            {cell(a.sum[wild])}
            {cell(a.fill[wild])}
          </div>
        ))}
      </div>

      <div className="grid gap-1 rounded-md bg-bg px-4 py-3 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="overflow-x-auto whitespace-nowrap">
          <Java code={sig.sum} />
        </div>
        <div className="overflow-x-auto whitespace-nowrap">
          <Java code={sig.fill} />
        </div>
      </div>

      <Narration>
        {wild
          ? "producer extends, consumer super. sum can now read any list of numbers, and fillZeros can write into any list that holds Integers."
          : "without wildcards, each method takes exactly one type. a List<Integer> is not a List<Number>, so most calls fail."}
      </Narration>
    </div>
  );
}
