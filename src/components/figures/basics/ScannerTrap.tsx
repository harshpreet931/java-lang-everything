"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Row, Words } from "@/components/figures/basics/kit";

// what Scanner actually does with the characters you type. input: "42⏎duke⏎".
// both programs were run on jdk 25 with exactly that input:
//   trap → "age? name? 42 []", fix → "age? name? 42 [duke]".

type Mode = "trap" | "fix";

const INPUT = ["4", "2", "⏎", "d", "u", "k", "e", "⏎"];

const CODE: Record<Mode, string> = {
  trap: `var in = new Scanner(System.in);
IO.print("age? ");
int age = in.nextInt();
IO.print("name? ");
String name = in.nextLine();
IO.println(age + " [" + name + "]");`,
  fix: `var in = new Scanner(System.in);
IO.print("age? ");
int age = Integer.parseInt(in.nextLine());
IO.print("name? ");
String name = in.nextLine();
IO.println(age + " [" + name + "]");`,
};

type Step = { line: number; read: number; got?: string; out: string; note: string; left?: boolean };

const STEPS: Record<Mode, Step[]> = {
  trap: [
    { line: 1, read: 0, out: "", note: "you type 42, enter, duke, enter. it all lands in one buffer, and the scanner reads it with a cursor." },
    { line: 3, read: 2, got: "42", out: "age? ", note: "nextInt() reads the digits and stops right before the ⏎. it doesn't want the newline, so it leaves it there." },
    { line: 5, read: 3, got: '""', out: "age? name? ", note: "nextLine() means \"everything up to the next ⏎\". the very next character IS a ⏎, so it returns an empty string, eats the ⏎, and never waits for you." },
    { line: 6, read: 3, out: "age? name? 42 []", left: true, note: "name is empty, and \"duke\" is still sitting unread in the buffer. the program didn't skip your input, it read a different line than you thought." },
  ],
  fix: [
    { line: 1, read: 0, out: "", note: "same input, same buffer." },
    { line: 3, read: 3, got: '"42"', out: "age? ", note: "read the whole line, ⏎ included, and parse it yourself. the cursor ends up at the start of the next line, where it should be." },
    { line: 5, read: 8, got: '"duke"', out: "age? name? ", note: "nextLine() now starts at \"duke\" and reads to its ⏎." },
    { line: 6, read: 8, out: "age? name? 42 [duke]", note: "every line read as a line. no leftovers." },
  ],
};

export function ScannerTrap() {
  const [mode, setMode] = useState<Mode>("trap");
  return (
    <div className="font-mono text-13">
      <Row k="program =" last>
        <Words
          options={[
            { v: "trap", label: "nextInt, then nextLine" },
            { v: "fix", label: "nextLine every time" },
          ]}
          value={mode}
          onChange={setMode}
          label="which program"
        />
      </Row>
      <Walk key={mode} mode={mode} />
    </div>
  );
}

function Walk({ mode }: { mode: Mode }) {
  const steps = STEPS[mode];
  const s = useStepper(steps.length, { interval: 2200 });
  const st = steps[s.i];
  const prevRead = s.i > 0 ? steps[s.i - 1].read : 0;

  return (
    <div {...s.keys} className="mt-4 outline-none">
      <div className="grid gap-5 @container sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CodePanel file="Main.java" code={CODE[mode]} hot={[st.line]} />
        <div className="grid content-start gap-4">
          <div>
            <div className="mb-1.5 text-11 text-faint">input buffer</div>
            <div className="flex">
              {INPUT.map((ch, i) => {
                const consumed = i < st.read;
                const justNow = consumed && i >= prevRead;
                const leftover = st.left && !consumed;
                return (
                  <span key={i} className="relative flex flex-col items-center">
                    <span
                      className="-ml-px flex h-8 w-7 items-center justify-center text-13 transition-[background-color,color,opacity] duration-200"
                      style={{
                        boxShadow: `inset 0 0 0 1px ${justNow ? "var(--hot)" : leftover ? "var(--dead)" : "var(--line-2)"}`,
                        background: justNow ? "color-mix(in srgb, var(--hot) 14%, transparent)" : undefined,
                        color: leftover ? "var(--dead)" : consumed ? "var(--faint)" : ch === "⏎" ? "var(--mute)" : "var(--hi)",
                        opacity: consumed && !justNow ? 0.45 : 1,
                      }}
                    >
                      {ch}
                    </span>
                    {i === st.read && <span className="mt-0.5 text-11 leading-3 text-ref">↑</span>}
                  </span>
                );
              })}
              {st.read === INPUT.length && <span className="ml-1 self-start text-11 leading-8 text-ref">↑ end</span>}
            </div>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-12">
            <span className="text-faint">returned</span>
            <span className={st.got === undefined ? "text-faint" : st.got === '""' ? "text-dead" : "text-hot"}>{st.got ?? "·"}</span>
          </div>
          <div className="rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="text-11 text-faint">stdout</div>
            <div className="min-h-[1.5em] whitespace-pre text-ink">{st.out || "·"}</div>
          </div>
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-1" />
    </div>
  );
}
