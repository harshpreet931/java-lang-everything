"use client";

import { useState } from "react";
import { Narrate, Row, Words, useTicker } from "./ui";

// the store-buffering litmus test, played by hand.
//   x = y = 0
//   T1: x = 1; r1 = y;      T2: y = 1; r2 = x;
// "imagined": every write goes straight to memory (sequential consistency).
// "store buffers": writes park in the core's store buffer until drained. reads check
//   their own buffer first, then memory. this is how (0, 0) happens on real CPUs.
// "volatile": a volatile write can't be overtaken by a later volatile read, so the
//   buffer drains before the read runs. (0, 0) becomes unreachable.

type Mode = "sc" | "buffers" | "volatile";
type Core = { pc: 0 | 1 | 2; reg: number | null; buf: { v: "x" | "y"; val: number }[] };
type St = { mem: { x: number; y: number }; c: [Core, Core]; note: string; seen: string[] };

const CODE = [
  ["x = 1;", "r1 = y;"],
  ["y = 1;", "r2 = x;"],
] as const;
const W: ("x" | "y")[] = ["x", "y"];
const R: ("x" | "y")[] = ["y", "x"];

const fresh = (seen: string[] = []): St => ({
  mem: { x: 0, y: 0 },
  c: [
    { pc: 0, reg: null, buf: [] },
    { pc: 0, reg: null, buf: [] },
  ],
  note: "x and y start at 0. each thread writes one and reads the other. is r1 = 0 and r2 = 0 possible?",
  seen,
});

function outcome(s: St) {
  const done = s.c.every((c) => c.pc === 2 && c.buf.length === 0);
  return done ? `${s.c[0].reg}, ${s.c[1].reg}` : null;
}

function stepCore(s: St, i: 0 | 1, mode: Mode): St {
  const c = s.c.map((x) => ({ ...x, buf: [...x.buf] })) as [Core, Core];
  const me = c[i];
  const mem = { ...s.mem };
  const n = `T${i + 1}`;
  let note = "";
  if (me.pc === 0) {
    const v = W[i];
    if (mode === "buffers") {
      me.buf.push({ v, val: 1 });
      note = `${n} writes ${v} = 1, but only into its core's store buffer. memory still says ${v} = 0, and the other core can't see the buffer.`;
    } else {
      mem[v] = 1;
      note =
        mode === "volatile"
          ? `${n} does a volatile write: ${v} = 1. it reaches memory before ${n} is allowed to do its next volatile read.`
          : `${n} writes ${v} = 1 straight to memory, which is how we all imagine it.`;
    }
    me.pc = 1;
  } else if (me.pc === 1) {
    const v = R[i];
    const own = me.buf.find((b) => b.v === v);
    me.reg = own ? own.val : mem[v];
    me.pc = 2;
    note = own
      ? `${n} reads ${v} from its own store buffer: ${me.reg}.`
      : `${n} reads ${v} from memory: ${me.reg}.${mode === "buffers" && mem[v] === 0 && c[i === 0 ? 1 : 0].buf.length ? ` the other thread's write is still stuck in the other core's buffer.` : ""}`;
  }
  let out: St = { mem, c, note, seen: s.seen };
  const o = outcome(out);
  if (o && !out.seen.includes(o)) out = { ...out, seen: [...out.seen, o] };
  return out;
}

function drain(s: St, i: 0 | 1): St {
  const c = s.c.map((x) => ({ ...x, buf: [...x.buf] })) as [Core, Core];
  const mem = { ...s.mem };
  for (const b of c[i].buf) mem[b.v] = b.val;
  const flushed = c[i].buf.map((b) => `${b.v} = ${b.val}`).join(", ");
  c[i].buf = [];
  let out: St = { mem, c, note: `core ${i + 1} drains its store buffer: ${flushed} finally reaches memory.`, seen: s.seen };
  const o = outcome(out);
  if (o && !out.seen.includes(o)) out = { ...out, seen: [...out.seen, o] };
  return out;
}

const RECIPE: ["s" | "d", 0 | 1][] = [
  ["s", 0],
  ["s", 1],
  ["s", 0],
  ["s", 1],
  ["d", 0],
  ["d", 1],
];

