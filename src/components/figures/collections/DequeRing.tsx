"use client";

import { useId, useState } from "react";
import { Console, Row, useWidth } from "./kit";

// ArrayDeque, run by the jdk 25 rules (ArrayDeque.java):
//   new ArrayDeque<>(7) → elements = new Object[7 + 1]  (one slot is always kept free)
//   addFirst: es[head = dec(head)] = e;  if (head == tail) grow(1)
//   addLast:  es[tail] = e; tail = inc(tail);  if (head == tail) grow(1)
//   pollFirst: e = es[head]; es[head] = null; head = inc(head)
//   pollLast:  t = dec(tail); e = es[t]; es[tail = t] = null
//   grow: jump = cap < 64 ? cap + 2 : cap >> 1. if the contents wrap, slide the first leg
//         (head .. old end) to the end of the new array.

type S = { es: (number | null)[]; head: number; tail: number; next: number };
const INIT: S = { es: Array(8).fill(null), head: 0, tail: 0, next: 1 };
const MAX_CAP = 18;

const inc = (i: number, m: number) => (i + 1 >= m ? 0 : i + 1);
const dec = (i: number, m: number) => (i - 1 < 0 ? m - 1 : i - 1);

function grow(s: S): { s: S; moved: number[]; from: number } {
  const old = s.es.length;
  const jump = old < 64 ? old + 2 : old >> 1;
  const cap = old + jump;
  const es = [...s.es, ...Array(cap - old).fill(null)];
  let head = s.head;
  const moved: number[] = [];
  if (s.tail < head || (s.tail === head && es[head] !== null)) {
    const space = cap - old;
    const leg = es.slice(head, old);
    for (let i = 0; i < leg.length; i++) {
      es[head + space + i] = leg[i];
      moved.push(head + space + i);
    }
    for (let i = head; i < head + space; i++) es[i] = null;
    head += space;
  }
  return { s: { ...s, es, head }, moved, from: old };
}

