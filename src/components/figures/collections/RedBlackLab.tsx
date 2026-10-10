"use client";

import { useEffect, useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, useWidth } from "./kit";

// TreeMap's insertion, step by step. the fix-up is a straight port of
// TreeMap.fixAfterInsertion (jdk 25, "from CLR"): recolor when the uncle is red,
// otherwise rotate (twice if the new node is an inner child).
//
// colour note: "red" nodes are drawn in the tan accent, not var(--dead). on this site
// red means a bug, and a red node is not a bug.

type N = { key: number; red: boolean; left: N | null; right: N | null; parent: N | null };
type Snap = { key: number; red: boolean; left: Snap | null; right: Snap | null };
type Step = { tree: Snap | null; note: string; hot: number[]; kind: "insert" | "recolor" | "rotate" | "root" | "dup" | "start" };

const snapOf = (n: N | null): Snap | null => (n ? { key: n.key, red: n.red, left: snapOf(n.left), right: snapOf(n.right) } : null);

class Tree {
  root: N | null = null;
  out: Step[] = [];
  private snap(note: string, hot: number[], kind: Step["kind"]) {
    this.out.push({ tree: snapOf(this.root), note, hot, kind });
  }
  private rotateLeft(p: N) {
    const r = p.right!;
    p.right = r.left;
    if (r.left) r.left.parent = p;
    r.parent = p.parent;
    if (!p.parent) this.root = r;
    else if (p.parent.left === p) p.parent.left = r;
    else p.parent.right = r;
    r.left = p;
    p.parent = r;
  }
  private rotateRight(p: N) {
    const l = p.left!;
    p.left = l.right;
    if (l.right) l.right.parent = p;
    l.parent = p.parent;
    if (!p.parent) this.root = l;
    else if (p.parent.right === p) p.parent.right = l;
    else p.parent.left = l;
    l.right = p;
    p.parent = l;
  }
  insert(k: number) {
    if (!this.root) {
      this.root = { key: k, red: false, left: null, right: null, parent: null };
      this.snap(`empty tree: ${k} becomes the root. the root is always black.`, [k], "insert");
      return;
    }
    let t: N | null = this.root;
    let parent = t;
    const path: number[] = [];
    let goLeft = false;
    while (t) {
      path.push(t.key);
      parent = t;
      if (k < t.key) {
        goLeft = true;
        t = t.left;
      } else if (k > t.key) {
        goLeft = false;
        t = t.right;
      } else {
        this.snap(`${k} is already in the tree. a TreeMap just replaces the value. no new node, nothing to fix.`, [k], "dup");
        return;
      }
    }
    const e: N = { key: k, red: true, left: null, right: null, parent };
    if (goLeft) parent.left = e;
    else parent.right = e;
    this.snap(
      `compare and walk down: ${path.join(" → ")}. ${k} hangs ${goLeft ? "left" : "right"} of ${parent.key}. a new node is red.${parent.red ? ` but ${parent.key} is red too: two reds in a row isn't allowed.` : ` its parent is black, so nothing is broken.`}`,
      [k],
      "insert",
    );
    this.fix(e);
  }
  private fix(x0: N) {
    let x: N | null = x0;
    while (x && x !== this.root && x.parent!.red) {
      const p: N = x.parent!;
      const g: N = p.parent!;
      const leftSide = p === g.left;
      const y = leftSide ? g.right : g.left;
      if (y && y.red) {
        p.red = false;
        y.red = false;
        g.red = true;
        this.snap(
          `${x.key}'s parent ${p.key} and its uncle ${y.key} are both red: recolor. ${p.key} and ${y.key} turn black, grandparent ${g.key} turns red. then look again from ${g.key}.`,
          [p.key, y.key, g.key],
          "recolor",
        );
        x = g;
      } else {
        const inner = leftSide ? x === p.right : x === p.left;
        if (inner) {
          const was = x.key;
          x = p;
          if (leftSide) this.rotateLeft(x);
          else this.rotateRight(x);
          this.snap(
            `red parent ${p.key}, ${y ? `black uncle ${y.key}` : "no uncle (counts as black)"}, and ${was} is an inner child (a zig-zag). rotate ${leftSide ? "left" : "right"} at ${p.key} to straighten it into a line.`,
            [was, p.key],
            "rotate",
          );
        }
        const pp = x.parent!;
        const gg = pp.parent!;
        pp.red = false;
        gg.red = true;
        if (leftSide) this.rotateRight(gg);
        else this.rotateLeft(gg);
        this.snap(
          `a straight line of reds: ${pp.key} turns black, ${gg.key} turns red, and rotate ${leftSide ? "right" : "left"} at ${gg.key}. ${pp.key} moves up and the subtree is balanced.`,
          [pp.key, gg.key],
          "rotate",
        );
      }
    }
    if (this.root!.red) {
      this.root!.red = false;
      this.snap(`the root ended up red. the last rule: the root is always black.`, [this.root!.key], "root");
    }
  }
}

