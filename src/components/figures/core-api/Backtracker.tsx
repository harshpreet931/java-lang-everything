"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narr, Row } from "./kit";
import { run, type Step } from "./regex-engine";

// step through a backtracking match. the engine is in regex-engine.ts; its matches agree with
// java.util.regex find() on every case we tested (15 patterns), but it has none of java's
// shortcuts, so the step counts show the raw cost of backtracking.

type Preset = { id: string; label: string; pattern: string; input: (n: number) => string; n?: [number, number, number] };

const PRESETS: Preset[] = [
  { id: "greedy", label: "<.+> greedy", pattern: "<.+>", input: () => "<a><b>" },
  { id: "lazy", label: "<.+?> lazy", pattern: "<.+?>", input: () => "<a><b>" },
  { id: "digits", label: "\\d+0", pattern: "\\d+0", input: () => "12300" },
  { id: "evil", label: "(a+)+b", pattern: "(a+)+b", input: (n) => "a".repeat(n) + "!", n: [2, 12, 4] },
  { id: "fine", label: "a+b", pattern: "a+b", input: (n) => "a".repeat(n) + "!", n: [2, 12, 4] },
];

const LIMIT = 4000;

export function Backtracker() {
  const [pid, setPid] = useState("greedy");
  const preset = PRESETS.find((p) => p.id === pid)!;
  const [n, setN] = useState(4);
  const [pattern, setPattern] = useState(preset.pattern);
  const [input, setInput] = useState(preset.input(4));

  const choose = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPid(id);
    const nn = p.n ? p.n[2] : n;
    setN(nn);
    setPattern(p.pattern);
    setInput(p.input(nn));
  };

  const res = useMemo(() => {
    try {
      return { ...run(pattern, input, LIMIT), error: null as string | null };
    } catch (e) {
      return { steps: [] as Step[], count: 0, match: null, stopped: false, error: (e as Error).message };
    }
  }, [pattern, input]);

  const total = res.steps.length || 1;
  const s = useStepper(total, { interval: 320 });
  useEffect(() => {
    s.go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, input]);
  const i = Math.min(s.i, total - 1);
  const st: Step | undefined = res.steps[i];
  const backs = res.steps.slice(0, i + 1).filter((x) => x.kind === "back" || x.kind === "fail").length;

  const tone = st?.kind === "fail" ? "var(--dead)" : st?.kind === "done" ? "var(--live)" : st?.kind === "back" ? "var(--mute)" : "var(--hot)";

  return (
    <div {...s.keys} className="@container grid gap-4 font-mono outline-none">
      <div className="text-13">
        <Row k="try =" w="9ch">
          <div className="flex flex-wrap gap-1" role="group" aria-label="presets">
            {PRESETS.map((p) => (
              <button key={p.id} className="word" aria-pressed={p.id === pid} onClick={() => choose(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </Row>
        {preset.n && (
          <Row k="a's =" w="9ch">
            <div className="flex items-center gap-3">
              <input
                type="range"
                className="slider min-w-0 flex-1"
                min={preset.n[0]}
                max={preset.n[1]}
                value={n}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setN(v);
                  setInput(preset.input(v));
                }}
                aria-label="number of a's"
              />
              <span className="w-[3ch] text-right text-hi tabular">{n}</span>
            </div>
          </Row>
        )}
        <Row k="pattern =" w="9ch">
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            aria-label="regex pattern"
            className="w-full max-w-[28ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
          />
        </Row>
        <Row k="input =" w="9ch" last>
          <input
            value={input}
            maxLength={24}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            aria-label="input text"
            className="w-full max-w-[28ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
          />
        </Row>
      </div>

      {res.error ? (
        <p className="text-13 text-dead">can&apos;t parse that pattern: {res.error}. (this little engine knows . \d \w \s ( ) | * + ? {"{m,n}"} and lazy ?.)</p>
      ) : (
        <>
          {/* the pattern, with the piece being tried highlighted */}
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-3">
              <span className="w-[7ch] text-11 text-faint">pattern</span>
              <div className="flex text-16">
                {pattern.split("").map((ch, k) => {
                  const on = st && st.e > st.s && k >= st.s && k < st.e;
                  return (
                    <span
                      key={k}
                      className="px-[1px] transition-colors duration-150"
                      style={{ color: on ? tone : "var(--ink)", background: on ? `color-mix(in srgb, ${tone} 14%, transparent)` : undefined }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* the input: attempt start, how far this attempt got, the cursor */}
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-start gap-3">
              <span className="mt-2.5 w-[7ch] text-11 text-faint">input</span>
              <div className="flex">
                {[...input.split(""), ""].map((ch, k) => {
                  const inAttempt = st && k >= st.from && k < st.at && st.kind !== "start";
                  const matched = st?.kind === "done" && res.match && k >= res.match[0] && k < res.match[1];
                  const cursor = st && k === st.at;
                  return (
                    <div key={k} className="flex w-8 flex-col items-center">
                      <div
                        className="flex h-9 w-full items-center justify-center text-14 transition-[background-color,box-shadow] duration-150"
                        style={{
                          boxShadow: k < input.length ? "inset 0 0 0 1px var(--line-2)" : undefined,
                          marginLeft: -1,
                          background: matched
                            ? "color-mix(in srgb, var(--live) 18%, transparent)"
                            : inAttempt
                              ? "color-mix(in srgb, var(--hot) 12%, transparent)"
                              : undefined,
                          color: k < input.length ? "var(--hi)" : "var(--faint)",
                        }}
                      >
                        {k < input.length ? ch : ""}
                      </div>
                      <span className="mt-1 text-[10px] text-faint tabular">{k}</span>
                      <span className="h-4 text-11 leading-4" style={{ color: tone }}>
                        {cursor ? "↑" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-1 text-12 @[560px]:grid-cols-3">
            <Stat k="steps so far" v={`${i + 1}`} />
            <Stat k="fails + backtracks" v={`${backs}`} />
            <Stat k="total for this input" v={res.stopped ? "> 3,000,000" : res.count.toLocaleString("en-US")} hot={res.count > 1000} />
          </div>

          <Narr className="min-h-[3.2em]">{describe(st, pattern, input, res.count, res.steps.length)}</Narr>
          <StepControls s={s} />
        </>
      )}
    </div>
  );
}

function describe(st: Step | undefined, pattern: string, input: string, count: number, shown: number): ReactNode {
  if (!st) return "";
  const piece = <code>{pattern.slice(st.s, st.e)}</code>;
  const at = st.at < input.length ? <code>{input[st.at]}</code> : "the end";
  switch (st.kind) {
    case "start":
      return st.from === 0 ? "new attempt, starting at index 0." : `that attempt failed everywhere. move the start to index ${st.from} and try again from scratch.`;
    case "ok":
      return (
        <>
          {piece} matches {at} at index {st.at}.
        </>
      );
    case "fail":
      return (
        <>
          {piece} can&apos;t match {at} at index {st.at}. back up to the last choice.
        </>
      );
    case "back":
      return (
        <>
          backtrack: {piece} gives up and the engine tries its next option, from index {st.at}.
        </>
      );
    case "done":
      return (
        <>
          match: <code>{input.slice(st.from, st.at)}</code> at [{st.from}, {st.at}).
        </>
      );
    case "nomatch":
      return `no match anywhere. that took ${count.toLocaleString("en-US")} steps${count > shown ? ` (only the first ${shown.toLocaleString("en-US")} are shown)` : ""}.`;
  }
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <span className="text-faint">{k}</span>
      <span className={`tabular ${hot ? "text-dead" : "text-hi"}`}>{v}</span>
    </div>
  );
}
