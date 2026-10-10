"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, useReducedMotion } from "@/components/figures/basics/kit";

// a jshell session, typed out one snippet per step. every output line was copied from a
// real run of jshell 25.0.4.1 with exactly these inputs, in this order (note the failed
// snippet doesn't use up a $ number, so List.of gets $8).

type Entry = { in: string; out: string[]; note: string; err?: boolean; cmd?: boolean };

const SESSION: Entry[] = [
  { in: "int x = 5", out: ["x ==> 5"], note: "declare a variable, no class, no main. jshell echoes every value as name ==> value." },
  { in: "x * 2", out: ["$2 ==> 10"], note: "an expression without a name gets a scratch variable. the 2 is the snippet number: this is the 2nd thing you typed." },
  { in: "$2 + 1", out: ["$3 ==> 11"], note: "scratch variables are real variables. use them in the next line." },
  { in: '"duke".toUpperCase()', out: ['$4 ==> "DUKE"'], note: "strings show up with their quotes, so you can tell \"5\" from 5." },
  { in: "int square(int n) { return n * n; }", out: ["|  created method square(int)"], note: "methods work too. type them in one line or several, jshell waits until the braces close." },
  { in: "square(12)", out: ["$6 ==> 144"], note: "call it like any method. redefine it later and every call uses the new version." },
  { in: "0.1 + 0.2", out: ["$7 ==> 0.30000000000000004"], note: "the fastest way to settle an argument about what java actually does. (this one gets its own chapter.)" },
  {
    in: 'int y = "oops"',
    out: ["|  Error:", "|  incompatible types: java.lang.String cannot be converted to int", '|  int y = "oops";', "|          ^----^"],
    err: true,
    note: "errors don't end the session. you get the compiler's message, the snippet is thrown away, and its number isn't used.",
  },
  { in: "List.of(3, 1, 2)", out: ["$8 ==> [3, 1, 2]"], note: "List without an import: since java 25, jshell starts with import module java.base." },
  {
    in: "/vars",
    cmd: true,
    out: [
      "|    int x = 5",
      "|    int $2 = 10",
      "|    int $3 = 11",
      '|    String $4 = "DUKE"',
      "|    int $6 = 144",
      "|    double $7 = 0.30000000000000004",
      "|    List<Integer> $8 = [3, 1, 2]",
    ],
    note: "anything starting with / is a jshell command, not java. /vars lists every variable with its type.",
  },
  { in: "/methods", cmd: true, out: ["|    int square(int)"], note: "/methods lists what you've defined. /list shows every snippet, /edit opens one in an editor." },
];

export function JshellSession() {
  const s = useStepper(SESSION.length, { interval: 2600 });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(SESSION[0].in.length);
  const box = useRef<HTMLDivElement>(null);
  const cur = SESSION[s.i];

  // type the current input out, then show its output
  useEffect(() => {
    if (reduce || s.dir < 0) {
      setTyped(cur.in.length);
      return;
    }
    setTyped(0);
    let n = 0;
    const t = setInterval(() => {
      n++;
      setTyped(n);
      if (n >= cur.in.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [s.i, s.dir, cur.in.length, reduce]);

  useLayoutEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.i, typed]);

  const done = typed >= cur.in.length;

  return (
    <div {...s.keys} className="font-mono outline-none" aria-label="a jshell session">
      <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
          <span className="text-ink">jshell</span>
          <span className="text-11 text-faint">jdk 25.0.4.1</span>
        </div>
        <div ref={box} className="h-[300px] overflow-auto px-4 py-3 text-12 leading-[1.75] sm:text-13">
          <div className="text-faint">|  Welcome to JShell -- Version 25.0.4.1</div>
          <div className="mb-2 text-faint">|  For an introduction type: /help intro</div>
          {SESSION.slice(0, s.i + 1).map((e, i) => {
            const last = i === s.i;
            const text = last ? e.in.slice(0, typed) : e.in;
            return (
              <div key={i} className={`mb-2 ${last ? "" : "opacity-60"}`}>
                <div className="whitespace-pre">
                  <span className="text-faint">jshell&gt; </span>
                  {e.cmd ? <span className="text-hi">{text}</span> : <Java code={text} />}
                  {last && !done && <span className="ml-px inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-hot" />}
                </div>
                {(!last || done) &&
                  e.out.map((o, j) => (
                    <div key={j} className={`whitespace-pre ${e.err ? "text-dead" : o.startsWith("|") ? "text-mute" : "text-hi"}`}>
                      {o.includes(" ==> ") ? (
                        <>
                          <span className={last ? "text-hot" : "text-ink"}>{o.split(" ==> ")[0]}</span>
                          <span className="text-faint"> ==&gt; </span>
                          <span className="text-hi">{o.split(" ==> ")[1]}</span>
                        </>
                      ) : (
                        o
                      )}
                    </div>
                  ))}
              </div>
            );
          })}
          {done && (
            <div className="whitespace-pre">
              <span className="text-faint">jshell&gt; </span>
              <span className="inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-ink/50" />
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
        {cur.note}
      </p>
      <StepControls s={s} className="mt-1" />
    </div>
  );
}
