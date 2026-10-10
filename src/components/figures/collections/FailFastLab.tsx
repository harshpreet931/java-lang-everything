"use client";

import { useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row } from "./kit";

// a for-each over an ArrayList, desugared, run by the rules of ArrayList.Itr (jdk 25):
//   hasNext() { return cursor != size; }
//   next()    { checkForComodification(); ... cursor = i + 1; return es[lastRet = i]; }
//   remove()  { ArrayList.this.remove(lastRet); cursor = lastRet; lastRet = -1; expectedModCount = modCount; }
// checked on jdk 25: removing a, b or d throws, removing c ends the loop early and skips d.

type Mode = "list" | "iter";
type St = { es: string[]; size: number; mod: number; cursor: number; lastRet: number; expected: number; s: string | null };
type Step = St & { line: number; note: string; boom?: boolean; done?: boolean };

const START = ["a", "b", "c", "d"];

function run(target: string, mode: Mode): Step[] {
  const st: St = { es: [...START], size: 4, mod: 0, cursor: 0, lastRet: -1, expected: 0, s: null };
  const out: Step[] = [];
  const push = (line: number, note: string, extra: Partial<Step> = {}) => out.push({ ...st, es: [...st.es], line, note, ...extra });
  push(1, "the for-each asks the list for an iterator. it remembers modCount (0) as expectedModCount.");
  for (let guard = 0; guard < 20; guard++) {
    const has = st.cursor !== st.size;
    push(2, `hasNext(): cursor ${st.cursor} != size ${st.size}? ${has ? "yes, keep going." : "no. the loop ends."}`);
    if (!has) {
      push(6, `done. list = [${st.es.slice(0, st.size).join(", ")}].`, { done: true });
      break;
    }
    if (st.mod !== st.expected) {
      push(3, `next() checks first: modCount ${st.mod} != expectedModCount ${st.expected}. someone changed the list behind the iterator's back.`, { boom: true });
      break;
    }
    const i = st.cursor;
    st.cursor = i + 1;
    st.lastRet = i;
    st.s = st.es[i];
    push(3, `next(): counts match, so it returns es[${i}] = "${st.s}" and moves cursor to ${st.cursor}.`);
    if (st.s === target) {
      if (mode === "list") {
        const k = st.lastRet;
        st.es.splice(k, 1);
        st.es.push("");
        st.size--;
        st.mod++;
        push(4, `list.remove("${st.s}"): everything after it shifts left, size is ${st.size}, modCount is ${st.mod}. the iterator still expects ${st.expected}, and its cursor still says ${st.cursor}.`);
      } else {
        const k = st.lastRet;
        st.es.splice(k, 1);
        st.es.push("");
        st.size--;
        st.mod++;
        st.cursor = k;
        st.lastRet = -1;
        st.expected = st.mod;
        push(4, `it.remove(): removes es[${k}], then fixes itself up: cursor back to ${k}, expectedModCount = modCount = ${st.mod}. everyone agrees again.`);
      }
    } else {
      push(4, `"${st.s}" isn't "${target}". nothing to do.`);
    }
  }
  const last = out[out.length - 1];
  if (last.done && mode === "list") {
    const remaining = last.es.slice(0, last.size);
    if (target === "c") last.note = `done, no exception. list = [${remaining.join(", ")}]. but "d" was never visited: removing c made size 3, and cursor was already 3.`;
  }
  return out;
}

const CODE = (target: string, mode: Mode) => [
  `Iterator<String> it = list.iterator();`,
  `while (it.hasNext()) {`,
  `    String s = it.next();`,
  mode === "list" ? `    if (s.equals("${target}")) list.remove(s);` : `    if (s.equals("${target}")) it.remove();`,
  `}`,
  `IO.println(list);`,
];

