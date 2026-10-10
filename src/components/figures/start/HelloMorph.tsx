"use client";

import { Fragment, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java } from "@/components/figures/basics/kit";

// java 25's compact hello world, growing one keyword at a time into the classic one.
// ⟦…⟧ marks what's new in that step. every step is a program that compiles and runs on jdk 25.

const STEPS: { code: string; note: ReactNode; tag: string }[] = [
  {
    tag: "java 25",
    code: `void main() {
    IO.println("hello, world");
}`,
    note: (
      <>
        a complete program. save it as <code>Main.java</code>, run <code>java Main.java</code>. no class, no <code>static</code>, no{" "}
        <code>String[] args</code>.
      </>
    ),
  },
  {
    tag: "+ class",
    code: `⟦class Main {⟧
    void main() {
        IO.println("hello, world");
    }
⟦}⟧`,
    note: (
      <>
        every method in java lives in a class. the compact file had one too: javac wrote it for you, named it after the file and
        made it <code>final</code>.
      </>
    ),
  },
  {
    tag: "+ static",
    code: `class Main {
    ⟦static⟧ void main() {
        IO.println("hello, world");
    }
}`,
    note: (
      <>
        <code>static</code>: the method belongs to the class, not to an object, so the JVM can call it before any object exists.
        without it, the launcher quietly does <code>new Main()</code> first.
      </>
    ),
  },
  {
    tag: "+ args",
    code: `class Main {
    static void main(⟦String[] args⟧) {
        IO.println("hello, world");
    }
}`,
    note: (
      <>
        <code>String[] args</code>: whatever you type after the class name. <code>java Main.java a b</code> gives you{" "}
        <code>{`{"a", "b"}`}</code>. optional since 25, required before.
      </>
    ),
  },
  {
    tag: "+ System.out",
    code: `class Main {
    static void main(String[] args) {
        ⟦System.out⟧.println("hello, world");
    }
}`,
    note: (
      <>
        <code>System.out</code> is the classic way to print: a <code>static</code> field called <code>out</code> on the class{" "}
        <code>System</code>, holding a <code>PrintStream</code>. <code>IO.println</code> (new in 25) prints through the same
        stream.
      </>
    ),
  },
  {
    tag: "+ public",
    code: `⟦public⟧ class Main {
    ⟦public⟧ static void main(String[] args) {
        System.out.println("hello, world");
    }
}`,
    note: (
      <>
        <code>public</code>: visible from anywhere. before 25 the launcher refused any main that wasn&apos;t exactly{" "}
        <code>public static void main(String[] args)</code>. this is the one in every book and every codebase. same program.
      </>
    ),
  },
];

function renderLine(line: string, key: number) {
  // split on ⟦…⟧, highlight the marked parts
  const parts = line.split(/(⟦[^⟧]*⟧)/);
  return (
    <Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith("⟦") ? (
          <span
            key={i}
            className="flash rounded-md"
            style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--hot) 55%, transparent)", background: "color-mix(in srgb, var(--hot) 14%, transparent)" }}
          >
            <Java code={p.slice(1, -1)} />
          </span>
        ) : (
          <Java key={i} code={p} />
        ),
      )}
    </Fragment>
  );
}

export function HelloMorph() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const step = STEPS[s.i];
  const lines = step.code.split("\n");

  return (
    <div {...s.keys} className="font-mono outline-none" aria-label="hello world, from compact to classic">
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="jump to a step">
        {STEPS.map((x, i) => (
          <button
            key={x.tag}
            className="word !min-h-7 !px-2 !text-12"
            aria-pressed={i === s.i}
            onClick={() => s.go(i)}
          >
            {x.tag}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
          <span className="text-ink">Main.java</span>
          <span className="text-11 text-faint tabular">
            {lines.length} lines · {step.code.replace(/[⟦⟧]/g, "").length} chars
          </span>
        </div>
        <pre className="min-h-[9.6em] overflow-x-auto px-4 py-3 text-13 leading-[1.75]">
          {lines.map((l, i) => (
            <div key={`${s.i}-${i}`}>{renderLine(l, i)}</div>
          ))}
        </pre>
      </div>
      <p className="mt-4 min-h-[4.8em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
        {step.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
