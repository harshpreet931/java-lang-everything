"use client";

import { useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Java, Row, Words, tint, useWidth } from "../functional/kit";

// build an expression out of records (Num, Add, Mul, Neg), then step through
// eval(), a switch over the sealed interface. the evaluation order is java's:
// left operand first, then right (JLS 15.7). the eval method shown is the one in
// the chapter, which was run on jdk 25.

type E =
  | { k: "num"; v: number; id: number }
  | { k: "add" | "mul"; l: E; r: E; id: number }
  | { k: "neg"; x: E; id: number };

let nextId = 1;
const num = (v: number): E => ({ k: "num", v, id: nextId++ });
const add = (l: E, r: E): E => ({ k: "add", l, r, id: nextId++ });
const mul = (l: E, r: E): E => ({ k: "mul", l, r, id: nextId++ });
const neg = (x: E): E => ({ k: "neg", x, id: nextId++ });

const PRESETS: { id: string; label: string; make: () => E }[] = [
  { id: "a", label: "2 + 3 * 4", make: () => add(num(2), mul(num(3), num(4))) },
  { id: "b", label: "(1 + 2) * (3 + 4)", make: () => mul(add(num(1), num(2)), add(num(3), num(4))) },
  { id: "c", label: "-(1 + 2) * 4", make: () => mul(neg(add(num(1), num(2))), num(4)) },
  { id: "d", label: "-(-7)", make: () => neg(neg(num(7))) },
];

const NAME = { num: "Num", add: "Add", mul: "Mul", neg: "Neg" } as const;
const LINE = { num: 3, add: 4, mul: 5, neg: 6 } as const;

function show(e: E, parent = 0): string {
  let s: string;
  let p: number;
  if (e.k === "num") return String(e.v);
  if (e.k === "add") {
    s = `${show(e.l, 1)} + ${show(e.r, 1)}`;
    p = 1;
  } else if (e.k === "mul") {
    s = `${show(e.l, 2)} * ${show(e.r, 2)}`;
    p = 2;
  } else if (e.k === "neg") {
    s = e.x.k === "neg" ? `-(${show(e.x)})` : `-${show(e.x, 3)}`;
    p = 3;
  } else return "";
  return parent > p ? `(${s})` : s;
}

function java(e: E): string {
  if (e.k === "num") return `new Num(${e.v})`;
  if (e.k === "neg") return `new Neg(${java(e.x)})`;
  return `new ${NAME[e.k]}(${java(e.l)}, ${java(e.r)})`;
}

const size = (e: E): number => (e.k === "num" ? 1 : e.k === "neg" ? 1 + size(e.x) : 1 + size(e.l) + size(e.r));
const depth = (e: E): number => (e.k === "num" ? 0 : e.k === "neg" ? 1 + depth(e.x) : 1 + Math.max(depth(e.l), depth(e.r)));
const evalE = (e: E): number => (e.k === "num" ? e.v : e.k === "neg" ? -evalE(e.x) : e.k === "add" ? evalE(e.l) + evalE(e.r) : evalE(e.l) * evalE(e.r));

function replace(e: E, id: number, f: (n: E) => E): E {
  if (e.id === id) return f(e);
  if (e.k === "num") return e;
  if (e.k === "neg") return { ...e, x: replace(e.x, id, f) };
  return { ...e, l: replace(e.l, id, f), r: replace(e.r, id, f) };
}

type Step = { active: number | null; line: number; stack: string[]; values: Record<number, number>; note: string };

