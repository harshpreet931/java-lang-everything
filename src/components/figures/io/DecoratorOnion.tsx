"use client";

import type { ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { ByteCell, Chip, ring, NARR } from "./kit";

// BufferedReader → InputStreamReader → FileInputStream → the file, as nested boxes.
// three readLine() calls on a real 5-byte file (68 69 0a c3 a9 = "hi\né" in UTF-8).
// verified on jdk 25: prints "hi (2 chars)" then "é (1 chars)". the default
// BufferedReader buffer is 8192 chars (DEFAULT_CHAR_BUFFER_SIZE in BufferedReader.java).

type Layer = "br" | "isr" | "fis" | "os";

type S = {
  on: Layer;
  /** what the active layer is doing, as a chip on its box */
  say?: string;
  /** chars in BufferedReader's buffer, and how many were already handed out */
  buf: string[];
  used: number;
  decoded?: boolean;
  bytesHot?: boolean;
  syscalls: number;
  out: (string | null)[];
  note: ReactNode;
  happy?: boolean;
};

const BYTES = [0x68, 0x69, 0x0a, 0xc3, 0xa9];
const CHARS = ["h", "i", "\\n", "é"];

const STEPS: S[] = [
  {
    on: "br",
    say: "readLine()",
    buf: [],
    used: 0,
    syscalls: 0,
    out: [],
    note: (
      <>
        you call <code>in.readLine()</code>. you only ever talk to the outermost layer.
      </>
    ),
  },
  {
    on: "br",
    say: "↓ read(char[8192])",
    buf: [],
    used: 0,
    syscalls: 0,
    out: [],
    note: <>its buffer is empty and it can&apos;t build a line out of nothing, so it asks the layer inside for up to 8192 chars.</>,
  },
  {
    on: "isr",
    say: "↓ read(byte[8192])",
    buf: [],
    used: 0,
    syscalls: 0,
    out: [],
    note: <>InputStreamReader hands out chars but only holds a byte stream. to make chars it needs bytes, so it asks for 8192 of them.</>,
  },
  {
    on: "fis",
    say: "read syscall",
    buf: [],
    used: 0,
    syscalls: 1,
    out: [],
    note: <>FileInputStream is the only layer that touches the OS. one read() here is one system call on the file descriptor.</>,
  },
  {
    on: "os",
    say: "↑ 5 bytes",
    buf: [],
    used: 0,
    bytesHot: true,
    syscalls: 1,
    out: [],
    note: <>the OS hands back what the file has: 5 bytes. it was asked for up to 8192, it returns what exists.</>,
  },
  {
    on: "isr",
    say: "↑ 4 chars",
    buf: [],
    used: 0,
    decoded: true,
    syscalls: 1,
    out: [],
    note: (
      <>
        the UTF-8 decoder turns 5 bytes into 4 chars. <code>c3 a9</code> is two bytes and one char: é.
      </>
    ),
  },
  {
    on: "br",
    say: '↑ "hi"',
    buf: CHARS,
    used: 3,
    decoded: true,
    syscalls: 1,
    out: ["hi"],
    note: (
      <>
        4 chars land in the buffer. readLine() scans to the <code>\n</code>, returns <code>&quot;hi&quot;</code>, and keeps the rest for later.
      </>
    ),
  },
  {
    on: "br",
    say: '↑ "é"',
    buf: CHARS,
    used: 4,
    decoded: true,
    syscalls: 1,
    out: ["hi", "é"],
    happy: true,
    note: <>second readLine(): é is already in the buffer. it comes straight from memory. no syscall, the inner layers never hear about it.</>,
  },
  {
    on: "fis",
    say: "↑ -1",
    buf: CHARS,
    used: 4,
    decoded: true,
    syscalls: 2,
    out: ["hi", "é"],
    note: <>third readLine(): the buffer is used up, so the request goes all the way down again. read() returns -1: end of file.</>,
  },
  {
    on: "br",
    say: "↑ null",
    buf: CHARS,
    used: 4,
    decoded: true,
    syscalls: 2,
    out: ["hi", "é", null],
    note: (
      <>
        -1 travels up as &quot;no more chars&quot; and readLine() returns <code>null</code>. that&apos;s what ends your <code>while</code> loop.
      </>
    ),
  },
];

const LAYERS: Record<Layer, { name: string; adds: string }> = {
  br: { name: "BufferedReader", adds: "adds readLine() and an 8192-char buffer" },
  isr: { name: "InputStreamReader", adds: "adds a charset: bytes → chars" },
  fis: { name: "FileInputStream", adds: "adds a real file. read() = a syscall" },
  os: { name: "the OS · onion.txt", adds: "5 bytes on disk" },
};

export function DecoratorOnion() {
  const s = useStepper(STEPS.length, { interval: 2000 });
  const st = STEPS[s.i];

  // a plain function (not a component) so the nested boxes keep their identity between steps
  const box = (id: Layer, children: ReactNode, inner?: ReactNode, className = "") => {
    const on = st.on === id;
    const tone = id === "os" ? "meta" : on ? (st.happy ? "live" : "hot") : undefined;
    return (
      <div
        className={`min-w-0 rounded-md p-2.5 transition-[box-shadow,background-color] duration-200 ease-jle sm:p-3.5 ${className}`}
        style={{
          boxShadow: on ? ring(st.happy ? "live" : "hot") : id === "os" ? ring("meta", 55) : ring("line-2"),
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-12" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
            {LAYERS[id].name}
          </span>
          {on && st.say ? <Chip tone={st.happy ? "live" : "hot"}>{st.say}</Chip> : <span className="text-11 text-faint">{LAYERS[id].adds}</span>}
        </div>
        {children && <div className="mt-2">{children}</div>}
        {inner && <div className="mt-3">{inner}</div>}
      </div>
    );
  };

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-12">
        <span className="text-faint">
          read syscalls = <span className="text-hi tabular">{st.syscalls}</span>
        </span>
        <span className="text-faint">
          readLine() returned ={" "}
          {st.out.length === 0 ? (
            <span className="text-faint">·</span>
          ) : (
            st.out.map((x, i) => (
              <span key={i} className={x === null ? "text-mute" : "text-live"}>
                {i > 0 && <span className="text-faint">, </span>}
                {x === null ? "null" : `"${x}"`}
              </span>
            ))
          )}
        </span>
      </div>

      {box(
        "br",
        <div className="flex items-center gap-2">
          <span className="text-11 text-faint">buffer</span>
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => {
              const c = st.buf[i];
              const used = c !== undefined && i < st.used;
              return (
                <span
                  key={i}
                  className="-ml-px inline-flex h-7 w-8 shrink-0 flex-col items-center justify-center text-12"
                  style={{
                    boxShadow: ring("line-2"),
                    color: c === undefined ? "var(--faint)" : used ? "var(--mute)" : "var(--hi)",
                    opacity: used ? 0.55 : 1,
                  }}
                >
                  {c ?? "·"}
                </span>
              );
            })}
            <span className="ml-2 text-11 whitespace-nowrap text-faint tabular">… 8192</span>
          </div>
        </div>,
        box(
          "isr",
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-11">
            <span className="text-faint">decoder = UTF-8</span>
            {st.decoded && (
              <span className="flex flex-wrap items-center gap-1 text-mute">
                <span className="tabular">68→h 69→i 0a→\n</span>
                <span className="text-hot">c3 a9→é</span>
              </span>
            )}
          </div>,
          box(
            "fis",
            <div className="text-11 text-faint">
              fd → onion.txt · <span className="tabular">{st.syscalls}</span> syscall{st.syscalls === 1 ? "" : "s"} so far
            </div>,
            box(
              "os",
              <div className="flex flex-wrap gap-1">
                {BYTES.map((b, i) => (
                  <ByteCell key={i} b={b} tone={st.bytesHot ? "hot" : undefined} />
                ))}
              </div>,
              undefined,
              "bg-well",
            ),
          ),
        ),
      )}

      <p className={`mt-5 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
