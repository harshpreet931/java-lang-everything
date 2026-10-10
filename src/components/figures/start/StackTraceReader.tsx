"use client";

import { useState, type ReactNode } from "react";
import { Row, Words } from "@/components/figures/basics/kit";

// two real stack traces from jdk 25.0.4.1 (javac -g, so local names show up in the NPE message).
// hover or tap a line to read what it's telling you.

type Line = { text: string; kind: "out" | "head" | "mine" | "jdk" | "cause" | "more"; what: ReactNode };

const NPE: Line[] = [
  {
    text: "sending to example.com",
    kind: "out",
    what: <>normal output. the first call worked, so the bug isn&apos;t &quot;it never works&quot;, it&apos;s &quot;it breaks for some inputs&quot;.</>,
  },
  {
    text: 'Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.indexOf(int)" because "email" is null',
    kind: "head",
    what: (
      <>
        the headline: which thread died (<code>main</code>), the exception type, and the message. since java 14 a{" "}
        <code>NullPointerException</code> says exactly what was null: the variable <code>email</code>.
      </>
    ),
  },
  {
    text: "\tat Main.domainOf(Main.java:8)",
    kind: "mine",
    what: (
      <>
        the <span className="text-hi">top frame</span>: where it was thrown. read it as class.method(file:line). line 8 of Main.java is
        where you look first.
      </>
    ),
  },
  {
    text: "\tat Main.sendWelcome(Main.java:12)",
    kind: "mine",
    what: <>who called <code>domainOf</code>: <code>sendWelcome</code>, at line 12. each line down is one call further back in time.</>,
  },
  {
    text: "\tat Main.main(Main.java:17)",
    kind: "mine",
    what: (
      <>
        the bottom frame, where it all started. line 17 is <code>sendWelcome(&quot;linus&quot;)</code>: a user with no email. the cause
        is here, the crash is 3 frames up.
      </>
    ),
  },
];

const CAUSE: Line[] = [
  {
    text: "Exception in thread \"main\" java.lang.IllegalArgumentException: bad port: 80a",
    kind: "head",
    what: <>the exception that escaped <code>main</code>. its message is the one our catch block wrote.</>,
  },
  { text: "\tat Main.parsePort(Main.java:6)", kind: "mine", what: <>thrown here: line 6 is our <code>throw new IllegalArgumentException(...)</code>.</> },
  { text: "\tat Main.main(Main.java:11)", kind: "mine", what: <>called from <code>main</code>, line 11.</> },
  {
    text: 'Caused by: java.lang.NumberFormatException: For input string: "80a"',
    kind: "cause",
    what: (
      <>
        the original problem, attached as the <span className="text-hi">cause</span>. when you wrap an exception, always pass the old
        one along, or this whole section disappears.
      </>
    ),
  },
  {
    text: "\tat java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)",
    kind: "jdk",
    what: (
      <>
        <code>java.base/</code> means JDK code, from the module <code>java.base</code>. it&apos;s almost never where the bug is: skim down
        to the first line that&apos;s yours.
      </>
    ),
  },
  {
    text: "\tat java.base/java.lang.Integer.parseInt(Integer.java:565)",
    kind: "jdk",
    what: <>still JDK. <code>parseInt(String, int radix)</code>, the one that does the work.</>,
  },
  {
    text: "\tat java.base/java.lang.Integer.parseInt(Integer.java:662)",
    kind: "jdk",
    what: <>still JDK. <code>parseInt(String)</code> just calls the radix version with 10. two frames, two overloads.</>,
  },
  {
    text: "\tat Main.parsePort(Main.java:4)",
    kind: "mine",
    what: (
      <>
        the first line that&apos;s yours: line 4, <code>Integer.parseInt(s)</code>. that&apos;s where <code>&quot;80a&quot;</code> went in.
        this is the line to fix.
      </>
    ),
  },
  {
    text: "\t... 1 more",
    kind: "more",
    what: <>the rest of this trace is the same as the one above it (<code>Main.main</code> at line 11), so java doesn&apos;t print it twice.</>,
  },
];

const TRACES = { npe: NPE, cause: CAUSE } as const;

export function StackTraceReader() {
  const [which, setWhich] = useState<keyof typeof TRACES>("npe");
  const [sel, setSel] = useState(1);
  const lines = TRACES[which];
  const cur = lines[Math.min(sel, lines.length - 1)];

  const color = (k: Line["kind"]) =>
    k === "head" || k === "cause" ? "var(--dead)" : k === "mine" ? "var(--hi)" : k === "out" ? "var(--ink)" : "var(--faint)";

  return (
    <div className="font-mono text-13">
      <Row k="trace =" w="9ch">
        <Words
          options={[
            { v: "npe", label: "a null" },
            { v: "cause", label: "a wrapped cause" },
          ]}
          value={which}
          onChange={(v) => {
            setWhich(v);
            setSel(v === "npe" ? 1 : 0);
          }}
          label="which stack trace"
        />
      </Row>
      <div className="mt-4 overflow-x-auto rounded-md bg-well py-2.5 shadow-[inset_0_0_0_1px_var(--line)]" role="list">
        {lines.map((l, i) => (
          <button
            key={`${which}-${i}`}
            role="listitem"
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onClick={() => setSel(i)}
            className="block w-full min-w-max border-l-2 px-[14px] py-[3px] text-left text-12 leading-[1.6] whitespace-pre transition-colors duration-150"
            style={{
              color: color(l.kind),
              borderColor: i === sel ? "var(--hot)" : "transparent",
              background: i === sel ? "color-mix(in srgb, var(--hot) 9%, transparent)" : undefined,
            }}
          >
            {l.text.replace("\t", "    ")}
          </button>
        ))}
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
        {cur.what}
      </p>
    </div>
  );
}
