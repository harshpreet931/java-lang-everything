"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Chip, Java, Narrate, Row, Words, ring, tint, useWidth } from "./kit";

// the four built-in gatherers on Stream.of(1..8), one integrator call at a time.
// outputs match jdk 25:
//   windowFixed(3)   [[1, 2, 3], [4, 5, 6], [7, 8]]
//   windowSliding(3) [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6], [5, 6, 7], [6, 7, 8]]
//   scan(() -> 0, Integer::sum)  [1, 3, 6, 10, 15, 21, 28, 36]
//   fold(() -> 0, Integer::sum)  [36]

const IN = [1, 2, 3, 4, 5, 6, 7, 8];
type G = "fixed" | "sliding" | "scan" | "fold";

type Frame = {
  /** input indices currently in the window / just consumed */
  win: number[];
  /** how many inputs have been pulled */
  pulled: number;
  state?: string;
  out: string[];
  /** index of an output that was just pushed */
  pushed?: number;
  note: string;
  finisher?: boolean;
};

const CODE: Record<G, string> = {
  fixed: "Gatherers.windowFixed(3)",
  sliding: "Gatherers.windowSliding(3)",
  scan: "Gatherers.scan(() -> 0, Integer::sum)",
  fold: "Gatherers.fold(() -> 0, Integer::sum)",
};

const list = (xs: number[]) => `[${xs.join(", ")}]`;

function frames(g: G): Frame[] {
  const f: Frame[] = [];
  if (g === "fixed") {
    f.push({ win: [], pulled: 0, out: [], state: "[]", note: "the state is a buffer that fills up to 3. nothing is pushed until it's full." });
    let buf: number[] = [];
    const out: string[] = [];
    IN.forEach((x, i) => {
      buf.push(x);
      const full = buf.length === 3;
      if (full) out.push(list(buf));
      f.push({
        win: buf.map((_, k) => i - buf.length + 1 + k),
        pulled: i + 1,
        state: list(full ? [] : buf),
        out: [...out],
        pushed: full ? out.length - 1 : undefined,
        note: full ? `${x} fills the window. the integrator pushes ${list(buf)} downstream and starts a fresh buffer.` : `${x} goes into the buffer. nothing comes out yet.`,
      });
      if (full) buf = [];
    });
    out.push(list(buf));
    f.push({ win: [6, 7], pulled: 8, state: "[]", out: [...out], pushed: out.length - 1, finisher: true, note: "the input ran out with [7, 8] still in the buffer. the finisher runs once at the end and pushes the short last window." });
  } else if (g === "sliding") {
    f.push({ win: [], pulled: 0, out: [], state: "[]", note: "same idea, but the window slides by one instead of jumping by three. windows overlap." });
    const out: string[] = [];
    IN.forEach((x, i) => {
      const w = IN.slice(Math.max(0, i - 2), i + 1);
      const full = w.length === 3;
      if (full) out.push(list(w));
      f.push({
        win: w.map((_, k) => i - w.length + 1 + k),
        pulled: i + 1,
        state: list(w),
        out: [...out],
        pushed: full ? out.length - 1 : undefined,
        note: full ? `${x} arrives, the oldest element falls out the back, and ${list(w)} is pushed.` : `${x} goes in. the window needs 3 before it pushes anything.`,
      });
    });
    f.push({ win: [], pulled: 8, state: "[6, 7, 8]", out: [...out], finisher: true, note: "8 elements, 6 windows of 3. every element after the second starts a window." });
  } else {
    let acc = 0;
    const out: string[] = [];
    f.push({ win: [], pulled: 0, state: "0", out: [], note: `the initializer runs first and makes the state: () -> 0. then the integrator sees one element at a time.` });
    IN.forEach((x, i) => {
      const before = acc;
      acc += x;
      if (g === "scan") out.push(String(acc));
      f.push({
        win: [i],
        pulled: i + 1,
        state: String(acc),
        out: [...out],
        pushed: g === "scan" ? out.length - 1 : undefined,
        note: g === "scan" ? `${before} + ${x} = ${acc}. scan pushes every intermediate result: a running total.` : `${before} + ${x} = ${acc}. fold keeps it to itself. nothing is pushed yet.`,
      });
    });
    if (g === "fold") {
      out.push(String(acc));
      f.push({ win: [], pulled: 8, state: String(acc), out: [...out], pushed: 0, finisher: true, note: "only the finisher pushes, once: a stream of exactly one element. like reduce, but as an intermediate step, so the pipeline can keep going after it." });
    } else {
      f.push({ win: [], pulled: 8, state: String(acc), out: [...out], finisher: true, note: "8 in, 8 out. the last one is the fold's answer, the rest are the steps on the way." });
    }
  }
  return f;
}

