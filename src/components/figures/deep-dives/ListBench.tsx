"use client";

import { useEffect, useState } from "react";
import { Words } from "./kit";

// measured with Bench.java (content/deep-dives/arraylist-vs-linkedlist.mdx): jdk 25.0.4,
// apple M4 Pro (14 cores), -Xms4g -Xmx4g -Xmn2g so no GC runs mid-measurement, one case per
// fresh JVM, 21 rounds with the first 5 thrown away, median round; the number shown is the
// median of three such runs. the machine was busy (load ~10-19), so treat the ratios, not the
// digits, as the result.

type Row = { label: string; ns: number; bigO: string; tone?: "live" | "dead" | "hot" };
type Op = { label: string; unit: string; rows: Row[]; verdict: string };

const OPS: Record<string, Op> = {
  get: {
    label: "get(i)",
    unit: "per get, random index, 100,000 elements",
    rows: [
      { label: "ArrayList", ns: 0.66, bigO: "O(1)", tone: "live" },
      { label: "LinkedList", ns: 40598, bigO: "O(n)", tone: "dead" },
    ],
    verdict: "the one big-O gets right, and then some: 61,000 times slower. LinkedList.get walks from the nearer end, about 25,000 nodes per call here, at 1.6 ns a hop.",
  },
  iterate: {
    label: "iterate",
    unit: "per element, for-each sum, 100,000 elements",
    rows: [
      { label: "int[]", ns: 0.24, bigO: "O(n)" },
      { label: "ArrayList", ns: 0.34, bigO: "O(n)", tone: "live" },
      { label: "LinkedList, fresh", ns: 1.6, bigO: "O(n)" },
      { label: "LinkedList, shuffled", ns: 8.91, bigO: "O(n)", tone: "dead" },
    ],
    verdict: "big-O calls these all equal. a freshly built LinkedList is 4.7 times slower than an ArrayList, and one whose nodes are linked in a different order than they were allocated in is 26 times slower. same O(n), same elements.",
  },
  front: {
    label: "add at the front",
    unit: "per insert, building a 20,000-element list from the front",
    rows: [
      { label: "ArrayList.add(0, x)", ns: 509, bigO: "O(n)", tone: "dead" },
      { label: "LinkedList.addFirst", ns: 7.72, bigO: "O(1)", tone: "live" },
    ],
    verdict: "LinkedList's home turf, and big-O is right: every add(0, x) shifts the whole array. (an ArrayDeque does the same job without the nodes.)",
  },
  middle: {
    label: "insert in the middle",
    unit: "per insert + remove at the middle, 100,000 elements",
    rows: [
      { label: "ArrayList.add(n/2, x)", ns: 6025, bigO: "O(n)", tone: "live" },
      { label: "LinkedList.add(n/2, x)", ns: 165454, bigO: "O(n)", tone: "dead" },
      { label: "LinkedList, iterator already there", ns: 9.72, bigO: "O(1)", tone: "hot" },
    ],
    verdict: "the textbook says LinkedList wins here. by index it loses 27 to 1: walking 50,000 nodes is far slower than System.arraycopy moving 50,000 references. it only wins if you were already standing at that spot with a ListIterator.",
  },
};

const fmt = (ns: number) => (ns >= 1000 ? `${(ns / 1000).toLocaleString("en-US", { maximumFractionDigits: ns >= 100000 ? 0 : 1 })} µs` : `${ns} ns`);

export function ListBench() {
  const [op, setOp] = useState("get");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, [op]);
  const o = OPS[op];
  const max = Math.max(...o.rows.map((r) => r.ns));
  const min = Math.min(...o.rows.map((r) => r.ns));
  const lo = Math.log10(min) - 0.3;
  const scale = (ns: number) => (Math.log10(ns) - lo) / (Math.log10(max) - lo);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Words options={Object.entries(OPS).map(([v, x]) => ({ v, label: x.label }))} value={op} onChange={setOp} label="operation" />
      <div className="text-11 text-faint">{o.unit} · log scale</div>
      <div className="grid gap-2.5">
        {o.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @container">
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-12">
              <span className="truncate text-ink">{r.label}</span>
              <span className="shrink-0 text-11 text-faint">big-O: {r.bigO}</span>
            </div>
            <span className="text-right text-12 text-hi tabular">{fmt(r.ns)}</span>
            <div className="col-span-2 h-[12px] bg-well-2">
              <div
                className="h-full transition-[width] duration-500 ease-jle"
                style={{ width: shown ? `${Math.max(1, scale(r.ns) * 100)}%` : "0%", background: r.tone ? `var(--${r.tone})` : "var(--ink)" }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {o.verdict}
      </p>
    </div>
  );
}