const height = (t: Snap | null): number => (t ? 1 + Math.max(height(t.left), height(t.right)) : 0);
const count = (t: Snap | null): number => (t ? 1 + count(t.left) + count(t.right) : 0);

function bstHeight(keys: number[]) {
  type B = { k: number; l: B | null; r: B | null };
  let root: B | null = null;
  for (const k of keys) {
    if (!root) {
      root = { k, l: null, r: null };
      continue;
    }
    let t: B = root;
    for (;;) {
      if (k === t.k) break;
      if (k < t.k) {
        if (!t.l) {
          t.l = { k, l: null, r: null };
          break;
        }
        t = t.l;
      } else {
        if (!t.r) {
          t.r = { k, l: null, r: null };
          break;
        }
        t = t.r;
      }
    }
  }
  const h = (b: B | null): number => (b ? 1 + Math.max(h(b.l), h(b.r)) : 0);
  return h(root);
}

const PRESETS: { label: string; keys: number[] }[] = [
  { label: "10 20 30 15 25 5 1", keys: [10, 20, 30, 15, 25, 5, 1] },
  { label: "1 to 12, in order", keys: Array.from({ length: 12 }, (_, i) => i + 1) },
];
const MAX = 15;

function build(keys: number[]) {
  const t = new Tree();
  const starts: number[] = [];
  t.out.push({ tree: null, note: "an empty TreeMap. press step to insert the first key.", hot: [], kind: "start" });
  for (const k of keys) {
    starts.push(t.out.length);
    t.insert(k);
  }
  return { steps: t.out, starts };
}