export function FailFastLab() {
  const [target, setTarget] = useState("b");
  const [mode, setMode] = useState<Mode>("list");
  const steps = useMemo(() => run(target, mode), [target, mode]);
  const s = useStepper(steps.length, { interval: 1300 });
  const st = steps[Math.min(s.i, steps.length - 1)];
  const code = CODE(target, mode);
  const pick = (t: string) => {
    setTarget(t);
    s.go(0);
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    s.go(0);
  };

  const varRow = (k: string, v: React.ReactNode, tone?: string) => (
    <div className="contents">
      <span className="border-t border-line py-1 text-mute">{k}</span>
      <span className="border-t border-line py-1 text-right tabular" style={{ color: tone ?? "var(--hi)" }}>
        {v}
      </span>
    </div>
  );
  const mismatch = st.mod !== st.expected;

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-5 outline-none" aria-label="a for-each loop removing from an ArrayList, step by step">
      <div className="text-13">
        <Row k="remove =">
          {START.map((t) => (
            <button key={t} className="word" aria-pressed={target === t} onClick={() => pick(t)}>
              &quot;{t}&quot;
            </button>
          ))}
        </Row>
        <Row k="using =" last>
          <button className="word" aria-pressed={mode === "list"} onClick={() => pickMode("list")}>
            list.remove(s)
          </button>
          <button className="word" aria-pressed={mode === "iter"} onClick={() => pickMode("iter")}>
            it.remove()
          </button>
        </Row>
      </div>

      <div className="grid gap-5 @container sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-md bg-bg shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-8 items-center border-b border-line px-3.5 text-11 text-faint">the for-each, desugared</div>
          <ol className="overflow-x-auto py-2 text-12 leading-[1.9]">
            {code.map((l, i) => {
              const cur = st.line === i + 1;
              const tone = cur && st.boom ? "var(--dead)" : "var(--hot)";
              return (
                <li
                  key={i}
                  className="grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 whitespace-pre"
                  style={{
                    borderColor: cur ? tone : "transparent",
                    background: cur ? `color-mix(in srgb, ${tone} 10%, transparent)` : undefined,
                  }}
                >
                  <span className="text-right text-faint tabular">{i + 1}</span>
                  <span className={cur ? "text-hi" : "text-ink"}>{l}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid content-start gap-4">
          <div>
            <div className="mb-1.5 text-11 text-faint">elementData</div>
            <div className="flex">
              {st.es.map((v, i) => {
                const live = i < st.size;
                return (
                  <div key={i} className="flex w-[38px] flex-col items-center">
                    <div
                      className="-ml-px flex h-[30px] w-full items-center justify-center text-13"
                      style={{
                        boxShadow: `inset 0 0 0 1px ${i === st.lastRet && live ? "var(--hot)" : "var(--line-2)"}`,
                        background: live ? "var(--bg)" : "transparent",
                        color: live ? "var(--hi)" : "var(--faint)",
                        zIndex: i === st.lastRet ? 1 : 0,
                      }}
                    >
                      {live ? v : "·"}
                    </div>
                    <div className="text-[9px] text-faint tabular">{i}</div>
                    <div className="h-4 text-[10px] leading-4 text-ref">{i === st.cursor ? "↑cur" : ""}</div>
                  </div>
                );
              })}
              <div className="flex w-[38px] flex-col items-center">
                <div className="h-[30px]" />
                <div className="text-[9px] text-faint tabular">4</div>
                <div className="h-4 text-[10px] leading-4 text-ref">{st.cursor === 4 ? "↑cur" : ""}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-12 [&>.contents:first-child>span]:border-t-0">
            {varRow("size", st.size)}
            {varRow("cursor", st.cursor, "var(--ref)")}
            {varRow("lastRet", st.lastRet)}
            {varRow("modCount", st.mod, mismatch ? "var(--dead)" : undefined)}
            {varRow("expectedModCount", st.expected, mismatch ? "var(--dead)" : undefined)}
            {varRow("s", st.s === null ? "·" : `"${st.s}"`)}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="min-h-[3.4em] font-serif text-16 leading-[1.55] text-ink" aria-live="polite">
          {st.boom && <span className="mr-2 font-mono text-12 text-dead">ConcurrentModificationException</span>}
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