export function GathererLab() {
  const [g, setG] = useState<G>("sliding");
  return (
    <div className="grid gap-4">
      <Row k="gather =" w="9ch" last>
        <Words
          options={[
            { v: "fixed", label: "windowFixed" },
            { v: "sliding", label: "windowSliding" },
            { v: "scan", label: "scan" },
            { v: "fold", label: "fold" },
          ]}
          value={g}
          onChange={setG}
          label="gatherer"
        />
      </Row>
      <div className="overflow-x-auto text-13 whitespace-pre">
        <Java code={`Stream.of(1, 2, 3, 4, 5, 6, 7, 8).gather(${CODE[g]}).toList()`} />
      </div>
      <Run key={g} fs={frames(g)} />
    </div>
  );
}

function Run({ fs }: { fs: Frame[] }) {
  const s = useStepper(fs.length, { interval: 1100 });
  const f = fs[s.i];
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const cell = Math.min(52, (w - 8) / 8);
  const off = Math.max(4, (w - 8 * cell) / 2);
  const r = Math.min(15, cell * 0.4);
  const win = new Set(f.win);
  const minW = Math.min(...f.win);
  const maxW = Math.max(...f.win);

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div ref={ref} className="relative min-w-0" style={{ height: 2 * r + 30 }}>
        <span className="absolute top-0 left-0 text-11 text-faint">in</span>
        {f.win.length > 0 && (
          <div
            className="absolute rounded-md transition-[left,width] duration-300 ease-jle motion-reduce:transition-none"
            style={{
              left: off + minW * cell + 1,
              width: (maxW - minW + 1) * cell - 2,
              top: 16,
              height: 2 * r + 10,
              boxShadow: ring("hot", 80),
              background: tint("hot", 8),
            }}
          />
        )}
        {IN.map((x, i) => {
          const pulled = i < f.pulled;
          return (
            <span
              key={i}
              className="absolute flex items-center justify-center rounded-full text-12 tabular transition-opacity duration-200"
              style={{
                left: off + i * cell + cell / 2 - r,
                top: 21,
                width: 2 * r,
                height: 2 * r,
                color: win.has(i) ? "var(--hot)" : "var(--hi)",
                boxShadow: ring(win.has(i) ? "hot" : pulled ? "mute" : null),
                background: "var(--bg)",
                opacity: pulled || win.has(i) ? 1 : 0.4,
              }}
            >
              {x}
            </span>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-[14ch_minmax(0,1fr)] sm:items-start">
        <div className="rounded-md px-3 py-2 text-12" style={{ boxShadow: ring("meta", 55), background: tint("meta", 6) }}>
          <div className="text-11 text-meta">state</div>
          <div className="mt-0.5 text-hi tabular">{f.state ?? "·"}</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">pushed downstream</div>
          <div className="flex min-h-[28px] flex-wrap gap-1.5" aria-live="polite">
            {f.out.length === 0 && <span className="text-12 text-faint">nothing yet</span>}
            {f.out.map((o, i) => (
              <Chip key={i} tone={i === f.pushed ? "hot" : "live"} className="!text-12 !leading-[24px]">
                {o}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-11 text-faint">
        {f.finisher ? <Chip tone="meta">finisher</Chip> : f.pulled > 0 ? <Chip>integrator</Chip> : <Chip tone="meta">initializer</Chip>}
        <span className="tabular">pulled {f.pulled}/8</span>
      </div>
      <Narrate>{f.note}</Narrate>
      <StepControls s={s} />
    </div>
  );
}
