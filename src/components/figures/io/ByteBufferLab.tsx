"use client";

import { useMemo, useState, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Row, Words, ring, tint, NARR } from "./kit";

// a ByteBuffer's three cursors, live. the semantics match java.nio.Buffer exactly, and the
// walk-through below was checked against jdk 25 (the printout is in the chapter):
//   allocate(8) → put H,E,L,L,O (pos 5) → flip (pos 0, lim 5) → get H, get E (pos 2)
//   → compact: [LLOLO...] pos 3 lim 8 → put ! : [LLO!O...] → flip (pos 0, lim 4)
//   → drain "LLO!" (pos 4) → get: BufferUnderflowException → clear (pos 0, lim 8, bytes untouched)

const CAP = 8;

// `writing` isn't part of java's Buffer, it's what the programmer is doing: after allocate, clear
// and compact you're filling (position..limit is free room), after flip you're draining.
type St = { data: (string | null)[]; pos: number; lim: number; mark: number; out: string; writing: boolean; err?: string };

const fresh = (): St => ({ data: Array(CAP).fill(null), pos: 0, lim: CAP, mark: -1, out: "", writing: true });

type OpName = "put" | "get" | "flip" | "compact" | "clear" | "rewind" | "mark" | "reset";

function apply(s: St, op: OpName, arg?: string): St {
  const n: St = { ...s, data: [...s.data], err: undefined };
  switch (op) {
    case "put":
      if (n.pos >= n.lim) return { ...n, err: "BufferOverflowException" };
      n.data[n.pos++] = arg ?? "?";
      return n;
    case "get":
      if (n.pos >= n.lim) return { ...n, err: "BufferUnderflowException" };
      n.out += n.data[n.pos++] ?? "·";
      return n;
    case "flip":
      return { ...n, lim: n.pos, pos: 0, mark: -1, writing: false };
    case "compact": {
      const rem = n.data.slice(n.pos, n.lim);
      rem.forEach((c, i) => (n.data[i] = c));
      return { ...n, pos: rem.length, lim: CAP, mark: -1, writing: true };
    }
    case "clear":
      return { ...n, pos: 0, lim: CAP, mark: -1, writing: true };
    case "rewind":
      return { ...n, pos: 0, mark: -1 };
    case "mark":
      return { ...n, mark: n.pos };
    case "reset":
      if (n.mark < 0) return { ...n, err: "InvalidMarkException" };
      return { ...n, pos: n.mark };
  }
}

/* ---- the guided walk ----------------------------------------------------------- */

type Step = { code: string; ops: [OpName, string?][]; note: ReactNode };

const WALK: Step[] = [
  { code: "ByteBuffer buf = ByteBuffer.allocate(8);", ops: [], note: <>a fresh buffer: 8 zeroed bytes. position 0, limit and capacity 8. everything between position and limit is room to write.</> },
  { code: "buf.put((byte) 'H');", ops: [["put", "H"]], note: <>put writes at position, then moves position one to the right. that&apos;s the only bookkeeping a write does.</> },
  { code: 'buf.put("ELLO".getBytes());', ops: [["put", "E"], ["put", "L"], ["put", "L"], ["put", "O"]], note: <>a bulk put is the same thing four times. position is now 5: the next free byte.</> },
  { code: "buf.flip();", ops: [["flip"]], note: <>the famous one. limit jumps to where you stopped writing, position goes back to 0. now position..limit is exactly the 5 bytes you wrote, ready to be read.</> },
  { code: "buf.get();   // 'H'", ops: [["get"]], note: <>get reads at position and moves it right. same cursor, other direction of travel.</> },
  { code: "buf.get();   // 'E'", ops: [["get"]], note: <>3 bytes left to read. say the channel on the other end is full and can&apos;t take them yet. you want to write more without losing L, L, O.</> },
  { code: "buf.compact();", ops: [["compact"]], note: <>compact copies the unread bytes to the front, puts position right after them, and limit back at capacity. the old L, O at 3 and 4 are leftovers. nobody erases them, they just get overwritten.</> },
  { code: "buf.put((byte) '!');", ops: [["put", "!"]], note: <>back in writing mode, appending after what was unread. this flip → drain → compact loop is how every channel copy works.</> },
  { code: "buf.flip();", ops: [["flip"]], note: <>flip again: limit 4, position 0. readable = L L O !.</> },
  { code: "while (buf.hasRemaining()) out.append((char) buf.get());", ops: [["get"], ["get"], ["get"], ["get"]], note: <>drained. position caught up with limit, remaining() is 0.</> },
  { code: "buf.get();", ops: [["get"]], note: <>read past the limit and java refuses. the bytes after index 4 exist, but limit says they aren&apos;t yours to read.</> },
  { code: "buf.clear();", ops: [["clear"]], note: <>clear doesn&apos;t clear anything. it resets position to 0 and limit to capacity. the old bytes are still sitting there, ready to be overwritten.</> },
];