function trace(root: E): Step[] {
  const steps: Step[] = [];
  const values: Record<number, number> = {};
  const go = (e: E, stack: string[]): number => {
    const frame = `eval(${show(e)})`;
    const st = [...stack, frame];
    if (e.k === "num") {
      values[e.id] = e.v;
      steps.push({ active: e.id, line: 3, stack: st, values: { ...values }, note: `eval(Num[value=${e.v}]) matches case Num(var v). v is ${e.v}, and that's the answer: return ${e.v}.` });
      return e.v;
    }
    if (e.k === "neg") {
      steps.push({ active: e.id, line: 6, stack: st, values: { ...values }, note: `eval(${show(e)}) matches case Neg(var x). before it can negate anything, it has to eval(x).` });
      const a = go(e.x, st);
      const r = -a;
      values[e.id] = r;
      steps.push({ active: e.id, line: 6, stack: st, values: { ...values }, note: `back in the Neg frame: -(${a}) = ${r}. return ${r}.` });
      return r;
    }
    const op = e.k === "add" ? "+" : "*";
    steps.push({ active: e.id, line: LINE[e.k], stack: st, values: { ...values }, note: `eval(${show(e)}) matches case ${NAME[e.k]}(var l, var r). the pattern hands it both children; it evaluates the left one first.` });
    const a = go(e.l, st);
    const b = go(e.r, st);
    const r = e.k === "add" ? a + b : a * b;
    values[e.id] = r;
    steps.push({ active: e.id, line: LINE[e.k], stack: st, values: { ...values }, note: `back in the ${NAME[e.k]} frame, both sides known: ${a} ${op} ${b} = ${r}. return ${r}.` });
    return r;
  };
  const v = go(root, []);
  steps.push({ active: null, line: 0, stack: [], values: { ...values }, note: `eval returns ${v}. one call per node (${size(root)} of them), and each call is one switch over a sealed type. no instanceof chain, no visitor, no default.` });
  return steps;
}

const EVAL = `static int eval(Expr e) {
    return switch (e) {
        case Num(var v)        -> v;
        case Add(var l, var r) -> eval(l) + eval(r);
        case Mul(var l, var r) -> eval(l) * eval(r);
        case Neg(var x)        -> -eval(x);
    };
}`;

type P = { e: E; x: number; y: number };

function layout(root: E, width: number) {
  const leaves = { n: 0 };
  const pos = new Map<number, { x: number; d: number }>();
  const walk = (e: E, d: number): number => {
    let x: number;
    if (e.k === "num") x = leaves.n++;
    else if (e.k === "neg") x = walk(e.x, d + 1);
    else x = (walk(e.l, d + 1) + walk(e.r, d + 1)) / 2;
    pos.set(e.id, { x, d });
    return x;
  };
  walk(root, 0);
  const n = Math.max(1, leaves.n);
  const gap = Math.min(78, (width - 56) / Math.max(1, n - 1 || 1));
  const total = gap * (n - 1);
  const off = (width - total) / 2;
  const nodes: P[] = [];
  const edges: [P, P][] = [];
  const place = (e: E): P => {
    const p = pos.get(e.id)!;
    const me = { e, x: off + p.x * gap, y: 26 + p.d * 62 };
    nodes.push(me);
    if (e.k === "neg") edges.push([me, place(e.x)]);
    else if (e.k !== "num") {
      edges.push([me, place(e.l)]);
      edges.push([me, place(e.r)]);
    }
    return me;
  };
  place(root);
  return { nodes, edges, height: 26 + depth(root) * 62 + 44 };
}

