"use client";

import { useState } from "react";
import { ArrayViz } from "@/components/viz/ArrayViz";

// an int[] you can poke: read any index (including the ones that throw), and run the
// java.util.Arrays helpers. sort and fill change the array in place; copyOf makes a new one.
// the exception text is the real message from jdk 25.

const START = [3, 1, 4, 1, 5];
const ord = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

type Ev = { code: string; out: string; tone: "ink" | "dead" | "hot"; changed?: number[]; fresh?: boolean };

export function ArraysPlayground() {
  const [a, setA] = useState<number[]>(START);
  const [obj, setObj] = useState(1); // which array object `a` points at
  const [ev, setEv] = useState<Ev>({ code: "int[] a = {3, 1, 4, 1, 5};", out: "[3, 1, 4, 1, 5]", tone: "ink" });
  const [idx, setIdx] = useState<number | null>(null);

  const show = (xs: number[]) => `[${xs.join(", ")}]`;

  const read = (i: number) => {
    setIdx(i);
    if (i < 0 || i >= a.length)
      setEv({
        code: `a[${i}]`,
        out: `ArrayIndexOutOfBoundsException: Index ${i} out of bounds for length ${a.length}`,
        tone: "dead",
      });
    else setEv({ code: `a[${i}]`, out: String(a[i]), tone: "hot", changed: [i] });
  };

  const sort = () => {
    const next = [...a].sort((x, y) => x - y);
    setA(next);
    setIdx(null);
    setEv({ code: "Arrays.sort(a);", out: show(next), tone: "ink", changed: next.map((_, i) => i).filter((i) => next[i] !== a[i]) });
  };
  const fill = () => {
    const next = a.map(() => 7);
    setA(next);
    setIdx(null);
    setEv({ code: "Arrays.fill(a, 7);", out: show(next), tone: "ink", changed: next.map((_, i) => i) });
  };
  const grow = () => {
    const next = [...a, 0, 0];
    setA(next);
    setObj((o) => o + 1);
    setIdx(null);
    setEv({ code: `a = Arrays.copyOf(a, ${next.length});`, out: show(next), tone: "ink", changed: [next.length - 2, next.length - 1], fresh: true });
  };
  const shrink = () => {
    const next = a.slice(0, 3);
    setA(next);
    setObj((o) => o + 1);
    setIdx(null);
    setEv({ code: "a = Arrays.copyOf(a, 3);", out: show(next), tone: "ink", fresh: true });
  };
  const reset = () => {
    setA(START);
    setObj(1);
    setIdx(null);
    setEv({ code: "int[] a = {3, 1, 4, 1, 5};", out: "[3, 1, 4, 1, 5]", tone: "ink" });
  };

  const tones: Record<number, "hot" | "dead"> = {};
  (ev.changed ?? []).forEach((i) => (tones[i] = "hot"));

  return (
    <div className="font-mono text-13">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-12 text-mute">
          int[] a <span className="text-faint">→ array object #{obj}</span>
        </span>
        <span className="text-12 text-faint tabular">a.length = {a.length}</span>
      </div>
      <div className="mt-2 min-h-[86px]">
        <ArrayViz values={a} tones={tones} pointers={idx !== null && idx >= 0 && idx < a.length ? { [idx]: "i" } : {}} cell={46} />
      </div>

      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-faint">read a[i] =</span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: a.length + 2 }, (_, k) => k - 1).map((i) => (
              <button
                key={i}
                className="word !min-h-7 !px-2 !text-12"
                aria-pressed={idx === i}
                onClick={() => read(i)}
                style={i < 0 || i >= a.length ? { color: idx === i ? undefined : "var(--dead)" } : undefined}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className="act" onClick={sort}>
            Arrays.sort(a)
          </button>
          <button className="act" onClick={fill}>
            Arrays.fill(a, 7)
          </button>
          <button className="act" onClick={grow}>
            copyOf(a, +2)
          </button>
          <button className="act" onClick={shrink}>
            copyOf(a, 3)
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-well px-4 py-2.5 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div className="text-hi">{ev.code}</div>
        <div style={{ color: ev.tone === "dead" ? "var(--dead)" : ev.tone === "hot" ? "var(--hot)" : "var(--ink)" }}>
          <span className="text-faint">→ </span>
          {ev.out}
        </div>
      </div>
      <p className="mt-3 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi">
        {ev.tone === "dead" ? (
          <>valid indexes are 0 to {a.length - 1}. anything else throws, every time: java checks every array access.</>
        ) : ev.fresh ? (
          <>
            <code>copyOf</code> can&apos;t resize anything: arrays have a fixed length. it builds a <em>new</em> array (object #{obj}),
            copies what fits, pads with zeros, and <code>a</code> now points at it. the old array is garbage if nothing else refers to it.
          </>
        ) : ev.code.startsWith("Arrays.") ? (
          <>
            same object (#{obj}), new contents. <code>sort</code> and <code>fill</code> change the array in place and return nothing.
          </>
        ) : ev.code.startsWith("a[") ? (
          <>reading a slot is one bounds check and one memory read. index {idx} is the {ord(idx! + 1)} slot, because counting starts at 0.</>
        ) : (
          <>five ints in a row. pick an index to read, or run one of the <code>Arrays</code> helpers.</>
        )}
      </p>
    </div>
  );
}
