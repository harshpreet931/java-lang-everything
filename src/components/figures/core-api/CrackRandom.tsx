"use client";

import { useState } from "react";
import { CodePanel } from "./kit";

// java.util.Random, ported bit for bit: a 48-bit linear congruential generator.
//   seed = (seed * 0x5DEECE66D + 0xB) mod 2^48,  nextInt() = top 32 bits of seed
// checked against jdk 25: new Random(42) → -1170105035 234785527 -1360544799 205897768 1325939940.
// one nextInt() leaks 32 of the 48 bits. the other 16 are brute-forced (65,536 tries, a few ms)
// using the second output to confirm. after that, every future number is known.

const M = 0x5deece66dn;
const A = 0xbn;
const MASK = (1n << 48n) - 1n;

const step = (s: bigint) => (s * M + A) & MASK;
const out = (s: bigint) => Number(BigInt.asIntN(32, s >> 16n));

function freshSeed(): bigint {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return ((BigInt(b[0]) << 16n) ^ BigInt(b[1])) & MASK;
}

function crack(i1: number, i2: number): { state: bigint; tries: number } | null {
  const hi = (BigInt(i1) & 0xffffffffn) << 16n;
  for (let lo = 0n; lo < 65536n; lo++) {
    const s = hi | lo;
    if (out(step(s)) === i2) return { state: step(s), tries: Number(lo) + 1 };
  }
  return null;
}

type S = { state: bigint; seen: number[]; predicted: number[] | null; actual: number[]; tries: number; ms: number };

const fmt = (n: number) => n.toLocaleString("en-US");

export function CrackRandom() {
  const [s, set] = useState<S | null>(null);

  const start = () => {
    let st = freshSeed();
    const seen: number[] = [];
    for (let i = 0; i < 2; i++) {
      st = step(st);
      seen.push(out(st));
    }
    set({ state: st, seen, predicted: null, actual: [], tries: 0, ms: 0 });
  };

  const predict = () => {
    if (!s) return;
    const t0 = performance.now();
    const c = crack(s.seen[0], s.seen[1]);
    const ms = performance.now() - t0;
    if (!c) return;
    let p = c.state;
    const predicted: number[] = [];
    for (let i = 0; i < 5; i++) {
      p = step(p);
      predicted.push(out(p));
    }
    set({ ...s, predicted, tries: c.tries, ms });
  };

  const reveal = () => {
    if (!s) return;
    let st = s.state;
    const actual: number[] = [];
    for (let i = 0; i < 5; i++) {
      st = step(st);
      actual.push(out(st));
    }
    set({ ...s, actual });
  };

  return (
    <div className="font-mono @container grid gap-5">
      <CodePanel
        file="Server.java"
        code={`var rnd = new Random();        // seeded from the clock. you can't see it.\nint a = rnd.nextInt();         // printed in a url, a game, a "random" id...\nint b = rnd.nextInt();`}
      />

      <div className="flex flex-wrap gap-1.5">
        <button className="act solid" onClick={start}>
          {s ? "new Random() again" : "new Random()"}
        </button>
        <button className="act" onClick={predict} disabled={!s || !!s.predicted}>
          predict the next 5
        </button>
        <button className="act" onClick={reveal} disabled={!s || !s.predicted || s.actual.length > 0}>
          call nextInt() 5 more times
        </button>
      </div>

      <div className="grid gap-4 @[600px]:grid-cols-3" aria-live="polite">
        <Col title="what you saw">
          {s ? s.seen.map((v, i) => <Num key={i} v={v} />) : <Hint>press new Random()</Hint>}
        </Col>
        <Col title="predicted from those two">
          {s?.predicted ? s.predicted.map((v, i) => <Num key={i} v={v} tone="hot" />) : <Hint>{s ? "press predict" : "·"}</Hint>}
        </Col>
        <Col title="what Random actually returns">
          {s && s.actual.length ? (
            s.actual.map((v, i) => <Num key={i} v={v} tone={s.predicted?.[i] === v ? "live" : "dead"} />)
          ) : (
            <Hint>{s?.predicted ? "now call it" : "·"}</Hint>
          )}
        </Col>
      </div>

      <p className="min-h-[3.4em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 text-mute">
        {s?.predicted
          ? `one output leaks 32 of the 48 bits of state. the other 16 took ${fmt(s.tries)} guesses (${s.ms.toFixed(1)} ms in your browser), checked against the second output. ${
              s.actual.length ? (s.actual.every((v, i) => v === s.predicted![i]) ? "all five match." : "") : ""
            }`
          : "this is java.util.Random's exact algorithm, running in your browser. the seed comes from your browser's crypto api, so even this page doesn't know it."}
      </p>
    </div>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="mb-2 text-11 text-faint">{title}</div>
      <div className="grid gap-1 text-13">{children}</div>
    </div>
  );
}

function Num({ v, tone }: { v: number; tone?: "hot" | "live" | "dead" }) {
  return (
    <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
      {v}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-12 text-faint">{children}</span>;
}
