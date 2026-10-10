"use client";

import { useId, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration, Words } from "./kit";

// item 7. an array-backed stack. pop() moves `size` down, but unless it also clears the
// slot, the array still holds a reference to the popped object. the GC sees a live
// reference and keeps the object: an obsolete reference. flip to the fixed pop() to see
// the same objects become garbage.

const CAP = 6;
const NAMES = ["a", "b", "c"];

type State = { size: number; slots: (string | null)[]; popped?: string; op: string };

function build(clears: boolean): State[] {
  const out: State[] = [];
  const slots: (string | null)[] = Array(CAP).fill(null);
  let size = 0;
  out.push({ size, slots: [...slots], op: "new Stack<>()" });
  for (const n of NAMES) {
    slots[size++] = n;
    out.push({ size, slots: [...slots], op: `push(${n})` });
  }
  for (let i = 0; i < 2; i++) {
    const v = slots[--size]!;
    if (clears) slots[size] = null;
    out.push({ size, slots: [...slots], popped: v, op: `pop() → ${v}` });
  }
  return out;
}

const NOTES = {
  forgets: [
    "an empty stack: an array of 6 slots and size = 0.",
    "push(a) stores a reference in slot 0. size = 1.",
    "push(b) goes in slot 1.",
    "push(c) goes in slot 2. the stack is the slots below size.",
    "pop() hands c back and moves size down. but slot 2 still points at c.",
    "pop() hands b back. the caller is done with b and c, but the array isn't: two obsolete references keep them alive.",
  ],
  clears: [
    "an empty stack: an array of 6 slots and size = 0.",
    "push(a) stores a reference in slot 0. size = 1.",
    "push(b) goes in slot 1.",
    "push(c) goes in slot 2. the stack is the slots below size.",
    "pop() moves size down and nulls slot 2. once the caller drops c, nothing points at it: garbage.",
    "pop() clears slot 1 too. b and c are collectable as soon as the callers let go.",
  ],
};

const SX = 24;
const SW = 64;
const SY = 34;
const SH = 40;
const OY = 150;

export function ObsoleteRefs() {
  const [mode, setMode] = useState<"forgets" | "clears">("forgets");
  const states = build(mode === "clears");
  const s = useStepper(states.length, { interval: 1500 });
  const st = states[s.i];
  const uid = useId().replace(/:/g, "");
  const refHead = `or-ref-${uid}`;
  const deadHead = `or-dead-${uid}`;

  // which objects exist on screen: every name that was ever pushed by this step
  const pushed = NAMES.slice(0, Math.min(NAMES.length, s.i));
  const holder = (n: string) => st.slots.findIndex((x) => x === n);

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3">
        <span className="text-12 text-faint">pop() =</span>
        <Words
          label="which pop()"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { v: "forgets", label: "forgets the slot" },
            { v: "clears", label: "clears the slot" },
          ]}
        />
      </div>

      <svg
        viewBox="0 0 440 230"
        fontFamily="var(--font-code)"
        className="block w-full max-w-[560px]"
        role="img"
        aria-label={`stack array with size ${st.size}. ${NOTES[mode][s.i]}`}
      >
        <defs>
          <marker id={refHead} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
          </marker>
          <marker id={deadHead} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--dead)" />
          </marker>
        </defs>

        <text x={SX} y={20} fontSize={11} fill="var(--faint)">
          Object[] items
        </text>
        <text x={SX + CAP * SW} y={20} fontSize={11} fill="var(--faint)" textAnchor="end">
          size = <tspan fill="var(--hot)">{st.size}</tspan>
        </text>

        {/* slots */}
        {st.slots.map((v, i) => {
          const inStack = i < st.size;
          const obsolete = !inStack && v !== null;
          return (
            <g key={i}>
              <rect
                x={SX + i * SW}
                y={SY}
                width={SW}
                height={SH}
                fill={inStack ? "color-mix(in srgb, var(--live) 8%, var(--bg))" : "var(--bg)"}
                stroke={obsolete ? "var(--dead)" : inStack ? "var(--live)" : "var(--line-2)"}
                strokeWidth={obsolete || inStack ? 1.25 : 1}
              />
              {v === null ? (
                <text x={SX + i * SW + SW / 2} y={SY + 25} fontSize={12} fill="var(--faint)" textAnchor="middle">
                  null
                </text>
              ) : (
                <circle cx={SX + i * SW + SW / 2} cy={SY + SH / 2} r={3.5} fill={obsolete ? "var(--dead)" : "var(--ref)"} />
              )}
              <text x={SX + i * SW + 6} y={SY + 12} fontSize={9} fill="var(--faint)">
                {i}
              </text>
            </g>
          );
        })}

        {/* the size boundary */}
        <line
          x1={SX + st.size * SW}
          x2={SX + st.size * SW}
          y1={SY - 8}
          y2={SY + SH + 4}
          stroke="var(--hot)"
          strokeWidth={2}
          style={{ transition: "all 250ms cubic-bezier(0.2,0,0,1)" }}
        />

        {/* objects + arrows */}
        {pushed.map((n, j) => {
          const from = holder(n);
          const ox = SX + 4 + j * 84;
          const held = from >= 0;
          const obsolete = held && from >= st.size;
          const garbage = !held;
          return (
            <g key={n} style={{ transition: "opacity 250ms" }}>
              {held && (
                <path
                  d={`M ${SX + from * SW + SW / 2} ${SY + SH / 2 + 4} L ${ox + 26} ${OY - 4}`}
                  stroke={obsolete ? "var(--dead)" : "var(--ref)"}
                  strokeWidth={1.25}
                  strokeDasharray={obsolete ? "4 3" : undefined}
                  markerEnd={`url(#${obsolete ? deadHead : refHead})`}
                  fill="none"
                />
              )}
              <rect
                x={ox}
                y={OY}
                width={52}
                height={34}
                rx={2}
                fill="var(--bg)"
                stroke={garbage ? "var(--dead)" : "var(--line-2)"}
                strokeDasharray={garbage ? "3 3" : undefined}
                opacity={garbage ? 0.75 : 1}
              />
              <text x={ox + 26} y={OY + 21} fontSize={12} fill={garbage ? "var(--dead)" : "var(--hi)"} textAnchor="middle">
                {n}
              </text>
              {obsolete && (
                <text x={ox + 26} y={OY + 50} fontSize={10} fill="var(--dead)" textAnchor="middle">
                  kept alive
                </text>
              )}
              {garbage && (
                <text x={ox + 26} y={OY + 50} fontSize={10} fill="var(--dead)" textAnchor="middle">
                  garbage
                </text>
              )}
            </g>
          );
        })}

        <text x={SX + CAP * SW} y={OY + 21} fontSize={12} fill="var(--mute)" textAnchor="end">
          {st.op}
        </text>
      </svg>

      <Narration className="mt-3 min-h-[3.3em]">{NOTES[mode][s.i]}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
