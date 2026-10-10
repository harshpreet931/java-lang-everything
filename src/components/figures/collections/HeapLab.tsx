"use client";

import { useRef, useState } from "react";
import { Console, Row, useReducedMotion, useTimers, useWidth } from "./kit";

// PriorityQueue = a binary heap in an Object[]. children of i are 2i+1 and 2i+2, parent is
// (i-1) >>> 1. offer: put it at the end, sift up. poll: take [0], move the last to [0], sift down.
// same comparisons as PriorityQueue.siftUpComparable / siftDownComparable in jdk 25 (which move a
// "hole" instead of swapping, same result). drawn as swaps because that's easier to follow.

type Item = { id: number; v: number };
type Frame = { heap: Item[]; hot: number[]; done?: number; note: React.ReactNode; out?: number | null };

const MAX = 15;
const START = [5, 1, 4, 2, 3];

function offerFrames(heap: Item[], it: Item, less: (a: number, b: number) => boolean): Frame[] {
  const h = [...heap, it];
  let k = h.length - 1;
  const fr: Frame[] = [{ heap: [...h], hot: [k], note: <span className="say text-ink">{`${it.v} goes in the first free slot, index ${k}: the bottom of the tree.`}</span> }];
  while (k > 0) {
    const p = (k - 1) >>> 1;
    if (less(h[k].v, h[p].v)) {
      [h[k], h[p]] = [h[p], h[k]];
      fr.push({ heap: [...h], hot: [p, k], note: <span className="say text-ink">{`${h[p].v} beats its parent ${h[k].v} (index ${p} = (${k} - 1) >>> 1): swap, keep going up.`}</span> });
      k = p;
    } else {
      fr.push({ heap: [...h], hot: [k, p], done: k, note: <span className="say text-mute">{`${h[k].v} doesn't beat its parent ${h[p].v}. stop: every parent beats its children again.`}</span> });
      return fr;
    }
  }
  fr.push({ heap: [...h], hot: [0], done: 0, note: <span className="say text-mute">{`${h[0].v} reached the root. it's the new head of the queue.`}</span> });
  return fr;
}

function pollFrames(heap: Item[], less: (a: number, b: number) => boolean): Frame[] {
  const out = heap[0].v;
  if (heap.length === 1) return [{ heap: [], hot: [], out, note: <span className="say text-ink">{`poll() → ${out}. that was the only element.`}</span> }];
  const h = [...heap];
  const last = h.pop()!;
  h[0] = last;
  const fr: Frame[] = [
    { heap: [...heap], hot: [0], out, note: <span className="say text-ink">{`poll() returns the root, ${out}: the head is always at index 0.`}</span> },
    { heap: [...h], hot: [0], out, note: <span className="say text-ink">{`the last element, ${last.v}, moves into the hole at the root. now sift it down.`}</span> },
  ];
  let k = 0;
  const n = h.length;
  while (k < n >>> 1) {
    let c = 2 * k + 1;
    const r = c + 1;
    if (r < n && less(h[r].v, h[c].v)) c = r;
    if (less(h[c].v, h[k].v)) {
      [h[k], h[c]] = [h[c], h[k]];
      fr.push({ heap: [...h], hot: [k, c], out, note: <span className="say text-ink">{`the better child is ${h[k].v} (index ${c}), and it beats ${h[c].v}: swap, keep going down.`}</span> });
      k = c;
    } else {
      fr.push({ heap: [...h], hot: [k, c], done: k, out, note: <span className="say text-mute">{`${h[k].v} already beats its best child ${h[c].v}. stop.`}</span> });
      return fr;
    }
  }
  fr.push({ heap: [...h], hot: [k], done: k, out, note: <span className="say text-mute">{`${h[k].v} is a leaf now. done.`}</span> });
  return fr;
}

function build(vals: number[], less: (a: number, b: number) => boolean, from: number) {
  let h: Item[] = [];
  vals.forEach((v, i) => {
    const f = offerFrames(h, { id: from + i, v }, less);
    h = f[f.length - 1].heap;
  });
  return h;
}