export function DequeRing() {
  const [s, setS] = useState<S>(INIT);
  const [hot, setHot] = useState<number[]>([]);
  const [log, setLog] = useState<React.ReactNode>(
    <span className="text-faint">{"Deque<Integer> dq = new ArrayDeque<>(7);  // Object[8], head = tail = 0"}</span>,
  );
  const uid = useId().replace(/:/g, "");
  const [wrap, width] = useWidth<HTMLDivElement>(700);
  const side = width >= 600;
  const n = s.es.length;
  const size = (s.tail - s.head + n) % n;
  const full = n >= MAX_CAP && size >= n - 1;

  const order: number[] = [];
  for (let i = s.head, k = 0; k < size; i = inc(i, n), k++) order.push(s.es[i] as number);

  const finish = (next: S, changed: number, what: React.ReactNode) => {
    if (next.head === next.tail) {
      const g = grow(next);
      setS(g.s);
      setHot(g.moved.length ? g.moved : [changed]);
      setLog(
        <>
          {what}
          <span className="text-hot">{`head == tail: full. grow: ${g.from} + (${g.from} + 2) = ${g.s.es.length} slots.\n`}</span>
          <span className="say text-mute">
            {g.moved.length
              ? `the contents wrapped, so the first leg (${g.moved.length} element${g.moved.length === 1 ? "" : "s"}) slides to the end of the new array. head = ${g.s.head}.`
              : "nothing wrapped, so the copy is all it takes."}
          </span>
        </>,
      );
      return;
    }
    setS(next);
    setHot([changed]);
    setLog(what);
  };

  const addFirst = () => {
    const es = [...s.es];
    const head = dec(s.head, n);
    es[head] = s.next;
    finish(
      { ...s, es, head, next: s.next + 1 },
      head,
      <>
        <span className="text-faint">{`dq.addFirst(${s.next});\n`}</span>
        <span className="text-ink">{`head = dec(${s.head}) = ${head};  es[${head}] = ${s.next};\n`}</span>
        {s.head === 0 && <span className="say text-mute">{`head was 0, so it wrapped round to ${n - 1}. no shifting, ever.\n`}</span>}
      </>,
    );
  };

  const addLast = () => {
    const es = [...s.es];
    es[s.tail] = s.next;
    const tail = inc(s.tail, n);
    finish(
      { ...s, es, tail, next: s.next + 1 },
      s.tail,
      <>
        <span className="text-faint">{`dq.addLast(${s.next});\n`}</span>
        <span className="text-ink">{`es[${s.tail}] = ${s.next};  tail = inc(${s.tail}) = ${tail};\n`}</span>
        {tail === 0 && <span className="say text-mute">tail fell off the end and wrapped to 0.{"\n"}</span>}
      </>,
    );
  };

  const pollFirst = () => {
    if (!size) {
      setLog(<span className="text-faint">{"dq.pollFirst();  // → null. empty deques return null from poll (removeFirst would throw)."}</span>);
      return;
    }
    const es = [...s.es];
    const v = es[s.head];
    es[s.head] = null;
    const head = inc(s.head, n);
    setS({ ...s, es, head });
    setHot([s.head]);
    setLog(
      <>
        <span className="text-faint">{`dq.pollFirst();  // → ${v}\n`}</span>
        <span className="text-ink">{`es[${s.head}] = null;  head = inc(${s.head}) = ${head};`}</span>
      </>,
    );
  };

  const pollLast = () => {
    if (!size) {
      setLog(<span className="text-faint">{"dq.pollLast();  // → null"}</span>);
      return;
    }
    const es = [...s.es];
    const t = dec(s.tail, n);
    const v = es[t];
    es[t] = null;
    setS({ ...s, es, tail: t });
    setHot([t]);
    setLog(
      <>
        <span className="text-faint">{`dq.pollLast();  // → ${v}\n`}</span>
        <span className="text-ink">{`tail = dec(${s.tail}) = ${t};  es[${t}] = null;`}</span>
      </>,
    );
  };

  const reset = () => {
    setS(INIT);
    setHot([]);
    setLog(<span className="text-faint">{"Deque<Integer> dq = new ArrayDeque<>(7);  // Object[8], head = tail = 0"}</span>);
  };

  // ---- ring geometry
  const C = 150;
  const r1 = 78;
  const r2 = 116;
  const ang = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  // rounded so the server and the browser print the exact same numbers (hydration)
  const pt = (a: number, r: number) => [Math.round((C + Math.cos(a) * r) * 100) / 100, Math.round((C + Math.sin(a) * r) * 100) / 100] as const;
  const sector = (i: number) => {
    const a0 = ang(i) + 0.012;
    const a1 = ang(i + 1) - 0.012;
    const [x0, y0] = pt(a0, r2);
    const [x1, y1] = pt(a1, r2);
    const [x2, y2] = pt(a1, r1);
    const [x3, y3] = pt(a0, r1);
    return `M${x0} ${y0} A ${r2} ${r2} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${r1} ${r1} 0 0 0 ${x3} ${y3} Z`;
  };
  const marker = (i: number, label: string, nudge: number) => {
    const a = ang(i + 0.5) + nudge;
    const [ax, ay] = pt(a, r2 + 4);
    const [bx, by] = pt(a, r2 + 20);
    const [tx, ty] = pt(a, r2 + 31);
    return (
      <g key={label}>
        <line x1={bx} y1={by} x2={ax} y2={ay} stroke="var(--ref)" strokeWidth={1.5} markerEnd={`url(#dr-${uid})`} />
        <text x={tx} y={ty + 4} textAnchor="middle" fontSize={11} fill="var(--ref)">
          {label}
        </text>
      </g>
    );
  };
  const same = s.head === s.tail;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="dq.">
          <button className="act" onClick={addFirst} disabled={full}>
            addFirst({s.next})
          </button>
          <button className="act solid" onClick={addLast} disabled={full}>
            addLast({s.next})
          </button>
          <button className="act" onClick={pollFirst}>
            pollFirst()
          </button>
          <button className="act" onClick={pollLast}>
            pollLast()
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </Row>
        <Row k="state =" last>
          <span className="tabular text-mute">
            head <span className="text-ref">{s.head}</span>
            <span className="text-faint"> · </span>
            tail <span className="text-ref">{s.tail}</span>
            <span className="text-faint"> · </span>
            size <span className="text-hi">{size}</span>
            <span className="text-faint"> · </span>
            slots <span className="text-hi">{n}</span>
          </span>
        </Row>
      </div>

      <div ref={wrap} className={`grid items-center gap-6 ${side ? "grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
        <svg fontFamily="var(--font-code)" viewBox="-36 -14 372 328" className={`block w-full ${side ? "" : "mx-auto max-w-[320px]"}`} role="img" aria-label={`a ring of ${n} slots. head at ${s.head}, tail at ${s.tail}, holding ${size} elements`}>
          <defs>
            <marker id={`dr-${uid}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
            </marker>
          </defs>
          {s.es.map((v, i) => {
            const isHot = hot.includes(i);
            const [tx, ty] = pt(ang(i + 0.5), (r1 + r2) / 2);
            const [ix, iy] = pt(ang(i + 0.5), r1 - 11);
            return (
              <g key={i}>
                <path
                  d={sector(i)}
                  fill={isHot ? "color-mix(in srgb, var(--hot) 14%, var(--bg))" : "var(--bg)"}
                  stroke={isHot ? "var(--hot)" : v === null ? "var(--line)" : "var(--line-2)"}
                  style={{ transition: "fill 200ms var(--ease), stroke 200ms var(--ease)" }}
                />
                <text x={tx} y={ty + 4} textAnchor="middle" fontSize={n > 12 ? 11 : 13} fill={v === null ? "var(--faint)" : isHot ? "var(--hot)" : "var(--hi)"}>
                  {v === null ? "·" : v}
                </text>
                <text x={ix} y={iy + 3} textAnchor="middle" fontSize={8} fill="var(--faint)">
                  {i}
                </text>
              </g>
            );
          })}
          {marker(s.head, "head", same ? -0.11 : 0)}
          {marker(s.tail, "tail", same ? 0.11 : 0)}
          <text x={C} y={C - 4} textAnchor="middle" fontSize={11} fill="var(--mute)">
            Object[{n}]
          </text>
          <text x={C} y={C + 12} textAnchor="middle" fontSize={10} fill="var(--faint)">
            {size} in use
          </text>
        </svg>

        <div className="grid min-w-0 gap-4">
          <Console label="what ArrayDeque just did" minH="5.6em">
            {log}
          </Console>
          <div className="text-12 text-mute">
            <span className="text-faint">front → back: </span>
            <span className="text-hi tabular">[{order.join(", ")}]</span>
          </div>
        </div>
      </div>

      {/* the same thing, as the flat array it really is */}
      <div className="overflow-x-auto">
        <div className="mb-1.5 text-11 text-faint">the same array, unrolled. this is what&apos;s actually in memory.</div>
        <div className="grid w-max" style={{ gridTemplateColumns: `repeat(${n}, ${Math.max(16, Math.min(n > 12 ? 24 : 34, Math.floor(width / n)))}px)` }}>
          {s.es.map((v, i) => {
            const isHot = hot.includes(i);
            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="-ml-px flex h-[30px] w-full items-center justify-center text-12 tabular"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${isHot ? "var(--hot)" : "var(--line-2)"}`,
                    color: v === null ? "var(--faint)" : isHot ? "var(--hot)" : "var(--hi)",
                    zIndex: isHot ? 1 : 0,
                  }}
                >
                  {v === null ? "·" : v}
                </div>
                <div className="mt-0.5 text-[9px] leading-3 text-faint tabular">{i}</div>
                <div className="h-4 text-[10px] leading-4 text-ref">{i === s.head ? "h" : ""}{i === s.tail ? (i === s.head ? "t" : "t") : ""}</div>
              </div>
            );
          })}
        </div>
        <div className="text-11 text-faint">
          <span className="text-ref">h</span> head (first element) · <span className="text-ref">t</span> tail (the next free slot at the back)
        </div>
      </div>
    </div>
  );
}
