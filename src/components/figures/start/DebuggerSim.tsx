"use client";

import { useState } from "react";
import { Java } from "@/components/figures/basics/kit";

// a tiny debugger. the execution below is the real one: generated with tools/tracer
// (a JDI debugger) from this exact program on jdk 25, then copied in. each event is
// "paused, about to run this line", with the live call stack and locals.
// resume / step over / step into / step out are just searches through that list.

const SOURCE = `public class Main {
    static int sumTo(int n) {
        int total = 0;
        for (int i = 1; i < n; i++) {
            total += i;
        }
        return total;
    }

    static double average(int n) {
        int sum = sumTo(n);
        return (double) sum / n;
    }

    public static void main(String[] args) {
        double avg = average(4);
        System.out.println("average of 1..4 = " + avg);
    }
}`;

type Locals = Record<string, number | string>;
type Ev = { line: number; frames: { name: string; line: number; locals: Locals }[]; out?: boolean };

const m = (line: number, locals: Locals = {}) => ({ name: "main", line, locals });
const a = (line: number, locals: Locals) => ({ name: "average", line, locals });
const s = (line: number, locals: Locals) => ({ name: "sumTo", line, locals });

const EVENTS: Ev[] = [
  { line: 16, frames: [m(16)] },
  { line: 11, frames: [m(16), a(11, { n: 4 })] },
  { line: 3, frames: [m(16), a(11, { n: 4 }), s(3, { n: 4 })] },
  { line: 4, frames: [m(16), a(11, { n: 4 }), s(4, { n: 4, total: 0 })] },
  { line: 5, frames: [m(16), a(11, { n: 4 }), s(5, { n: 4, total: 0, i: 1 })] },
  { line: 4, frames: [m(16), a(11, { n: 4 }), s(4, { n: 4, total: 1, i: 1 })] },
  { line: 5, frames: [m(16), a(11, { n: 4 }), s(5, { n: 4, total: 1, i: 2 })] },
  { line: 4, frames: [m(16), a(11, { n: 4 }), s(4, { n: 4, total: 3, i: 2 })] },
  { line: 5, frames: [m(16), a(11, { n: 4 }), s(5, { n: 4, total: 3, i: 3 })] },
  { line: 4, frames: [m(16), a(11, { n: 4 }), s(4, { n: 4, total: 6, i: 3 })] },
  { line: 7, frames: [m(16), a(11, { n: 4 }), s(7, { n: 4, total: 6 })] },
  { line: 11, frames: [m(16), a(11, { n: 4 })] },
  { line: 12, frames: [m(16), a(12, { n: 4, sum: 6 })] },
  { line: 16, frames: [m(16)] },
  { line: 17, frames: [m(17, { avg: 1.5 })] },
  { line: 18, frames: [m(18, { avg: 1.5 })], out: true },
];

const START = -1;
const DONE = EVENTS.length;

