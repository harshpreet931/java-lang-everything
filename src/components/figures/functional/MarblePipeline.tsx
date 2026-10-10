"use client";

import { useEffect, useRef, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Console, Java, Narrate, Row, Words, tint, useReducedMotion } from "./kit";

// Stream.of(1..8).filter(even).map(x10).limit(2).toList(), element by element.
// the "how it runs" steps follow the real interleaving printed by this program on jdk 25:
//   filter 1 / filter 2 / map 2 / filter 3 / filter 4 / map 4 / [20, 40]
// (5..8 are never pulled). the "how you might picture it" mode is the eager mental
// model, drawn on purpose so you can see what java does NOT do.

type State = "wait" | "active" | "dead" | "done" | "skipped" | "wasted";
type M = { stage: number; slot: number; state: State; label: string };
type Frame = { m: M[]; out: string[]; note: string; filter: number; map: number; taken: number; hot?: number };

const N = [1, 2, 3, 4, 5, 6, 7, 8];
const STAGES = [
  { code: "Stream.of(1..8)", short: "source" },
  { code: "filter(n % 2 == 0)", short: "filter" },
  { code: "map(n -> n * 10)", short: "map" },
  { code: "limit(2)", short: "limit" },
  { code: "toList()", short: "toList" },
];

function lazyFrames(): Frame[] {
  const frames: Frame[] = [];
  const m: M[] = N.map((n, i) => ({ stage: 0, slot: i, state: "wait", label: String(n) }));
  const out: string[] = [];
  let f = 0;
  let mp = 0;
  let taken = 0;
  let dropped = 0;
  const snap = (note: string, hot?: number) =>
    frames.push({ m: m.map((x) => ({ ...x })), out: [...out], note, filter: f, map: mp, taken, hot });

  snap("toList() is the terminal operation, so the pipeline starts. it pulls one element from the source, nothing more.");
  const go = (i: number, last: boolean) => {
    const n = N[i];
    Object.assign(m[i], { stage: 1, slot: 0, state: "active" });
    f++;
    out.push(`filter ${n}`);
    snap(i === 0 ? `${n} goes to filter. 2..8 are still sitting in the source.` : `${n} is pulled and goes straight to filter.`, 1);
    if (n % 2) {
      Object.assign(m[i], { stage: 1, slot: 2 + dropped++, state: "dead" });
      snap(`${n} is odd, so filter drops it. only now does the source hand over the next one.`);
      return;
    }
    Object.assign(m[i], { stage: 2, slot: 0, state: "active", label: String(n * 10) });
    mp++;
    out.push(`map    ${n}`);
    snap(`${n} passes, and map turns it into ${n * 10} immediately. the elements after it haven't been looked at yet.`, 2);
    taken++;
    Object.assign(m[i], { stage: 3, slot: 0, state: "active" });
    snap(last ? `limit counts ${n * 10}: that's 2 of 2. it tells everything upstream to stop. that's short-circuiting.` : `limit counts it: ${taken} of 2. not done yet.`, 3);
    Object.assign(m[i], { stage: 4, slot: taken - 1, state: "done" });
    if (last) {
      for (let j = i + 1; j < N.length; j++) m[j].state = "skipped";
      out.push("[20, 40]");
      snap("done. 5, 6, 7 and 8 were never pulled out of the source. 4 filter calls and 2 map calls, for a list of 2.");
    } else snap(`${n * 10} lands in the list. then, and only then, the source is asked for another element.`, 4);
  };
  go(0, false);
  go(1, false);
  go(2, false);
  go(3, true);
  return frames;
}

function eagerFrames(): Frame[] {
  const frames: Frame[] = [];
  const base = (): M[] => N.map((n, i) => ({ stage: 0, slot: i, state: "wait", label: String(n) }));
  frames.push({ m: base(), out: [], note: "the picture a lot of people have: each stage processes the whole list, then hands the whole result on.", filter: 0, map: 0, taken: 0 });
  const m1 = N.map((n, i): M => ({ stage: 1, slot: i, state: n % 2 ? "dead" : "active", label: String(n) }));
  const out1 = N.map((n) => `filter ${n}`);
  frames.push({ m: m1, out: out1, note: "filter runs on all 8 first. half of them get dropped.", filter: 8, map: 0, taken: 0, hot: 1 });
  let k = 0;
  const m2 = N.map((n, i): M => (n % 2 ? { ...m1[i] } : { stage: 2, slot: k++, state: "active", label: String(n * 10) }));
  const out2 = [...out1, ...N.filter((n) => n % 2 === 0).map((n) => `map    ${n}`)];
  frames.push({ m: m2, out: out2, note: "then map runs on all 4 survivors.", filter: 8, map: 4, taken: 0, hot: 2 });
  k = 0;
  const m3 = m2.map((x): M => (x.stage === 2 ? { ...x, stage: 3, state: k < 2 ? "active" : "wasted", slot: k++ } : { ...x }));
  frames.push({ m: m3, out: out2, note: "then limit keeps the first 2 and throws 60 and 80 away. they were computed for nothing.", filter: 8, map: 4, taken: 2, hot: 3 });
  const m4 = m3.map((x): M => (x.stage === 3 && x.state === "active" ? { ...x, stage: 4, state: "done" } : { ...x }));
  frames.push({ m: m4, out: [...out2, "[20, 40]"], note: "8 filter calls and 4 map calls. that's NOT what java does (and it can't work at all on an infinite stream). switch back.", filter: 8, map: 4, taken: 2 });
  return frames;
}