export function HeapLab() {
  const [max, setMax] = useState(false);
  const less = (a: number, b: number) => (max ? a > b : a < b);
  const [heap, setHeap] = useState<Item[]>(() => build(START, (a, b) => a < b, 0));
  const [frame, setFrame] = useState<Frame | null>(null);
  const [polled, setPolled] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [val, setVal] = useState("0");
  const nextId = useRef(100);
  const t = useTimers();
  const reduce = useReducedMotion();
  const [wrap, width] = useWidth<HTMLDivElement>(700);

  const play = (frames: Frame[], end: Item[]) => {
    t.clear();
    if (reduce) {
      setFrame(frames[frames.length - 1]);
      setHeap(end);
      return;
    }
    setBusy(true);
    frames.forEach((f, i) => t.after(i * 650, () => setFrame(f)));
    t.after((frames.length - 1) * 650 + 50, () => {
      setHeap(end);
      setBusy(false);
    });
  };

  const offer = (v: number) => {
    if (heap.length >= MAX) return;
    const fr = offerFrames(heap, { id: nextId.current++, v }, less);
    play(fr, fr[fr.length - 1].heap);
  };
  const poll = () => {
    if (!heap.length) {
      setFrame({ heap: [], hot: [], note: <span className="say text-mute">poll() on an empty queue returns null (remove() would throw).</span> });
      return;
    }
    const fr = pollFrames(heap, less);
    setPolled((p) => [...p, heap[0].v].slice(-10));
    play(fr, fr[fr.length - 1].heap);
  };
  const setOrder = (m: boolean) => {
    t.clear();
    setBusy(false);
    setMax(m);
    setHeap(build(START, (a, b) => (m ? a > b : a < b), nextId.current));
    nextId.current += START.length;
    setFrame(null);
    setPolled([]);
  };

  const shown = frame?.heap ?? heap;
  const hot = frame?.hot ?? [];
  const n = shown.length;

  // tree geometry
  const narrow = width < 520;
  const W = narrow ? 340 : 640;
  const R = narrow ? 14 : 16;
  const levels = Math.max(3, Math.floor(Math.log2(Math.max(1, n))) + 1);
  const pos = (i: number) => {
    const L = Math.floor(Math.log2(i + 1));
    const j = i - (2 ** L - 1);
    return { x: ((j + 0.5) * W) / 2 ** L, y: 26 + L * 58 };
  };
  const H = 26 + (levels - 1) * 58 + 30;

  const sorted = [...shown].map((x) => x.v).sort((a, b) => (max ? b - a : a - b));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="order =">
          <button className="word" aria-pressed={!max} onClick={() => setOrder(false)}>
            min-heap (natural)
          </button>
          <button className="word" aria-pressed={max} onClick={() => setOrder(true)}>
            max-heap (reverseOrder)
          </button>
        </Row>
        <Row k="pq." last>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            onKeyDown={(e) => e.key === "Enter" && val && offer(Number(val))}
            className="mr-1 w-[4ch] border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
            inputMode="numeric"
            aria-label="value to offer"
          />
          <button className="act solid" onClick={() => offer(Number(val || 0))} disabled={busy || heap.length >= MAX}>
            offer({val || 0})
          </button>
          <button className="act" onClick={() => offer(Math.floor(Math.random() * 99))} disabled={busy || heap.length >= MAX}>
            offer(random)
          </button>
          <button className="act" onClick={poll} disabled={busy}>
            poll()
          </button>
        </Row>
      </div>

      <div ref={wrap} className="min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} fontFamily="var(--font-code)" className="block w-full" role="img" aria-label={`a binary heap with ${n} elements. root ${shown[0]?.v ?? "none"}`}>
          {shown.map((_, i) => {
            if (i === 0) return null;
            const a = pos((i - 1) >>> 1);
            const b = pos(i);
            return <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line-2)" />;
          })}
          {shown.map((it, i) => {
            const p = pos(i);
            const isHot = hot.includes(i);
            const isDone = frame?.done === i;
            return (
              <g key={it.id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: "transform 420ms var(--ease)" }}>
                <circle r={R} fill="var(--bg)" stroke={isDone ? "var(--live)" : isHot ? "var(--hot)" : "var(--line-2)"} strokeWidth={isHot || isDone ? 2 : 1} />
                <text y={4} textAnchor="middle" fontSize={narrow ? 11 : 12} fill={isDone ? "var(--live)" : isHot ? "var(--hot)" : "var(--hi)"}>
                  {it.v}
                </text>
                <text y={R + 11} textAnchor="middle" fontSize={8} fill="var(--faint)">
                  [{i}]
                </text>
              </g>
            );
          })}
          {!n && (
            <text x={W / 2} y={40} textAnchor="middle" fontSize={11} fill="var(--faint)">
              (empty)
            </text>
          )}
        </svg>
      </div>

      {/* the array it really is */}
      <div className="overflow-x-auto">
        <div className="mb-1.5 text-11 text-faint">Object[] queue · what toString() and the iterator walk, in this order</div>
        <div className="flex w-max">
          {Array.from({ length: Math.max(n, 6) }, (_, i) => {
            const it = shown[i];
            const isHot = hot.includes(i);
            return (
              <div key={i} className="flex w-[34px] flex-col items-center">
                <div
                  className="-ml-px flex h-[30px] w-full items-center justify-center text-13 tabular"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${isHot ? "var(--hot)" : "var(--line-2)"}`,
                    background: it ? "var(--bg)" : "transparent",
                    color: !it ? "var(--faint)" : isHot ? "var(--hot)" : "var(--hi)",
                    zIndex: isHot ? 1 : 0,
                  }}
                >
                  {it ? it.v : "·"}
                </div>
                <div className="mt-0.5 text-[9px] text-faint tabular">{i}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Console label="what PriorityQueue just did" minH="3.2em">
        {frame?.note ?? <span className="say text-faint">offer a number, or poll the head. each step takes a moment so you can follow it.</span>}
      </Console>

      <div className="grid gap-1 text-12 text-mute">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="text-faint">IO.println(pq) → </span>
          <span className="text-ink">[{shown.map((x) => x.v).join(", ")}]</span>
          <span className="ml-2 font-serif text-15">not sorted. just heap order.</span>
        </div>
        <div className="overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="text-faint">poll until empty → </span>
          <span className="text-live">{sorted.join(" ")}</span>
          {polled.length > 0 && (
            <span className="ml-3 text-faint">
              polled so far: <span className="text-ink">{polled.join(" ")}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
