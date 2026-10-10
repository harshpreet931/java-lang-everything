"use client";

import { useId, useState } from "react";
import { Console, Row, useReducedMotion, useTimers, useWidth } from "./kit";

// LinkedList as it really is: a header with first/last, and one Node object per element,
// each with item, next and prev. get(i) walks from whichever end is closer, exactly like
// LinkedList.node(int): index < size >> 1 ? walk from first : walk from last.

type N = { id: number; v: number };
const MAX = 6;

export function LinkedNodes() {
  const [nodes, setNodes] = useState<N[]>([
    { id: 1, v: 10 },
    { id: 2, v: 20 },
    { id: 3, v: 30 },
    { id: 4, v: 40 },
    { id: 5, v: 50 },
  ]);
  const [nextId, setNextId] = useState(6);
  const [pick, setPick] = useState(3);
  const [walk, setWalk] = useState<{ visited: number[]; found: number | null }>({ visited: [], found: null });
  const [fresh, setFresh] = useState<number | null>(null);
  const [ghost, setGhost] = useState<N | null>(null);
  const [log, setLog] = useState<React.ReactNode>(<span className="text-faint">pick an index and press get, or add and remove at the ends.</span>);
  const reduce = useReducedMotion();
  const t = useTimers();
  const [wrap, width] = useWidth<HTMLDivElement>(700);
  const narrow = width < 560;
  const uid = useId().replace(/:/g, "");
  const size = nodes.length;

  const clearMarks = () => {
    t.clear();
    setWalk({ visited: [], found: null });
    setFresh(null);
    setGhost(null);
  };

  const get = () => {
    if (!size) return;
    clearMarks();
    const i = Math.min(pick, size - 1);
    const fromFirst = i < size >> 1;
    const path: number[] = [];
    if (fromFirst) for (let k = 0; k <= i; k++) path.push(k);
    else for (let k = size - 1; k >= i; k--) path.push(k);
    const hops = path.length - 1;
    const done = () => {
      setWalk({ visited: path, found: i });
      setLog(
        <>
          <span className="text-faint">{`list.get(${i});  // → ${nodes[i].v}\n`}</span>
          <span className="say text-ink">
            {fromFirst
              ? `${i} < size >> 1 (${size >> 1}), so start at first and follow next ${hops} time${hops === 1 ? "" : "s"}.\n`
              : `${i} >= size >> 1 (${size >> 1}), so start at last and follow prev ${hops} time${hops === 1 ? "" : "s"}.\n`}
          </span>
          <span className="say text-mute">{`${hops} pointer hop${hops === 1 ? "" : "s"}, each one maybe a cache miss. O(n), even though it looks like an array index.`}</span>
        </>,
      );
    };
    if (reduce) return done();
    path.forEach((_, k) => t.after(k * 260, () => setWalk({ visited: path.slice(0, k + 1), found: null })));
    t.after(path.length * 260, done);
  };

  const addFirst = () => {
    clearMarks();
    const v = nodes.length ? nodes[0].v - 5 : 10;
    const n = { id: nextId, v };
    setNodes([n, ...nodes]);
    setNextId(nextId + 1);
    setFresh(n.id);
    setLog(
      <>
        <span className="text-faint">{`list.addFirst(${v});\n`}</span>
        <span className="text-ink">{size ? `Node n = new Node<>(null, ${v}, first);  first.prev = n;  first = n;\n` : `Node n = new Node<>(null, ${v}, null);  first = last = n;\n`}</span>
        <span className="say text-mute">one new 24-byte Node, two pointers rewired. O(1). nothing else moves.</span>
      </>,
    );
  };

  const addLast = () => {
    clearMarks();
    const v = nodes.length ? nodes[nodes.length - 1].v + 10 : 10;
    const n = { id: nextId, v };
    setNodes([...nodes, n]);
    setNextId(nextId + 1);
    setFresh(n.id);
    setLog(
      <>
        <span className="text-faint">{`list.addLast(${v});\n`}</span>
        <span className="text-ink">{size ? `Node n = new Node<>(last, ${v}, null);  last.next = n;  last = n;\n` : `Node n = new Node<>(null, ${v}, null);  first = last = n;\n`}</span>
        <span className="say text-mute">one new 24-byte Node, two pointers rewired. O(1).</span>
      </>,
    );
  };

  const removeFirst = () => {
    if (!size) return;
    clearMarks();
    const gone = nodes[0];
    setGhost(gone);
    setNodes(nodes.slice(1));
    setLog(
      <>
        <span className="text-faint">{`list.removeFirst();  // → ${gone.v}\n`}</span>
        <span className="text-ink">{size > 1 ? "first = first.next;  first.prev = null;\n" : "first = last = null;\n"}</span>
        <span className="say text-mute">the old node is unreachable now. garbage, for the GC to collect.</span>
      </>,
    );
    t.after(reduce ? 10 : 1100, () => setGhost(null));
  };

  const reset = () => {
    clearMarks();
    setNodes([1, 2, 3, 4, 5].map((id) => ({ id, v: id * 10 })));
    setNextId(6);
    setLog(<span className="text-faint">pick an index and press get, or add and remove at the ends.</span>);
  };

  // ---- geometry
  const W = narrow ? 168 : 96;
  const Hn = narrow ? 34 : 44;
  const gap = narrow ? 30 : 30;
  const head = { x: narrow ? 30 : 8, y: 8, w: narrow ? 168 : 196, h: 52 };
  const top = narrow ? head.y + head.h + 34 : head.y + head.h + 44;
  const show = ghost ? [ghost, ...nodes] : nodes;
  const pos = (k: number) => (narrow ? { x: 30, y: top + k * (Hn + gap) } : { x: 8 + k * (W + gap), y: top });
  const vbW = narrow ? 222 : Math.max(head.w + 20, 8 + MAX * (W + gap));
  const vbH = narrow ? top + Math.max(1, show.length) * (Hn + gap) - gap + 8 : top + Hn + 26;

  const ah = `ln-${uid}`;
  const ahDim = `lnd-${uid}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="list.">
          <button className="act solid" onClick={get} disabled={!size}>
            get({Math.min(pick, Math.max(0, size - 1))})
          </button>
          <button className="act" onClick={addFirst} disabled={size >= MAX}>
            addFirst
          </button>
          <button className="act" onClick={addLast} disabled={size >= MAX}>
            addLast
          </button>
          <button className="act" onClick={removeFirst} disabled={!size}>
            removeFirst
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </Row>
        <Row k="index =" last>
          {nodes.map((_, i) => (
            <button key={i} className="word" aria-pressed={Math.min(pick, size - 1) === i} onClick={() => setPick(i)}>
              {i}
            </button>
          ))}
        </Row>
      </div>

      <div ref={wrap} className="min-w-0">
        <svg fontFamily="var(--font-code)" viewBox={`0 0 ${vbW} ${vbH}`} className={`block w-full ${narrow ? "max-w-[320px]" : ""}`} role="img" aria-label={`a LinkedList with ${size} nodes, each linked to the next and the previous`}>
          <defs>
            <marker id={ah} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
            </marker>
            <marker id={ahDim} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--dead)" />
            </marker>
          </defs>

          {/* the LinkedList object itself */}
          <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
          <text x={head.x + 10} y={head.y + 17} fontSize={11} fill="var(--hi)">
            LinkedList
          </text>
          <text x={head.x + head.w - 10} y={head.y + 17} fontSize={11} fill="var(--mute)" textAnchor="end">
            size {size}
          </text>
          <text x={head.x + 10} y={head.y + 40} fontSize={11} fill="var(--mute)">
            first
          </text>
          <text x={head.x + head.w / 2 + 8} y={head.y + 40} fontSize={11} fill="var(--mute)">
            last
          </text>
          {(() => {
            const fx = head.x + 54;
            const lx = head.x + head.w / 2 + 48;
            const fy = head.y + 36;
            if (!nodes.length)
              return (
                <>
                  <text x={fx} y={fy + 4} fontSize={10} fill="var(--faint)">
                    null
                  </text>
                  <text x={lx} y={fy + 4} fontSize={10} fill="var(--faint)">
                    null
                  </text>
                </>
              );
            const off = ghost ? 1 : 0;
            const p0 = pos(off);
            const pl = pos(off + nodes.length - 1);
            return (
              <>
                <circle cx={fx} cy={fy} r={3.5} fill="var(--ref)" />
                <path d={`M${fx} ${fy} C ${fx} ${fy + 26}, ${p0.x + 30} ${p0.y - 24}, ${p0.x + 30} ${p0.y - 2}`} fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} style={{ transition: "d 300ms var(--ease)" }} />
                <circle cx={lx} cy={fy} r={3.5} fill="var(--ref)" />
                {narrow ? (
                  <path d={`M${lx} ${fy} C ${vbW - 4} ${fy}, ${vbW - 4} ${pl.y + Hn / 2}, ${pl.x + W + 2} ${pl.y + Hn / 2}`} fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} style={{ transition: "d 300ms var(--ease)" }} />
                ) : (
                  <path d={`M${lx} ${fy} C ${lx} ${fy + 26}, ${pl.x + W - 30} ${pl.y - 24}, ${pl.x + W - 30} ${pl.y - 2}`} fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} style={{ transition: "d 300ms var(--ease)" }} />
                )}
              </>
            );
          })()}

          {/* nodes */}
          {show.map((n, k) => {
            const p = pos(k);
            const isGhost = ghost?.id === n.id;
            const idx = ghost ? k - 1 : k;
            const visited = !isGhost && walk.visited.includes(idx);
            const found = !isGhost && walk.found === idx;
            const isFresh = fresh === n.id;
            const stroke = isGhost ? "var(--dead)" : found ? "var(--live)" : visited || isFresh ? "var(--hot)" : "var(--line-2)";
            const hasPrev = k > 0 && !(ghost && k === 1);
            const hasNext = k < show.length - 1 && !isGhost;
            const cy = p.y + Hn / 2;
            const prevX = p.x + 11;
            const nextX = p.x + W - 11;
            return (
              <g key={n.id} style={{ opacity: isGhost ? 0.55 : 1, transition: "opacity 200ms var(--ease)" }} className={isFresh ? "obj-in" : ""}>
                <rect x={p.x} y={p.y} width={W} height={Hn} rx={2} fill="var(--bg)" stroke={stroke} strokeWidth={visited || found || isFresh ? 1.5 : 1} />
                <line x1={p.x + 22} y1={p.y} x2={p.x + 22} y2={p.y + Hn} stroke="var(--line)" />
                <line x1={p.x + W - 22} y1={p.y} x2={p.x + W - 22} y2={p.y + Hn} stroke="var(--line)" />
                <text x={p.x + W / 2} y={cy + 4} textAnchor="middle" fontSize={12} fill={isGhost ? "var(--dead)" : found ? "var(--live)" : "var(--hi)"}>
                  {n.v}
                </text>
                {/* prev */}
                {hasPrev ? <circle cx={prevX} cy={narrow ? cy : cy + 7} r={3} fill="var(--ref)" /> : <text x={prevX} y={cy + 3} textAnchor="middle" fontSize={8} fill="var(--faint)">∅</text>}
                {/* next */}
                {hasNext ? <circle cx={nextX} cy={narrow ? cy : cy - 7} r={3} fill="var(--ref)" /> : <text x={nextX} y={cy + 3} textAnchor="middle" fontSize={8} fill="var(--faint)">∅</text>}
                {isGhost && (
                  <text x={p.x + W / 2} y={narrow ? p.y - 6 : p.y + Hn + 13} textAnchor="middle" fontSize={9} fill="var(--dead)">
                    unreachable
                  </text>
                )}
                {/* arrows to the neighbour */}
                {hasNext &&
                  (() => {
                    const q = pos(k + 1);
                    return narrow ? (
                      <path d={`M${nextX} ${cy} L${q.x + W - 11} ${q.y - 1}`} stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
                    ) : (
                      <path d={`M${nextX} ${cy - 7} L${q.x - 1} ${cy - 7}`} stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
                    );
                  })()}
                {hasPrev &&
                  (() => {
                    const q = pos(k - 1);
                    return narrow ? (
                      <path d={`M${prevX} ${cy} L${q.x + 11} ${q.y + Hn + 1}`} stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
                    ) : (
                      <path d={`M${prevX} ${cy + 7} L${q.x + W + 1} ${cy + 7}`} stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#${ah})`} />
                    );
                  })()}
                {!narrow && !isGhost && (
                  <text x={p.x + W / 2} y={p.y + Hn + 14} textAnchor="middle" fontSize={9} fill="var(--faint)">
                    [{idx}]
                  </text>
                )}
                {narrow && !isGhost && (
                  <text x={p.x - 6} y={cy + 3} fontSize={9} textAnchor="end" fill="var(--faint)">
                    [{idx}]
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="-mt-2 text-11 text-faint">
        each node: <span className="text-mute">[ prev <span className="text-ref">●</span> | item | next <span className="text-ref">●</span> ]</span> · ∅ = null
      </div>
      <Console label="what LinkedList just did">{log}</Console>
      <div className="font-serif text-16 text-mute">
        memory: <span className="text-hi tabular">{size * 24} bytes</span> of Node objects for {size} elements (24 each: 12 header + 3 references), before counting the elements themselves.
        an <code>ArrayDeque</code> holding the same {size} needs about {Math.max(1, size) * 4} bytes of array slots.
      </div>
    </div>
  );
}