export function ExprLab() {
  const [root, setRoot] = useState<E>(() => PRESETS[0].make());
  const [preset, setPreset] = useState("a");
  const [sel, setSel] = useState<number>(root.id);
  const [n, setN] = useState(2);
  const [ref, w] = useWidth<HTMLDivElement>(600);

  const key = java(root);
  const steps = useMemo(() => trace(root), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const big = size(root) >= 13 || depth(root) >= 5;

  const edit = (f: (e: E) => E) => {
    const next = replace(root, sel, f);
    setRoot(next);
    setPreset("");
    const found = (e: E): boolean => e.id === sel || (e.k === "neg" ? found(e.x) : e.k !== "num" && (found(e.l) || found(e.r)));
    if (!found(next)) setSel(next.id);
  };

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="start from" w="10ch">
          <Words
            options={PRESETS.map((p) => ({ v: p.id, label: p.label }))}
            value={preset}
            onChange={(v) => {
              const e = PRESETS.find((p) => p.id === v)!.make();
              setPreset(v);
              setRoot(e);
              setSel(e.id);
            }}
            label="preset expression"
          />
        </Row>
        <Row k="selected" w="10ch" last>
          <button className="act" disabled={big} onClick={() => edit((e) => add(e, num(n)))}>
            Add(·, {n})
          </button>
          <button className="act" disabled={big} onClick={() => edit((e) => mul(e, num(n)))}>
            Mul(·, {n})
          </button>
          <button className="act" disabled={big} onClick={() => edit((e) => neg(e))}>
            Neg(·)
          </button>
          <button className="act" onClick={() => edit(() => num(n))}>
            → {n}
          </button>
          <span className="ml-1 inline-flex items-center gap-1 text-12 text-faint">
            n
            <button className="word" aria-label="smaller n" onClick={() => setN((v) => Math.max(0, v - 1))}>
              −
            </button>
            <span className="w-[2ch] text-center text-hi tabular">{n}</span>
            <button className="word" aria-label="bigger n" onClick={() => setN((v) => Math.min(9, v + 1))}>
              +
            </button>
          </span>
        </Row>
      </div>

      <div className="grid gap-1 overflow-x-auto rounded-md bg-bg px-4 py-3 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="whitespace-nowrap">
          <span className="text-faint">expression </span>
          <span className="text-hi">{show(root)}</span>
          <span className="text-faint"> = {evalE(root)}</span>
        </div>
        <div className="whitespace-nowrap">
          <Java code={`Expr e = ${java(root)};`} />
        </div>
      </div>

      <div ref={ref}>
        <Lab key={key} root={root} steps={steps} sel={sel} setSel={setSel} width={w} />
      </div>
    </div>
  );
}

function Lab({
  root,
  steps,
  sel,
  setSel,
  width,
}: {
  root: E;
  steps: Step[];
  sel: number;
  setSel: (id: number) => void;
  width: number;
}) {
  const s = useStepper(steps.length, { interval: 1300 });
  const st = steps[s.i];
  const L = layout(root, Math.max(260, width));

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div className="rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <svg viewBox={`0 0 ${Math.max(260, width)} ${L.height}`} className="block w-full" role="img" aria-label={`expression tree for ${show(root)}`}>
          {L.edges.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y + 13} x2={b.x} y2={b.y - 13} stroke="var(--line-2)" strokeWidth={1.2} />
          ))}
          {L.nodes.map(({ e, x, y }) => {
            const active = st.active === e.id;
            const done = st.values[e.id] !== undefined;
            const isSel = sel === e.id;
            const label = e.k === "num" ? String(e.v) : NAME[e.k];
            const wN = e.k === "num" ? 30 : 42;
            return (
              <g
                key={e.id}
                role="button"
                tabIndex={0}
                aria-label={`select ${label}`}
                aria-pressed={isSel}
                onClick={() => setSel(e.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setSel(e.id))}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x - wN / 2}
                  y={y - 13}
                  width={wN}
                  height={26}
                  rx={6}
                  fill={active ? tint("hot", 18) : "var(--bg)"}
                  stroke={active ? "var(--hot)" : isSel ? "var(--ink)" : done ? "var(--live)" : "var(--line-2)"}
                  strokeWidth={active || isSel ? 1.8 : 1.2}
                  strokeDasharray={isSel && !active ? "3 3" : undefined}
                  style={{ transition: "fill 200ms, stroke 200ms" }}
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontFamily="var(--font-code)" fill={active ? "var(--hot)" : "var(--hi)"}>
                  {label}
                </text>
                {done && e.k !== "num" && (
                  <text x={x} y={y + 28} textAnchor="middle" fontSize={11} fontFamily="var(--font-code)" fill="var(--live)">
                    = {st.values[e.id]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-3 @[640px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CodePanel file="Main.java" code={EVAL} hot={st.line ? [st.line] : []} />
        <div className="grid content-start gap-1.5">
          <div className="text-11 text-faint">call stack (top first)</div>
          <div className="grid min-h-[7.5em] content-start gap-1 rounded-md bg-well px-3 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
            {st.stack.length === 0 && <span className="text-faint">{s.i === steps.length - 1 ? "empty: eval returned" : "empty"}</span>}
            {[...st.stack].reverse().map((f, i) => (
              <div key={i} className="truncate" style={{ color: i === 0 ? "var(--hot)" : "var(--ink)", opacity: i === 0 ? 1 : 0.75 }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} />
    </div>
  );
}
