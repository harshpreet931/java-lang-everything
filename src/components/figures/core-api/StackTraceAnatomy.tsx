"use client";

import { useState, type ReactNode } from "react";

// a real stack trace: Orders.java compiled with javac 25 and run with `java -cp out Orders`
// on temurin 25.0.4. jdk line numbers (Integer.java:565 ...) are from that exact build.

type Part = "head" | "thrown" | "caller" | "cause" | "jdk" | "yours" | "inner" | "more";

const LINES: { text: string; part: Part; indent?: boolean }[] = [
  { text: 'Exception in thread "main" java.lang.IllegalArgumentException: bad order line: A-18, three', part: "head" },
  { text: "at Orders.parse(Orders.java:13)", part: "thrown", indent: true },
  { text: "at Orders.main(Orders.java:19)", part: "caller", indent: true },
  { text: 'Caused by: java.lang.NumberFormatException: For input string: "three"', part: "cause" },
  { text: "at java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)", part: "jdk", indent: true },
  { text: "at java.base/java.lang.Integer.parseInt(Integer.java:565)", part: "jdk", indent: true },
  { text: "at java.base/java.lang.Integer.parseInt(Integer.java:662)", part: "jdk", indent: true },
  { text: "at Orders.parseQty(Orders.java:5)", part: "yours", indent: true },
  { text: "at Orders.parse(Orders.java:11)", part: "inner", indent: true },
  { text: "... 1 more", part: "more", indent: true },
];

const INFO: Record<Part, { title: string; body: ReactNode }> = {
  head: {
    title: "the headline",
    body: (
      <>
        <code>Exception in thread &quot;main&quot;</code> means nothing caught it, so it fell off the bottom of the thread. then the
        class (the <em>kind</em> of problem) and the message (the details). read this first, it&apos;s often the whole answer.
      </>
    ),
  },
  thrown: {
    title: "the top frame: where it was created",
    body: (
      <>
        the newest frame, the method that was running. strictly, it&apos;s where the exception object was <em>constructed</em>: the
        constructor captures the stack. that&apos;s almost always the same line as the <code>throw</code>.
      </>
    ),
  },
  caller: {
    title: "who called it",
    body: <>each line below is one frame further down the stack: the caller, then its caller, all the way to main. read downward to answer &quot;how did we get here?&quot;</>,
  },
  cause: {
    title: "Caused by: the original problem",
    body: (
      <>
        <code>parse</code> caught a <code>NumberFormatException</code> and threw a new exception with the old one as its{" "}
        <em>cause</em>. the bottom-most &quot;Caused by&quot; is usually the root of it all. (more in{" "}
        <a href="/learn/core-api/designing-exceptions">designing with exceptions</a>.)
      </>
    ),
  },
  jdk: {
    title: "frames inside the JDK",
    body: (
      <>
        <code>java.base/</code> is the module. these are real lines in <code>Integer.java</code>, so they&apos;re rarely the bug. skim
        past them to the first frame that&apos;s yours.
      </>
    ),
  },
  yours: {
    title: "the first frame that's yours",
    body: (
      <>
        <code>Orders.java:5</code> is where your code handed <code>&quot;three&quot;</code> to <code>parseInt</code>. in most traces, the
        first line from your own package is where to put the breakpoint.
      </>
    ),
  },
  inner: {
    title: "same method, different line",
    body: (
      <>
        the cause passed through <code>parse</code> at line 11, the call to <code>parseQty</code> inside the <code>try</code>. the
        outer trace says line 13 because that&apos;s where the <em>new</em> exception was created. two traces, two moments.
      </>
    ),
  },
  more: {
    title: "... 1 more",
    body: (
      <>
        the cause&apos;s remaining frames are identical to the bottom of the trace above (<code>Orders.main</code>, line 19), so
        they&apos;re not printed twice.
      </>
    ),
  },
};

const TONE: Partial<Record<Part, string>> = { head: "var(--dead)", cause: "var(--dead)" };

export function StackTraceAnatomy() {
  const [sel, setSel] = useState<Part>("yours");
  const info = INFO[sel];

  return (
    <div className="font-mono grid gap-4">
      <div className="overflow-x-auto rounded-md bg-well py-3 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="mb-1 px-4 text-11 text-faint">stderr · click a line</div>
        <ul className="min-w-max text-12 leading-[1.5]">
          {LINES.map((l, i) => {
            const on = l.part === sel;
            return (
              <li key={i}>
                <button
                  onClick={() => setSel(l.part)}
                  aria-pressed={on}
                  className="block w-full border-l-2 py-[3px] pr-4 text-left whitespace-pre transition-colors duration-150"
                  style={{
                    paddingLeft: l.indent ? 40 : 16,
                    borderColor: on ? "var(--hot)" : "transparent",
                    background: on ? "color-mix(in srgb, var(--hot) 10%, transparent)" : undefined,
                    color: TONE[l.part] ?? (l.part === "jdk" || l.part === "more" ? "var(--faint)" : "var(--ink)"),
                  }}
                >
                  {l.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-h-[7.5em] border-t border-line pt-3 text-13 leading-[1.7]" aria-live="polite">
        <div className="text-hot">{info.title}</div>
        <p className="mt-1 font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-ink [&_a]:text-link [&_code]:text-hi">{info.body}</p>
      </div>
    </div>
  );
}
