"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Narrate, Row, Words, ring, tint, useWidth } from "./kit";

// reduce(identity, op) over 1..8, sequentially and in parallel.
// the parallel tree is the split jdk 25 really does for List.of(1..8) on a machine
// with 13 common-pool workers: halves, down to single elements. every leaf starts
// from the identity. results checked: + with 0 → 36 / 36, + with 10 → 46 / 116,
// - with 0 → -36 / 0, - with 10 → -26 / 0.

const N = [1, 2, 3, 4, 5, 6, 7, 8];
type Op = "+" | "-";
const ap = (op: Op, a: number, b: number) => (op === "+" ? a + b : a - b);

export function FoldTree() {
  const [mode, setMode] = useState<"seq" | "par">("par");
  const [id, setId] = useState<0 | 10>(10);
  const [op, setOp] = useState<Op>("+");
  return (
    <div className="grid gap-4">
      <div>
        <Row k="run =" w="11ch">
          <Words
            options={[
              { v: "seq", label: "sequential" },
              { v: "par", label: "parallel" },
            ]}
            value={mode}
            onChange={setMode}
            label="sequential or parallel"
          />
        </Row>
        <Row k="identity =" w="11ch">
          <Words options={[{ v: 0, label: "0" }, { v: 10, label: "10" }]} value={id} onChange={(v) => setId(v as 0 | 10)} label="identity" />
        </Row>
        <Row k="op =" w="11ch" last>
          <Words
            options={[
              { v: "+", label: "(a, b) -> a + b" },
              { v: "-", label: "(a, b) -> a - b" },
            ]}
            value={op}
            onChange={setOp}
            label="accumulator"
          />
        </Row>
      </div>
      <div className="overflow-x-auto text-13 whitespace-pre">
        <Java code={`List.of(1, 2, 3, 4, 5, 6, 7, 8)${mode === "par" ? ".parallelStream()" : ".stream()"}.reduce(${id}, (a, b) -> a ${op} b)`} />
      </div>
      {mode === "seq" ? <Seq key={`${id}${op}`} id={id} op={op} /> : <Par key={`${id}${op}`} id={id} op={op} />}
    </div>
  );
}

function seqResult(id: number, op: Op) {
  return N.reduce((a, x) => ap(op, a, x), id);
}

function Verdict({ got, id, op }: { got: number; id: number; op: Op }) {
  const seq = seqResult(id, op);
  const intended = seqResult(0, op);
  const same = got === seq;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-12">
      <span>
        <span className="text-faint">sequential gives </span>
        <span className="text-hi tabular">{seq}</span>
      </span>
      <span>
        <span className="text-faint">this run gives </span>
        <span className="tabular" style={{ color: same && got === intended ? "var(--live)" : "var(--dead)" }}>
          {got}
        </span>
      </span>
      {!same && <span className="text-dead">they disagree.</span>}
    </div>
  );
}

function Seq({ id, op }: { id: number; op: Op }) {
  const s = useStepper(N.length + 1, { interval: 900 });
  const accs = [id];
  N.forEach((x) => accs.push(ap(op, accs[accs.length - 1], x)));
  const k = s.i; // elements folded so far
  const note =
    k === 0
      ? `one accumulator, starting at the identity, ${id}. one thread walks the elements left to right.`
      : k < N.length
        ? `${accs[k - 1]} ${op} ${N[k - 1]} = ${accs[k]}. the identity was used exactly once, at the very start.`
        : id === 0 || op === "-"
          ? `done: ${accs[k]}. sequentially, the identity is only ever used once, so a "wrong" one just shifts the answer by ${id}.`
          : `done: ${accs[k]}, which is 36 + 10. a wrong identity only shows up once here. in parallel it shows up once per chunk.`;

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-3 text-13" role="img" aria-label={`fold: ${accs.slice(0, k + 1).join(", ")}`}>
        {accs.map((v, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className={`text-11 tabular ${i <= k ? "text-mute" : "text-faint/50"}`}>
                {op}
                {N[i - 1]}→
              </span>
            )}
            <span
              className="inline-flex min-w-[3.2ch] justify-center rounded-md px-2 py-1 tabular transition-[box-shadow,color,opacity] duration-200"
              style={{
                opacity: i <= k ? 1 : 0.25,
                color: i === k ? "var(--hot)" : "var(--hi)",
                boxShadow: i === k ? ring("hot", 70) : ring(null),
                background: i === k ? tint("hot", 10) : undefined,
              }}
            >
              {i <= k ? v : "?"}
            </span>
          </span>
        ))}
      </div>
      <Narrate>{note}</Narrate>
      <StepControls s={s} />
    </div>
  );
}

type Node = { x: number; y: number; v: number; level: number; kids?: [number, number]; label?: string };