export function DebuggerSim() {
  const [bps, setBps] = useState<Set<number>>(() => new Set([5]));
  const [at, setAt] = useState(START);
  const [frameSel, setFrameSel] = useState(0); // 0 = top of stack
  const [last, setLast] = useState<string>("");

  const ev = at >= 0 && at < DONE ? EVENTS[at] : null;
  const prev = at > 0 && at <= DONE ? EVENTS[at - 1] : null;
  const depth = ev ? ev.frames.length : 0;
  const printed = at >= DONE || (ev?.out ?? false) || EVENTS.slice(0, Math.max(0, at)).some((e) => e.out);

  const go = (to: number, what: string) => {
    setAt(Math.min(DONE, to));
    setFrameSel(0);
    setLast(what);
  };
  const find = (from: number, ok: (e: Ev) => boolean) => {
    for (let j = from + 1; j < EVENTS.length; j++) if (ok(EVENTS[j])) return j;
    return DONE;
  };

  const resume = () => go(find(at, (e) => bps.has(e.line)), "resume");
  const into = () => go(at + 1, "step into");
  const over = () => go(at === START ? 0 : find(at, (e) => e.frames.length <= depth), "step over");
  const out = () => go(find(at, (e) => e.frames.length < depth), "step out");
  const restart = () => go(START, "");

  const toggle = (n: number) =>
    setBps((b) => {
      const x = new Set(b);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });

  const frames = ev ? [...ev.frames].reverse() : [];
  const shown = frames[frameSel];
  const prevFrame = prev && shown ? [...prev.frames].reverse().find((f, i) => f.name === shown.name && i === frameSel) : undefined;
  const lines = SOURCE.split("\n");
  const hereLine = shown?.line;

  const status =
    at === START
      ? "not running. click a line number to set a breakpoint, then resume."
      : at >= DONE
        ? "program finished."
        : `paused in ${ev!.frames[ev!.frames.length - 1].name}(), about to run line ${ev!.line}.`;

  return (
    <div className="font-mono @container text-13">
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button className="act solid" onClick={resume} disabled={at >= DONE}>
          {at === START ? "debug ▶" : "resume ▶"}
        </button>
        <button className="act" onClick={over} disabled={at >= DONE}>
          step over
        </button>
        <button className="act" onClick={into} disabled={at >= DONE}>
          step into
        </button>
        <button className="act" onClick={out} disabled={at < 0 || at >= DONE}>
          step out
        </button>
        <button className="act" onClick={restart} disabled={at === START}>
          restart
        </button>
      </div>

      <div className="grid gap-5 @[680px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* code with a breakpoint gutter */}
        <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
            <span className="text-ink">Main.java</span>
            <span className="flex items-center gap-2 text-11 text-faint">
              <span className="inline-block size-2 rounded-full bg-meta" /> breakpoint
            </span>
          </div>
          <ol className="overflow-x-auto py-2.5 text-12 leading-[1.8] @[480px]:text-13">
            {lines.map((l, i) => {
              const n = i + 1;
              const isHere = ev && n === ev.line && frameSel === 0;
              const isCaller = ev && frameSel > 0 && n === hereLine;
              return (
                <li
                  key={n}
                  className="grid min-w-max grid-cols-[3.2ch_3ch_1fr] items-center border-l-2 pr-4"
                  style={{
                    borderColor: isHere ? "var(--hot)" : isCaller ? "var(--line-2)" : "transparent",
                    background: isHere
                      ? "color-mix(in srgb, var(--hot) 11%, transparent)"
                      : isCaller
                        ? "color-mix(in srgb, var(--ink) 6%, transparent)"
                        : undefined,
                  }}
                >
                  <button
                    onClick={() => toggle(n)}
                    aria-label={`${bps.has(n) ? "remove" : "set"} breakpoint on line ${n}`}
                    aria-pressed={bps.has(n)}
                    className="group flex h-full items-center justify-center"
                  >
                    <span
                      className={`size-2 rounded-full transition-opacity duration-150 ${
                        bps.has(n) ? "bg-meta opacity-100" : "bg-meta opacity-0 group-hover:opacity-40"
                      }`}
                    />
                  </button>
                  <span className={`pr-3 text-right tabular ${isHere ? "text-hot" : "text-faint/70"}`}>{n}</span>
                  <span className="whitespace-pre">
                    <Java code={l || " "} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* frames + variables + output */}
        <div className="grid content-start gap-4">
          <div>
            <div className="mb-1.5 border-b border-line pb-1.5 text-11 text-faint">frames</div>
            {frames.length === 0 ? (
              <div className="text-12 text-faint">{at >= DONE ? "main returned. no frames." : "no thread paused."}</div>
            ) : (
              <div className="grid gap-1">
                {frames.map((f, i) => (
                  <button
                    key={`${f.name}-${i}`}
                    onClick={() => setFrameSel(i)}
                    aria-pressed={frameSel === i}
                    className="flex items-baseline justify-between gap-3 rounded-md px-2.5 py-1 text-left text-12 transition-colors duration-150"
                    style={{
                      boxShadow: `inset 0 0 0 1px ${frameSel === i ? "var(--ink)" : "var(--line)"}`,
                      color: frameSel === i ? "var(--hi)" : "var(--mute)",
                    }}
                  >
                    <span>
                      {f.name}
                      <span className="text-faint">()</span>
                    </span>
                    <span className="text-11 text-faint tabular">Main.java:{f.line}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 border-b border-line pb-1.5 text-11 text-faint">
              variables{shown ? ` · ${shown.name}()` : ""}
            </div>
            {!shown ? (
              <div className="text-12 text-faint">·</div>
            ) : Object.keys(shown.locals).length === 0 ? (
              <div className="text-12 text-faint">no locals yet</div>
            ) : (
              <div className="text-12">
                {Object.entries(shown.locals).map(([k, v], i) => {
                  const changed = prevFrame && prevFrame.locals[k] !== v;
                  return (
                    <div key={k} className={`flex items-baseline justify-between gap-4 py-[3px] ${i ? "border-t border-line" : ""}`}>
                      <span className="text-mute">{k}</span>
                      <span key={changed ? `${at}` : "same"} className={`px-0.5 tabular ${changed ? "flash text-hot" : "text-hi"}`}>
                        {String(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 border-b border-line pb-1.5 text-11 text-faint">console</div>
            <div className="text-12">
              {printed ? <span className="text-dead">average of 1..4 = 1.5</span> : <span className="text-faint">·</span>}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 min-h-[1.6em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
        {last && <span className="text-faint">{last} → </span>}
        {status}
      </p>
    </div>
  );
}
