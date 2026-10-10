"use client";

import { useEffect, useState } from "react";
import { Row, Words } from "../meta/kit";

// the four kinds of Arena in java.lang.foreign, and what happens when you poke a segment
// allocated from each. every message is the real one from jdk 25.

type Kind = "confined" | "shared" | "auto" | "global";
type Action = "owner" | "other" | "close" | "gc";

const KINDS: { id: Kind; code: string; who: string; when: string }[] = [
  { id: "confined", code: "Arena.ofConfined()", who: "the thread that created it", when: "when you call close()" },
  { id: "shared", code: "Arena.ofShared()", who: "any thread", when: "when you call close()" },
  { id: "auto", code: "Arena.ofAuto()", who: "any thread", when: "when the GC finds it unreachable" },
  { id: "global", code: "Arena.global()", who: "any thread", when: "never" },
];

type Outcome = { ok: boolean; text: string; freed?: boolean };

function outcome(k: Kind, a: Action, closed: boolean): Outcome {
  if (closed && k === "auto" && (a === "owner" || a === "other" || a === "gc"))
    return { ok: false, text: "nothing to read it with: no reference left is exactly how it became garbage" };
  if (closed && (a === "owner" || a === "other")) return { ok: false, text: "IllegalStateException: Already closed" };
  switch (a) {
    case "owner":
      return { ok: true, text: "segment.get(JAVA_INT, 0) → 7" };
    case "other":
      return k === "confined" ? { ok: false, text: "WrongThreadException: Attempted access outside owning thread" } : { ok: true, text: "another thread read it → 7" };
    case "close":
      if (k === "auto" || k === "global") return { ok: false, text: "UnsupportedOperationException (it can't be closed)" };
      return closed ? { ok: false, text: "IllegalStateException: Already closed" } : { ok: true, text: "arena.close(): memory freed, right now, every segment invalidated", freed: true };
    case "gc":
      if (k === "auto") return { ok: true, text: "no references left: a later GC frees the memory (when, exactly, is up to the GC)", freed: true };
      if (k === "global") return { ok: true, text: "nothing happens. global memory lives until the JVM exits" };
      return { ok: true, text: "nothing happens. the GC doesn't free confined or shared arenas: forget close() and it leaks" };
  }
}

export function ArenaLifetimes() {
  const [k, setK] = useState<Kind>("confined");
  const [closed, setClosed] = useState(false);
  const [last, setLast] = useState<{ a: Action; o: Outcome } | null>(null);
  useEffect(() => {
    setClosed(false);
    setLast(null);
  }, [k]);
  const kind = KINDS.find((x) => x.id === k)!;

  const act = (a: Action) => {
    const o = outcome(k, a, closed);
    if (o.freed) setClosed(true);
    setLast({ a, o });
  };

  return (
    <div className="@container">
      <Row k="arena =" w="7ch">
        <Words options={KINDS.map((x) => ({ v: x.id, label: x.id }))} value={k} onChange={setK} label="arena kind" />
      </Row>

      <div className="mt-4 grid gap-3 @[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md bg-well px-3 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
          <div className="text-meta">{kind.code}</div>
          <div className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1">
            <span className="text-faint">who can touch it</span>
            <span className="text-ink">{kind.who}</span>
            <span className="text-faint">memory freed</span>
            <span className="text-ink">{kind.when}</span>
          </div>
        </div>
        <div className="rounded-md px-3 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-faint">segment (4 bytes, off-heap)</span>
            <span style={{ color: closed ? "var(--dead)" : "var(--live)" }}>{closed ? "freed" : "alive"}</span>
          </div>
          <div
            className="mt-2 flex h-8 items-center justify-center rounded-[3px] text-12 transition-[background-color,color] duration-200"
            style={{
              background: closed ? "transparent" : "color-mix(in srgb, var(--live) 16%, transparent)",
              boxShadow: `inset 0 0 0 1px ${closed ? "var(--dead)" : "var(--live)"}`,
              borderStyle: closed ? "dashed" : undefined,
              color: closed ? "var(--dead)" : "var(--live)",
            }}
          >
            {closed ? "address no longer valid" : "0x0000 0007"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="act" onClick={() => act("owner")}>read it</button>
        <button className="act" onClick={() => act("other")}>read from another thread</button>
        <button className="act" onClick={() => act("close")}>close()</button>
        <button className="act" onClick={() => act("gc")}>drop every reference</button>
        <button className="act" onClick={() => (setClosed(false), setLast(null))}>start over</button>
      </div>

      <pre className="mt-3 min-h-[3em] overflow-x-auto rounded-md bg-well px-3 py-2 text-12 leading-[1.6] whitespace-pre-wrap shadow-[inset_0_0_0_1px_var(--line)]">
        {last ? <span style={{ color: last.o.ok ? "var(--live)" : "var(--dead)" }}>{last.o.text}</span> : <span className="text-faint">try the buttons. every exception text is the real one.</span>}
      </pre>
    </div>
  );
}