function Par({ id, op }: { id: number; op: Op }) {
  const s = useStepper(5, { interval: 1300 });
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const H = 236;
  const lx = (i: number) => (w / 8) * (i + 0.5);
  const ys = [26, 82, 138, 196]; // root, level2, level1, leaves

  // build the tree bottom-up
  const leaves: Node[] = N.map((x, i) => ({ x: lx(i), y: ys[3], v: ap(op, id, x), level: 0, label: `${id}${op}${x}` }));
  const l1: Node[] = [0, 2, 4, 6].map((i) => ({ x: (leaves[i].x + leaves[i + 1].x) / 2, y: ys[2], v: ap(op, leaves[i].v, leaves[i + 1].v), level: 1, kids: [i, i + 1] }));
  const l2: Node[] = [0, 2].map((i) => ({ x: (l1[i].x + l1[i + 1].x) / 2, y: ys[1], v: ap(op, l1[i].v, l1[i + 1].v), level: 2, kids: [i, i + 1] }));
  const root: Node = { x: (l2[0].x + l2[1].x) / 2, y: ys[0], v: ap(op, l2[0].v, l2[1].v), level: 3, kids: [0, 1] };
  const levels = [leaves, l1, l2, [root]];
  const shownUpTo = s.i - 1; // -1: nothing computed yet; 0: leaves; ... 3: root

  const notes = [
    "the stream splits in halves until each chunk is a single element. on a 14-core machine that's 8 chunks, run by different worker threads.",
    `every chunk starts its own accumulator at the identity: ${id} ${op} x. the identity is used 8 times, not once.`,
    `neighbouring results are combined (the combiner is the same ${op}). ${op === "-" ? "subtraction isn't associative, so regrouping changes the answer." : ""}`,
    "and again.",
    seqResultText(root.v, id, op),
  ];

  const bw = Math.min(44, w / 8 - 6);
  const box = (n: Node, lvl: number, key: string) => {
    const on = shownUpTo >= lvl;
    const now = shownUpTo === lvl;
    const tone = lvl === 3 && on ? (root.v === seqResult(0, op) && root.v === seqResult(id, op) ? "live" : "dead") : now ? "hot" : null;
    return (
      <g key={key}>
        <rect
          x={n.x - bw / 2}
          y={n.y - 13}
          width={bw}
          height={26}
          rx={4}
          fill={tone ? tint(tone, 12) : "var(--bg)"}
          stroke={tone ? `var(--${tone})` : on ? "var(--mute)" : "var(--line-2)"}
          strokeDasharray={on ? undefined : "3 3"}
        />
        <text x={n.x} y={n.y + 4} fontSize={12} textAnchor="middle" fontFamily="var(--font-code)" fill={tone ? `var(--${tone})` : on ? "var(--hi)" : "var(--faint)"}>
          {on ? n.v : "?"}
        </text>
      </g>
    );
  };

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div ref={ref} className="min-w-0 overflow-hidden">
        <svg width={w} height={H} className="block" role="img" aria-label={`parallel reduce tree, result ${shownUpTo >= 3 ? root.v : "pending"}`}>
          {/* edges */}
          {[l1, l2, [root]].map((lv, li) =>
            lv.map((n, ni) =>
              n.kids!.map((k) => {
                const child = levels[li][k];
                return <line key={`${li}-${ni}-${k}`} x1={n.x} y1={n.y + 13} x2={child.x} y2={child.y - 13} stroke="var(--line-2)" />;
              }),
            ),
          )}
          {leaves.map((n, i) => (
            <text key={`e${i}`} x={n.x} y={H - 6} fontSize={11} textAnchor="middle" fontFamily="var(--font-code)" fill="var(--faint)">
              {w > 420 ? n.label : N[i]}
            </text>
          ))}
          {levels.map((lv, li) => lv.map((n, ni) => box(n, li, `${li}-${ni}`)))}
        </svg>
      </div>
      {s.i === 4 && <Verdict got={root.v} id={id} op={op} />}
      <Narrate>{notes[s.i]}</Narrate>
      <StepControls s={s} />
    </div>
  );
}

function seqResultText(par: number, id: number, op: Op) {
  const seq = seqResult(id, op);
  if (par === seq) return `${par}, same as sequential. 0 really is an identity for +, and + is associative, so splitting can't change anything.`;
  if (op === "+") return `${par}. that's 36 plus 10 for every chunk: 36 + 80. sequential would say ${seq}. the identity has to be a real identity (x + 0 == x), or the answer depends on how many chunks there were.`;
  return `${par}. sequential says ${seq}. subtraction isn't associative: (1 - 2) - 3 isn't 1 - (2 - 3). parallel reduce regroups freely, so the op must not care.`;
}