/* ---- drawing ---------------------------------------------------------------- */

function BufferView({ s, prev }: { s: St; prev?: St }) {
  const ptrs: { name: string; at: number; changed: boolean }[] = [
    { name: "position", at: s.pos, changed: !!prev && prev.pos !== s.pos },
    { name: "limit", at: s.lim, changed: !!prev && prev.lim !== s.lim },
    { name: "capacity", at: CAP, changed: false },
  ];
  if (s.mark >= 0) ptrs.push({ name: "mark", at: s.mark, changed: !!prev && prev.mark !== s.mark });
  // stack pointers that land on the same index
  const byAt = new Map<number, typeof ptrs>();
  ptrs.forEach((p) => byAt.set(p.at, [...(byAt.get(p.at) ?? []), p]));

  const rem = s.lim - s.pos;
  return (
    <div className="mx-auto w-full max-w-[560px] select-none">
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${CAP}, minmax(0, 1fr))` }}>
        {s.data.map((c, i) => {
          const inRem = i >= s.pos && i < s.lim;
          const changed = prev && prev.data[i] !== c;
          // your data: what's been written (filling) or what's left to read (draining)
          const bright = s.writing ? i < s.pos : inRem;
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="-ml-px flex h-11 w-full items-center justify-center text-15 tabular transition-[box-shadow,background-color,color,opacity] duration-200 ease-jle"
                style={{
                  boxShadow: changed ? ring("hot") : inRem ? ring("live", 75) : ring("line-2"),
                  background: changed ? tint("hot", 14) : inRem ? tint("live", 8) : undefined,
                  color: c === null ? "var(--faint)" : changed ? "var(--hot)" : bright ? "var(--hi)" : "var(--mute)",
                  opacity: !changed && c !== null && !bright ? 0.6 : 1,
                  zIndex: changed || inRem ? 1 : 0,
                }}
              >
                {c ?? "·"}
              </div>
              <div className="mt-1 text-[10px] leading-3 text-faint tabular">{i}</div>
            </div>
          );
        })}
      </div>

      {/* remaining bracket */}
      <div className="relative mt-1 h-5">
        {rem > 0 && (
          <div
            className="absolute top-0 h-2 border-x border-b transition-[left,width] duration-200 ease-jle"
            style={{ left: `${(s.pos / CAP) * 100}%`, width: `${(rem / CAP) * 100}%`, borderColor: "color-mix(in srgb, var(--live) 70%, transparent)" }}
          />
        )}
        <div
          className="absolute top-2.5 text-[10px] whitespace-nowrap text-live transition-[left] duration-200 ease-jle"
          style={{ left: `${(Math.min(s.pos, CAP - 2.5) / CAP) * 100}%` }}
        >
          remaining() = {rem}
          <span className="text-faint"> · {s.writing ? "room to write" : "left to read"}</span>
        </div>
      </div>

      {/* pointers */}
      <div className="relative mt-1 h-[74px]">
        {[...byAt.entries()].map(([at, ps]) => (
          <div
            key={at}
            className={`absolute top-0 flex flex-col transition-[left] duration-200 ease-jle ${
              at === 0 ? "items-start" : at === CAP ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"
            }`}
            style={{ left: `${(at / CAP) * 100}%` }}
          >
            <span className="text-12 leading-3" style={{ color: ps.some((p) => p.changed) ? "var(--hot)" : "var(--ref)" }}>
              ↑
            </span>
            {ps.map((p) => (
              <span
                key={p.name}
                className="text-[11px] leading-[15px] whitespace-nowrap"
                style={{ color: p.changed ? "var(--hot)" : "var(--ref)" }}
              >
                {p.name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Readout({ s }: { s: St }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-12 tabular">
      <span className="text-faint">
        position = <span className="text-hi">{s.pos}</span>
      </span>
      <span className="text-faint">
        limit = <span className="text-hi">{s.lim}</span>
      </span>
      <span className="text-faint">
        capacity = <span className="text-hi">{CAP}</span>
      </span>
      {s.mark >= 0 && (
        <span className="text-faint">
          mark = <span className="text-hi">{s.mark}</span>
        </span>
      )}
      <span className="text-faint">
        read so far = <span className="text-hi">{s.out ? `"${s.out}"` : "·"}</span>
      </span>
    </div>
  );
}

/* ---- the figure ----------------------------------------------------------------- */

export function ByteBufferLab() {
  const [mode, setMode] = useState<"walk" | "play">("walk");
  return (
    <div className="@container text-13">
      <Row k="mode =" w="7ch" last>
        <Words
          label="mode"
          options={[
            { v: "walk", label: "walk through" },
            { v: "play", label: "play" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Row>
      <div className="mt-4">{mode === "walk" ? <Walk /> : <Play />}</div>
    </div>
  );
}

function Walk() {
  const states = useMemo(() => {
    const out: St[] = [];
    let s = fresh();
    for (const st of WALK) {
      for (const [op, a] of st.ops) s = apply(s, op, a);
      out.push(s);
    }
    return out;
  }, []);
  const s = useStepper(WALK.length, { interval: 2200 });
  const st = states[s.i];
  const prev = s.i > 0 ? states[s.i - 1] : undefined;

  return (
    <div {...s.keys} className="outline-none">
      <div className="overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
        <ol className="max-h-[132px] overflow-y-auto py-2 text-12 leading-[1.75]">
          {WALK.slice(0, s.i + 1)
            .map((w, i) => ({ w, i }))
            .slice(-5)
            .map(({ w, i }) => (
              <li
                key={i}
                className="grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 whitespace-pre"
                style={{
                  borderColor: i === s.i ? (st.err ? "var(--dead)" : "var(--hot)") : "transparent",
                  background: i === s.i ? tint(st.err ? "dead" : "hot", 9) : undefined,
                  opacity: i === s.i ? 1 : 0.6,
                }}
              >
                <span className="text-right text-faint tabular">{i + 1}</span>
                <span className="overflow-x-auto">
                  <Java code={w.code} />
                </span>
              </li>
            ))}
        </ol>
      </div>
      <div className="mt-6">
        <BufferView s={st} prev={st.err ? st : prev} />
      </div>
      <Readout s={st} />
      <p className={`mt-4 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {st.err && <span className="text-dead">java.nio.{st.err}. </span>}
        {WALK[s.i].note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

const LETTERS = "JAVA.NIO!";

function Play() {
  const [hist, setHist] = useState<{ s: St; code: string }[]>([{ s: fresh(), code: "ByteBuffer buf = ByteBuffer.allocate(8);" }]);
  const [n, setN] = useState(0);
  const cur = hist[hist.length - 1];
  const prev = hist.length > 1 ? hist[hist.length - 2].s : undefined;

  const run = (op: OpName) => {
    const letter = LETTERS[n % LETTERS.length];
    const next = apply(cur.s, op, letter);
    const code =
      op === "put" ? `buf.put((byte) '${letter}');` : op === "get" ? `buf.get();${next.err ? "" : `   // '${next.out.slice(-1)}'`}` : `buf.${op}();`;
    if (op === "put" && !next.err) setN((x) => x + 1);
    setHist((h) => [...h.slice(-30), { s: next.err ? { ...cur.s, err: next.err } : next, code }]);
  };

  const ops: OpName[] = ["put", "get", "flip", "compact", "clear", "rewind", "mark", "reset"];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {ops.map((o) => (
          <button key={o} className={`act ${o === "flip" ? "solid" : ""}`} onClick={() => run(o)}>
            {o}()
          </button>
        ))}
        <button
          className="act ml-auto"
          onClick={() => {
            setHist([{ s: fresh(), code: "ByteBuffer buf = ByteBuffer.allocate(8);" }]);
            setN(0);
          }}
        >
          reset all
        </button>
      </div>
      <BufferView s={cur.s} prev={cur.s.err ? cur.s : prev} />
      <Readout s={cur.s} />
      <div
        className="mt-4 rounded-md bg-well px-4 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]"
        style={{ boxShadow: cur.s.err ? ring("dead") : undefined }}
        aria-live="polite"
      >
        <Java code={cur.code} />
        {cur.s.err && <div className="mt-1 text-dead">java.nio.{cur.s.err}</div>}
      </div>
      <p className="mt-3 font-serif text-15 text-mute italic">
        put writes the next letter of &quot;{LETTERS}&quot;. try: put a few, get one without flipping first (you read a zero byte, not your data).
      </p>
    </div>
  );
}