export function ReorderingSandbox() {
  const [mode, setMode] = useState<Mode>("sc");
  const [s, setS] = useState<St>(fresh);
  const [auto, setAuto] = useState(-1);

  const switchMode = (m: Mode) => {
    setMode(m);
    setAuto(-1);
    setS(fresh());
  };

  const ref = useTicker(auto >= 0, 900, () => {
    const [k, i] = RECIPE[auto];
    setS((cur) => (k === "s" ? stepCore(cur, i, mode) : drain(cur, i)));
    setAuto((a) => (a + 1 < RECIPE.length ? a + 1 : -1));
  });

  const o = outcome(s);
  const zz = o === "0, 0";

  return (
    <div ref={ref}>
      <div className="mb-5 text-13">
        <Row k="memory =" w="10ch">
          <Words
            options={[
              { v: "sc", label: "what you imagine" },
              { v: "buffers", label: "store buffers" },
              { v: "volatile", label: "volatile x, y" },
            ]}
            value={mode}
            onChange={(v) => switchMode(v as Mode)}
            label="memory model"
          />
        </Row>
      </div>

      <div className="mb-3 text-12 text-mute">
        <span className="text-faint">shared: </span>
        <span className={mode === "volatile" ? "text-hot" : "text-ink"}>{mode === "volatile" ? "volatile int x = 0, y = 0;" : "int x = 0, y = 0;"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {([0, 1] as const).map((i) => {
          const c = s.c[i];
          const done = c.pc === 2;
          return (
            <div key={i} className="min-w-0 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="mb-1.5 flex items-baseline justify-between text-12">
                <span className="text-hi">T{i + 1}</span>
                <span className="text-11 text-faint">core {i + 1}</span>
              </div>
              <ol className="text-12 leading-[1.75]">
                {CODE[i].map((l, j) => (
                  <li
                    key={j}
                    className="truncate border-l-2 pl-2"
                    style={{
                      borderColor: c.pc === j ? "var(--hot)" : "transparent",
                      color: c.pc === j ? "var(--hi)" : c.pc > j ? "var(--ink)" : "var(--mute)",
                      background: c.pc === j ? "color-mix(in srgb, var(--hot) 8%, transparent)" : undefined,
                    }}
                  >
                    {l}
                  </li>
                ))}
              </ol>
              <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-12">
                <span className="text-faint">r{i + 1} =</span>
                <span className="text-hi tabular">{c.reg ?? "·"}</span>
              </div>
              {mode === "buffers" && (
                <div className="mt-2">
                  <div className="mb-1 text-11 text-faint">store buffer</div>
                  <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-xs px-1.5 py-1" style={{ border: "1px dashed var(--line-2)" }}>
                    {c.buf.length ? (
                      c.buf.map((b, j) => (
                        <span key={j} className="obj-in rounded-xs px-1.5 text-12 text-hot shadow-[inset_0_0_0_1px_var(--hot)]">
                          {b.v} = {b.val}
                        </span>
                      ))
                    ) : (
                      <span className="text-11 text-faint">empty</span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button className={`act flex-1 ${done ? "" : "solid"}`} disabled={done || auto >= 0} onClick={() => setS((cur) => stepCore(cur, i, mode))}>
                  {done ? "done" : `step T${i + 1}`}
                </button>
                {mode === "buffers" && (
                  <button className="act flex-1" disabled={!c.buf.length || auto >= 0} onClick={() => setS((cur) => drain(cur, i))}>
                    drain
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col items-center">
        <div className="text-11 text-faint">shared memory</div>
        <div className="mt-1.5 flex gap-2">
          {(["x", "y"] as const).map((v) => (
            <div key={v} className="flex min-w-[64px] flex-col items-center rounded-md bg-well px-4 py-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
              <span className="text-11 text-mute">{v}</span>
              <span key={s.mem[v]} className="flash text-20 leading-tight text-hi tabular">
                {s.mem[v]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Narrate>{zz ? <span className="text-dead">r1 = 0 and r2 = 0. both threads read before either write landed. the outcome no interleaving can produce just happened.</span> : s.note}</Narrate>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-12">
        <span className="text-faint">outcomes seen (r1, r2):</span>
        {["0, 1", "1, 0", "1, 1", "0, 0"].map((k) => {
          const hit = s.seen.includes(k);
          const bad = k === "0, 0";
          return (
            <span
              key={k}
              className="rounded-xs px-1.5 tabular"
              style={{
                color: hit ? (bad ? "var(--dead)" : "var(--live)") : "var(--faint)",
                boxShadow: `inset 0 0 0 1px ${hit ? (bad ? "var(--dead)" : "var(--live)") : "var(--line)"}`,
              }}
            >
              {k}
            </span>
          );
        })}
        <span className="ml-auto flex gap-1.5">
          {mode === "buffers" && (
            <button
              className="act"
              disabled={auto >= 0}
              onClick={() => {
                setS(fresh(s.seen));
                setAuto(0);
              }}
            >
              show me 0, 0
            </button>
          )}
          <button className="act" onClick={() => (setAuto(-1), setS(fresh(s.seen)))}>
            again
          </button>
        </span>
      </div>
    </div>
  );
}