export function RedBlackLab() {
  const [keys, setKeys] = useState<number[]>(PRESETS[0].keys);
  const [text, setText] = useState("");
  const { steps, starts } = useMemo(() => build(keys), [keys]);
  const s = useStepper(steps.length, { interval: 1500 });
  const [jump, setJump] = useState<number | null>(null);
  const [wrap, width] = useWidth<HTMLDivElement>(720);

  useEffect(() => {
    if (jump !== null) {
      s.go(jump);
      setJump(null);
    }
  }, [jump, s]);

  const step = steps[s.i];
  // which keys have been inserted by this step
  const doneKeys = keys.filter((_, j) => starts[j] <= s.i);
  const n = count(step.tree);
  const h = height(step.tree);
  const plain = bstHeight(doneKeys);

  const load = (k: number[]) => {
    setKeys(k);
    setJump(0);
  };
  const add = () => {
    const v = parseInt(text, 10);
    if (Number.isNaN(v) || keys.length >= MAX) return;
    const next = [...keys, Math.max(-99, Math.min(999, v))];
    setKeys(next);
    setText("");
    setJump(build(next).starts[next.length - 1]);
  };

  // ---- layout: x by in-order rank, y by depth
  const pos: Record<number, { x: number; y: number }> = {};
  const edges: { a: number; b: number }[] = [];
  let rank = 0;
  const walk = (t: Snap | null, d: number) => {
    if (!t) return;
    walk(t.left, d + 1);
    pos[t.key] = { x: rank++, y: d };
    walk(t.right, d + 1);
    if (t.left) edges.push({ a: t.key, b: t.left.key });
    if (t.right) edges.push({ a: t.key, b: t.right.key });
  };
  walk(step.tree, 0);
  const narrow = width < 520;
  const R = narrow ? 13 : 15;
  const gapX = narrow ? 30 : 40;
  const vbW = Math.max(narrow ? 320 : 560, (n + 1) * gapX);
  const gapY = narrow ? 50 : 58;
  const vbH = Math.max(4, h) * gapY + 18;
  const X = (r: number) => ((r + 1) * vbW) / (n + 1);
  const Y = (d: number) => 26 + d * gapY;
  const nodes: { key: number; red: boolean }[] = [];
  const collect = (t: Snap | null) => {
    if (!t) return;
    nodes.push({ key: t.key, red: t.red });
    collect(t.left);
    collect(t.right);
  };
  collect(step.tree);
  nodes.sort((a, b) => a.key - b.key);

  const kindLabel: Record<Step["kind"], string> = {
    start: "",
    insert: "insert",
    recolor: "recolor",
    rotate: "rotate",
    root: "root rule",
    dup: "duplicate",
  };

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-5 outline-none" aria-label="red-black tree insertion, step by step">
      <div className="text-13">
        <Row k="insert =">
          {PRESETS.map((p) => (
            <button key={p.label} className="word" aria-pressed={keys.join() === p.keys.join()} onClick={() => load(p.keys)}>
              {p.label}
            </button>
          ))}
        </Row>
        <Row k="+ key =" last>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9-]/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="mr-2 w-[7ch] border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
            inputMode="numeric"
            aria-label="a key to insert"
            placeholder="17"
          />
          <button className="act" onClick={add} disabled={!text || keys.length >= MAX}>
            put
          </button>
          <span className="ml-2 text-11 text-faint">appends to the sequence ({keys.length}/{MAX})</span>
        </Row>
      </div>

      <div ref={wrap} className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-11 text-faint">
          <span>
            <span className="inline-block size-[9px] translate-y-px rounded-full" style={{ background: "var(--hi)" }} /> black
          </span>
          <span>
            <span className="inline-block size-[9px] translate-y-px rounded-full" style={{ background: "var(--accent)" }} /> red (drawn tan)
          </span>
          <span>
            <span className="inline-block size-[9px] translate-y-px rounded-full shadow-[inset_0_0_0_2px_var(--hot)]" /> just changed
          </span>
        </div>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} fontFamily="var(--font-code)" className="block w-full" role="img" aria-label={`a red-black tree with ${n} nodes, height ${h}`}>
          {edges.map((e) => {
            const a = pos[e.a];
            const b = pos[e.b];
            return (
              <path
                key={`${e.a}-${e.b}`}
                d={`M${X(a.x)} ${Y(a.y)} L${X(b.x)} ${Y(b.y)}`}
                stroke="var(--line-2)"
                strokeWidth={1.25}
                style={{ transition: "d 360ms var(--ease)" }}
              />
            );
          })}
          {nodes.map((nd) => {
            const p = pos[nd.key];
            const isHot = step.hot.includes(nd.key);
            return (
              <g key={nd.key} style={{ transform: `translate(${X(p.x)}px, ${Y(p.y)}px)`, transition: "transform 360ms var(--ease)" }}>
                {isHot && <circle r={R + 4} fill="none" stroke="var(--hot)" strokeWidth={2} />}
                <circle r={R} fill={nd.red ? "var(--accent)" : "var(--hi)"} style={{ transition: "fill 250ms var(--ease)" }} />
                <text y={4} textAnchor="middle" fontSize={narrow ? 10 : 11} fill="var(--bg)">
                  {nd.key}
                </text>
              </g>
            );
          })}
          {!n && (
            <text x={vbW / 2} y={40} textAnchor="middle" fontSize={11} fill="var(--faint)">
              (empty)
            </text>
          )}
        </svg>
      </div>

      <div className="grid gap-3">
        <p className="min-h-[3.4em] font-serif text-16 leading-[1.55] text-ink" aria-live="polite">
          {kindLabel[step.kind] && <span className="mr-2 font-mono text-11 text-hot">{kindLabel[step.kind]}</span>}
          {step.note}
        </p>
        <div className="text-12 text-mute tabular">
          nodes <span className="text-hi">{n}</span>
          <span className="text-faint"> · </span>
          height <span className="text-hi">{h}</span>
          <span className="text-faint"> · </span>a plain BST with the same inserts: <span className={plain > h ? "text-dead" : "text-hi"}>{plain}</span>
        </div>
        <StepControls s={s} />
      </div>
    </div>
  );
}
