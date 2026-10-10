"use client";

import { useState, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { NARR, Row, Words, ring, tint } from "./kit";

// one document, three ways to read it with the JDK's own java.xml parsers.
// the event sequence (start order id=42, start item qty=2, text chai, end item, ...) is what
// SAX and StAX produced on jdk 25 for this document (whitespace-only text left out).

type Mode = "dom" | "sax" | "stax";

type Tok = { kind: "start" | "text" | "end"; name: string; attr?: string; line: number };

const TOKS: Tok[] = [
  { kind: "start", name: "order", attr: 'id="42"', line: 0 },
  { kind: "start", name: "item", attr: 'qty="2"', line: 1 },
  { kind: "text", name: "chai", line: 1 },
  { kind: "end", name: "item", line: 1 },
  { kind: "start", name: "item", attr: 'qty="1"', line: 2 },
  { kind: "text", name: "samosa", line: 2 },
  { kind: "end", name: "item", line: 2 },
  { kind: "end", name: "order", line: 3 },
];

const XML = ['<order id="42">', '  <item qty="2">chai</item>', '  <item qty="1">samosa</item>', "</order>"];

const SAX_CB: Record<Tok["kind"], string> = { start: "startElement", text: "characters", end: "endElement" };
const STAX_EV: Record<Tok["kind"], string> = { start: "START_ELEMENT", text: "CHARACTERS", end: "END_ELEMENT" };

export function ParseModes() {
  const [mode, setMode] = useState<Mode>("sax");
  const s = useStepper(TOKS.length + 1, { interval: 1200 });
  const n = s.i; // tokens consumed so far
  const cur = n > 0 ? TOKS[n - 1] : undefined;
  const done = n === TOKS.length;

  let right: ReactNode;
  let note: ReactNode;
  if (mode === "dom") {
    right = (
      <div className="text-12 leading-[1.9]">
        <div style={{ opacity: n >= 1 ? 1 : 0.2 }} className={done ? "text-live" : "text-ink"}>
          Document
        </div>
        <div className="pl-4" style={{ opacity: n >= 1 ? 1 : 0.15 }}>
          └ order <span className="text-faint">id=42</span>
        </div>
        <div className="pl-10" style={{ opacity: n >= 2 ? 1 : 0.15 }}>
          ├ item <span className="text-faint">qty=2</span> <span style={{ opacity: n >= 3 ? 1 : 0 }}>· &quot;chai&quot;</span>
        </div>
        <div className="pl-10" style={{ opacity: n >= 5 ? 1 : 0.15 }}>
          └ item <span className="text-faint">qty=1</span> <span style={{ opacity: n >= 6 ? 1 : 0 }}>· &quot;samosa&quot;</span>
        </div>
        <div className="mt-2 rounded-md px-2 py-1 text-11" style={{ boxShadow: ring(done ? "live" : "line"), color: done ? "var(--live)" : "var(--faint)" }}>
          {done ? "parse() returns the whole tree. now your code runs, and can walk it any way it likes." : "your code: still waiting inside parse()"}
        </div>
      </div>
    );
    note = done ? (
      <>DOM gives you the whole document as a tree of objects, random access, editable. the price is memory: every element, attribute and whitespace node is an object.</>
    ) : (
      <>the parser reads the whole input and builds every node before your code sees anything.</>
    );
  } else if (mode === "sax") {
    right = (
      <ol className="grid gap-1 text-12">
        {TOKS.slice(0, n).map((t, i) => (
          <li key={i} className="flex gap-2" style={{ color: i === n - 1 ? "var(--hot)" : "var(--ink)" }}>
            <span className="text-faint">→</span>
            <span>
              handler.{SAX_CB[t.kind]}(<span className="text-mute">{t.kind === "text" ? `"${t.name}"` : t.name}</span>)
            </span>
          </li>
        ))}
        {n === 0 && <li className="text-faint">parse(input, handler): the parser drives.</li>}
      </ol>
    );
    note = cur ? (
      <>
        the parser hit {cur.kind === "text" ? "text" : `a ${cur.kind} tag`} and <em>called you</em>: <code>{SAX_CB[cur.kind]}</code>. you can&apos;t pause it or go back. if you
        need context (&quot;am i inside an item?&quot;), you keep it in your own fields.
      </>
    ) : (
      <>SAX pushes events at your handler as it reads. nothing is kept in memory, so it handles files of any size.</>
    );
  } else {
    right = (
      <ol className="grid gap-1 text-12">
        {TOKS.slice(0, n).map((t, i) => (
          <li key={i} className="flex gap-2" style={{ color: i === n - 1 ? "var(--hot)" : "var(--ink)" }}>
            <span className="text-faint">←</span>
            <span>
              r.next() == {STAX_EV[t.kind]} <span className="text-mute">{t.kind === "text" ? `"${t.name}"` : t.name}</span>
            </span>
          </li>
        ))}
        {n === 0 && <li className="text-faint">while (r.hasNext()): your loop drives.</li>}
      </ol>
    );
    note = cur ? (
      <>
        <em>your loop asked</em> for the next event and got <code>{STAX_EV[cur.kind]}</code>. you can stop whenever you want, skip ahead with{" "}
        <code>getElementText()</code>, or hand the reader to another method.
      </>
    ) : (
      <>StAX is a cursor you pull, like an iterator. streaming like SAX, but the control flow is yours, so the code reads like normal code.</>
    );
  }

  return (
    <div {...s.keys} className="@container text-13 outline-none">
      <Row k="api =" w="6ch" last>
        <Words
          label="parsing api"
          options={[
            { v: "dom", label: "DOM (tree)" },
            { v: "sax", label: "SAX (push)" },
            { v: "stax", label: "StAX (pull)" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Row>
      <div className="mt-4 grid gap-5 @[560px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md bg-well px-3 py-2.5 text-12 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line)]">
          {XML.map((l, i) => (
            <div
              key={i}
              className="rounded-[3px] px-1 whitespace-pre transition-[background-color] duration-200"
              style={{ background: cur && cur.line === i ? tint("hot", 12) : undefined, color: cur && cur.line === i ? "var(--hot)" : "var(--ink)" }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="min-w-0">{right}</div>
      </div>
      <p className={`mt-4 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
