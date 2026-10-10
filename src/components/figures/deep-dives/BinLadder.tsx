"use client";

import { useState } from "react";
import { Row } from "./kit";

// keys whose hashCode() is always 42 (and that are Comparable), put one by one into a
// default HashMap on jdk 25. table length and bin type read back with reflection:
//   1..8 keys: Node[16], list   9: Node[32], list   10: Node[64], list   11, 12: TreeNode
// tree shapes are the real red-black trees for k1..k11 and k1..k12 (walked via left/right/red).
// sizes from a class histogram: HashMap$Node 32 bytes, HashMap$TreeNode 56 bytes.

type T = [string, boolean, T | null, T | null]; // key, red, left, right

const b = (k: string, l: T | null = null, r: T | null = null): T => [k, false, l, r];
const r = (k: string, l: T | null = null, rr: T | null = null): T => [k, true, l, rr];

const TREE11: T = b("k4", b("k2", b("k1"), b("k3")), b("k6", b("k5"), r("k8", b("k7"), b("k10", r("k9"), r("k11")))));
const TREE12: T = b("k4", b("k2", b("k1"), b("k3")), b("k8", r("k6", b("k5"), b("k7")), r("k10", b("k9"), b("k11", null, r("k12")))));

const NOTES: Record<number, string> = {
  1: "one key, hash 42. 42 & 15 = 10, so it goes in bin 10.",
  2: "same hash, same bin. putVal walks the chain (hash first, then equals) and appends at the tail.",
  3: "still appending at the tail. every lookup in this bin is a walk now.",
  4: "a list of 4. with decent hashCodes that's rare: the comment in the source estimates about 0.16% of bins ever hold 4.",
  5: "the chain grows. nothing else happens until it's long enough.",
  6: "6 nodes. remember this number, it comes back when the tree shrinks.",
  7: "7 nodes. putVal counts the chain as it walks it (binCount).",
  8: "8 nodes, which is TREEIFY_THRESHOLD. the next append is the one that checks it.",
  9: "the 9th append reached the threshold and called treeifyBin. but 16 < MIN_TREEIFY_CAPACITY (64), so it resized to 32 instead. 42 & 31 is still 10.",
  10: "threshold again, table still under 64: resize to 64. now 42 & 63 = 42, a new bin. still a plain list of 10.",
  11: "table is 64 now, so treeifyBin goes through: every Node is replaced by a TreeNode and the bin becomes a red-black tree, ordered by hash, then compareTo.",
  12: "a normal tree insert. lookups in this bin are O(log n) now, even though every key has the same hash.",
};

export function BinLadder() {
  const [n, setN] = useState(8);
  const table = n <= 8 ? 16 : n === 9 ? 32 : 64;
  const tree = n >= 11;
  const bin = 42 & (table - 1);
  const keys = Array.from({ length: n }, (_, i) => `k${i + 1}`);

  return (
    <div className="@container text-13">
      <Row k="keys =" w="9ch">
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={1}
            max={12}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            aria-label="number of keys with the same hash"
          />
          <span className="w-[4ch] text-right text-hi tabular">{n}</span>
        </div>
      </Row>
      <Row k="table =" w="9ch">
        <span className={n === 9 || n === 10 ? "text-hot" : "text-hi"}>Node[{table}]</span>
        <span className="text-faint"> · bin {bin}</span>
      </Row>
      <Row k="bin =" w="9ch" last>
        <span className={tree ? "text-hot" : "text-hi"}>{tree ? "TreeNode, red-black tree" : "Node, linked list"}</span>
        <span className="text-faint"> · {tree ? "56" : "32"} bytes per node</span>
      </Row>

      <div className="mt-3 flex min-h-[230px] items-center justify-center border-t border-line pt-5">
        {tree ? <TreeView t={n === 11 ? TREE11 : TREE12} count={n} /> : <ListView keys={keys} />}
      </div>

      <p className="mt-3 min-h-[3.3em] font-serif text-[1.02rem] leading-[1.6] text-ink" aria-live="polite">
        {NOTES[n]}
      </p>
      {tree && <div className="text-11 text-faint">dashed = red node, solid = black node (red-black tree colours, nothing to do with this site&apos;s).</div>}
    </div>
  );
}

function ListView({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-3" role="img" aria-label={`a linked list of ${keys.length} nodes`}>
      {keys.map((k, i) => (
        <span key={k} className="flex items-center">
          <span
            className="obj-in flex h-8 min-w-[42px] items-center justify-center rounded-md bg-bg px-2 text-12 tabular"
            style={{
              boxShadow: `inset 0 0 0 1px ${i === keys.length - 1 ? "var(--hot)" : "var(--line-2)"}`,
              color: i === keys.length - 1 ? "var(--hot)" : "var(--hi)",
            }}
          >
            {k}
          </span>
          {i < keys.length - 1 && <span className="px-1 text-12 text-ref">→</span>}
        </span>
      ))}
      <span className="ml-1 text-11 text-faint">next = null</span>
    </div>
  );
}

function TreeView({ t, count }: { t: T; count: number }) {
  // x by in-order position (keys are ordered), y by depth
  type P = { k: string; red: boolean; x: number; y: number; parent?: P };
  const pos: P[] = [];
  let idx = 0;
  const walk = (node: T | null, d: number, parent?: P) => {
    if (!node) return;
    const [k, red, l, rr] = node;
    const me: P = { k, red, x: 0, y: d, parent };
    walk(l, d + 1, me);
    me.x = idx++;
    pos.push(me);
    walk(rr, d + 1, me);
  };
  walk(t, 0);
  const W = 30;
  const H = 42;
  const X = (i: number) => 18 + i * W;
  const Y = (d: number) => 18 + d * H;
  const width = X(count - 1) + 18;
  return (
    <svg viewBox={`0 0 ${width} ${Y(4) + 18}`} className="block w-full max-w-[460px]" role="img" aria-label={`a red-black tree of ${count} nodes`}>
      {pos.map(
        (p) =>
          p.parent && (
            <line key={`e-${p.k}`} x1={X(p.parent.x)} y1={Y(p.parent.y)} x2={X(p.x)} y2={Y(p.y)} stroke="var(--ref)" strokeWidth={1} opacity={0.75} />
          ),
      )}
      {pos.map((p) => (
        <g key={p.k} className="obj-in">
          <circle
            cx={X(p.x)}
            cy={Y(p.y)}
            r={12}
            fill={p.red ? "var(--well-2)" : "var(--bg)"}
            stroke={p.k === `k${count}` ? "var(--hot)" : p.red ? "var(--mute)" : "var(--ink)"}
            strokeWidth={p.k === `k${count}` ? 1.5 : 1}
            strokeDasharray={p.red ? "3 2" : undefined}
          />
          <text x={X(p.x)} y={Y(p.y) + 3.5} fontSize={10} textAnchor="middle" fill="var(--hi)" fontFamily="var(--font-code)">
            {p.k}
          </text>
        </g>
      ))}
    </svg>
  );
}
