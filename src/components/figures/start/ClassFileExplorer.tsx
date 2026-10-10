"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// the real Main.class for hello world, compiled by javac 25 (414 bytes).
//   header: ca fe ba be 00 00 00 45 00 1d 0a 00 02 00 03 07 ...
//   main's code attribute: b2 00 07 12 0d b6 00 0f b1   (checked with xxd + javap -c)

type Tab = "bytes" | "code";

const HEADER = [
  { bytes: ["ca", "fe", "ba", "be"], name: "magic", tone: "hot", what: "every class file starts with these four bytes. the JVM refuses anything that doesn't." },
  { bytes: ["00", "00"], name: "minor version", what: "0. only used for preview features (then it's 0xffff)." },
  { bytes: ["00", "45"], name: "major version", tone: "hi", what: "0x45 = 69 = java 25. a java 21 JVM (max 65) refuses to load this file." },
  { bytes: ["00", "1d"], name: "constant pool count", what: "0x1d = 29, so 28 constants follow: class names, method names, the string \"hello, world\"..." },
  { bytes: ["0a", "00", "02", "00", "03"], name: "constant #1", tone: "meta", what: "tag 0x0a = Methodref. points at constant #2 (the class java/lang/Object) and #3 (the name <init> + type ()V). it's how Main's constructor calls super()." },
  { bytes: ["07"], name: "constant #2 …", what: "tag 0x07 = Class. and so on for 26 more constants, then the fields, the methods and their bytecode." },
] as const;

const CODE = [
  {
    at: 0,
    bytes: "b2 00 07",
    op: "getstatic",
    arg: "#7",
    comment: "Field System.out",
    stack: ["System.out"],
    note: "push the value of the static field System.out (a PrintStream) onto the operand stack.",
  },
  {
    at: 3,
    bytes: "12 0d",
    op: "ldc",
    arg: "#13",
    comment: 'String hello, world',
    stack: ["System.out", '"hello, world"'],
    note: "ldc = load constant. push the string from constant #13. the stack now holds both things println needs.",
  },
  {
    at: 5,
    bytes: "b6 00 0f",
    op: "invokevirtual",
    arg: "#15",
    comment: "Method PrintStream.println",
    stack: [],
    out: true,
    note: "pop the receiver and the argument, call println on that PrintStream. it prints. the stack is empty again.",
  },
  {
    at: 8,
    bytes: "b1",
    op: "return",
    arg: "",
    comment: "",
    stack: [],
    out: true,
    note: "return void. main's frame is popped, there's nothing left to run, the JVM exits.",
  },
];

export function ClassFileExplorer() {
  const [tab, setTab] = useState<Tab>("bytes");
  const [h, setH] = useState(2);
  const s = useStepper(CODE.length, { interval: 1600 });
  const cur = CODE[s.i];

  return (
    <div className="font-mono">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">look at =</span>
        <div className="flex gap-1">
          <button className="word" aria-pressed={tab === "bytes"} onClick={() => setTab("bytes")}>
            the first 16 bytes
          </button>
          <button className="word" aria-pressed={tab === "code"} onClick={() => setTab("code")}>
            main&apos;s bytecode
          </button>
        </div>
      </div>

      {tab === "bytes" ? (
        <div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-3 text-14 tabular" role="group" aria-label="header bytes">
            {HEADER.map((g, i) => {
              const on = i === h;
              const tone = "tone" in g ? (g.tone === "hi" ? "var(--hi)" : `var(--${g.tone})`) : "var(--ink)";
              return (
                <button
                  key={g.name}
                  onClick={() => setH(i)}
                  onMouseEnter={() => setH(i)}
                  aria-pressed={on}
                  className="flex flex-col items-start gap-1 rounded-md px-2 py-1.5 transition-[box-shadow] duration-150"
                  style={{ boxShadow: `inset 0 0 0 1px ${on ? "var(--hi)" : "var(--line)"}` }}
                >
                  <span style={{ color: tone }}>{g.bytes.join(" ")}</span>
                  <span className="text-[10px] text-faint">{g.name}</span>
                </button>
              );
            })}
            <span className="self-center text-faint">… 398 more bytes</span>
          </div>
          <p className="mt-5 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
            <span className="text-hi">{HEADER[h].name}:</span> {HEADER[h].what}
          </p>
        </div>
      ) : (
        <div {...s.keys} className="outline-none">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="overflow-x-auto rounded-md bg-well py-3 text-12 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="px-4 pb-1 text-11 text-faint">public static void main(java.lang.String[]);</div>
              {CODE.map((c, i) => (
                <div
                  key={c.at}
                  className="grid min-w-max grid-cols-[3ch_9ch_13ch_4ch_auto] gap-x-2 border-l-2 px-[14px] transition-colors duration-150"
                  style={{
                    borderColor: i === s.i ? "var(--hot)" : "transparent",
                    background: i === s.i ? "color-mix(in srgb, var(--hot) 10%, transparent)" : undefined,
                  }}
                >
                  <span className="text-right text-faint tabular">{c.at}:</span>
                  <span className="text-faint tabular">{c.bytes}</span>
                  <span className={i === s.i ? "text-hot" : "text-hi"}>{c.op}</span>
                  <span className="text-ink">{c.arg}</span>
                  <span className="text-faint">{c.comment && `// ${c.comment}`}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">operand stack</div>
              <div className="flex min-h-[84px] flex-col-reverse justify-start gap-1.5">
                {cur.stack.length === 0 && <div className="text-12 text-faint">empty</div>}
                {cur.stack.map((v, i) => (
                  <div
                    key={`${s.i}-${i}`}
                    className={`rounded-md bg-well px-3 py-1.5 text-12 shadow-[inset_0_0_0_1px_var(--line-2)] ${
                      i === cur.stack.length - 1 && CODE[s.i - 1]?.stack.length !== cur.stack.length ? "obj-in" : ""
                    }`}
                  >
                    <span className="text-ref">→ </span>
                    <span className="text-hi">{v}</span>
                    <span className="ml-2 text-11 text-faint">{v.startsWith('"') ? "a String" : "a PrintStream"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-11 text-faint">stdout</div>
              <div className="text-13 text-hi">{cur.out ? "hello, world" : <span className="text-faint">·</span>}</div>
            </div>
          </div>
          <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
            {cur.note}
          </p>
          <StepControls s={s} className="mt-1" />
        </div>
      )}
    </div>
  );
}