const LAZY = lazyFrames();
const EAGER = eagerFrames();
const NONE: Frame[] = [
  {
    m: N.map((n, i) => ({ stage: 0, slot: i, state: "wait", label: String(n) })),
    out: [],
    note: "no terminal operation. filter, map and limit were recorded as stages, but no element ever moves, and nothing prints. the pipeline is just a description.",
    filter: 0,
    map: 0,
    taken: 0,
  },
];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function MarblePipeline() {
  const [model, setModel] = useState<"lazy" | "eager">("lazy");
  const [terminal, setTerminal] = useState<"toList" | "none">("toList");
  const frames = terminal === "none" ? NONE : model === "lazy" ? LAZY : EAGER;
  return (
    <div className="grid gap-4">
      <div>
        <Row k="model =" w="10ch">
          <Words
            options={[
              { v: "lazy", label: "how it runs" },
              { v: "eager", label: "how you might picture it" },
            ]}
            value={model}
            onChange={setModel}
            label="model"
          />
        </Row>
        <Row k="terminal =" w="10ch" last>
          <Words
            options={[
              { v: "toList", label: "toList()" },
              { v: "none", label: "none" },
            ]}
            value={terminal}
            onChange={setTerminal}
            label="terminal operation"
          />
        </Row>
      </div>
      <Run key={`${model}-${terminal}`} frames={frames} eager={model === "eager" && terminal !== "none"} none={terminal === "none"} />
    </div>
  );
}

function Run({ frames, eager, none }: { frames: Frame[]; eager: boolean; none: boolean }) {
  const s = useStepper(frames.length, { interval: eager ? 1800 : 1250 });
  const f = frames[s.i];
  const [ref, w] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const wide = w >= 560;

  // geometry
  const R = 15; // marble radius
  const gap = 34;
  const head = 54;
  const colW = w / 5;
  const rowH = 74;
  const height = wide ? head + 8 * gap + 6 : 5 * rowH + 4;
  const pos = (x: M) =>
    wide
      ? { left: colW * (x.stage + 0.5) - R, top: head + x.slot * gap }
      : { left: 4 + x.slot * Math.min(gap, (w - 8) / 8), top: x.stage * rowH + 30 };

  const tone = (st: State) =>
    st === "active" ? "hot" : st === "dead" || st === "wasted" ? "dead" : st === "done" ? "live" : null;

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div ref={ref} className="relative select-none" style={{ height }} role="img" aria-label="elements moving through filter, map and limit">
        {/* lanes */}
        {STAGES.map((st, i) => {
          const on = f.hot === i;
          const box = wide
            ? { left: colW * i + 3, top: 0, width: colW - 6, height }
            : { left: 0, top: i * rowH, width: w, height: rowH - 6 };
          return (
            <div
              key={st.code}
              className="absolute rounded-md bg-well transition-[box-shadow] duration-200 ease-jle"
              style={{ ...box, boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line)"}` }}
            >
              <div className={`px-2 pt-2 text-11 leading-[1.35] ${wide ? "text-center" : ""}`}>
                <span className="whitespace-nowrap">
                  <Java code={st.code} />
                </span>
                {i === 3 && (
                  <span className={`${wide ? "block" : "ml-3"} text-faint tabular`}>
                    taken {f.taken}/2
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {wide && f.m.some((x) => x.stage === 1 && x.state === "dead" && x.slot >= 2) && (
          <span className="absolute text-center text-11 text-dead" style={{ left: colW, width: colW, top: head + 1.25 * gap }}>
            dropped
          </span>
        )}
        {/* marbles */}
        {f.m.map((x, i) => {
          const t = tone(x.state);
          const p = pos(x);
          return (
            <div
              key={i}
              className="absolute flex items-center justify-center rounded-full text-11 tabular"
              style={{
                ...p,
                width: R * 2,
                height: R * 2,
                transition: reduce ? "none" : "left 320ms cubic-bezier(0.2,0,0,1), top 320ms cubic-bezier(0.2,0,0,1), opacity 200ms, box-shadow 200ms",
                background: t ? tint(t, x.state === "active" ? 22 : 14) : "var(--bg)",
                boxShadow: `inset 0 0 0 1px ${t ? `var(--${t})` : x.state === "skipped" ? "var(--line-2)" : "var(--mute)"}`,
                color: t ? `var(--${t})` : "var(--hi)",
                opacity: x.state === "skipped" ? 0.35 : x.state === "dead" ? 0.8 : 1,
                textDecoration: x.state === "wasted" ? "line-through" : undefined,
              }}
            >
              {x.label}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Console label={eager ? "what it would print (it doesn't)" : "stdout"} minH={eager ? "3.4em" : "3.4em"}>
          {f.out.length ? (
            <span className={eager ? "text-mute" : "text-ink"}>
              {f.out.slice(0, -1).join("\n")}
              {f.out.length > 1 ? "\n" : ""}
              <span className={eager ? "text-mute" : "text-hot"}>{f.out[f.out.length - 1]}</span>
            </span>
          ) : (
            <span className="text-faint">{none ? "(nothing. ever.)" : "·"}</span>
          )}
        </Console>
        <div className="flex gap-5 text-12 sm:flex-col sm:gap-1.5 sm:pt-3 sm:pr-1" aria-live="polite">
          <span>
            <span className="text-faint">filter calls </span>
            <span className="text-hi tabular">{f.filter}</span>
          </span>
          <span>
            <span className="text-faint">map calls </span>
            <span className="text-hi tabular">{f.map}</span>
          </span>
        </div>
      </div>

<Narrate>{f.note}</Narrate>
      {!none && <StepControls s={s} />}
    </div>
  );
}
