"use client";

import { useMemo, useState } from "react";
import { Row, Words, javaDouble } from "@/components/figures/basics/kit";

// what a double actually stores, digit for digit, and where an arithmetic result lands
// among its neighbours. all exact: every double is m × 2^e, so sums and products are done
// with BigInt and printed in full, the same digits new BigDecimal(x) prints in java.

type Frac = { m: bigint; e: number };

export function toFrac(x: number): Frac {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const bits = dv.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const exp = Number((bits >> 52n) & 0x7ffn);
  const mant = bits & 0xfffffffffffffn;
  if (exp === 0) return { m: sign * mant, e: -1074 };
  return { m: sign * (mant | (1n << 52n)), e: exp - 1075 };
}
const align = (a: Frac, b: Frac): [bigint, bigint, number] => {
  const e = Math.min(a.e, b.e);
  return [a.m << BigInt(a.e - e), b.m << BigInt(b.e - e), e];
};
const add = (a: Frac, b: Frac): Frac => {
  const [x, y, e] = align(a, b);
  return { m: x + y, e };
};
const sub = (a: Frac, b: Frac): Frac => {
  const [x, y, e] = align(a, b);
  return { m: x - y, e };
};
const mul = (a: Frac, b: Frac): Frac => ({ m: a.m * b.m, e: a.e + b.e });

export function exact(f: Frac): string {
  const neg = f.m < 0n;
  const m = neg ? -f.m : f.m;
  let s: string;
  if (f.e >= 0) s = (m << BigInt(f.e)).toString();
  else {
    const k = -f.e;
    const digits = (m * 5n ** BigInt(k)).toString().padStart(k + 1, "0");
    s = `${digits.slice(0, digits.length - k)}.${digits.slice(digits.length - k)}`.replace(/0+$/, "").replace(/\.$/, "");
  }
  return (neg ? "-" : "") + s;
}

const nextUp = (x: number) => {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  dv.setBigUint64(0, dv.getBigUint64(0) + 1n);
  return dv.getFloat64(0);
};
const nextDown = (x: number) => {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  dv.setBigUint64(0, dv.getBigUint64(0) - 1n);
  return dv.getFloat64(0);
};

type Case = { id: string; label: string; a: string; b: string; op: "+" | "-" | "*"; want: string };
const CASES: Case[] = [
  { id: "a", label: "0.1 + 0.2", a: "0.1", b: "0.2", op: "+", want: "0.3" },
  { id: "b", label: "0.1 + 0.7", a: "0.1", b: "0.7", op: "+", want: "0.8" },
  { id: "c", label: "1.1 * 1.1", a: "1.1", b: "1.1", op: "*", want: "1.21" },
  { id: "d", label: "0.3 - 0.1", a: "0.3", b: "0.1", op: "-", want: "0.2" },
  { id: "e", label: "0.5 + 0.25", a: "0.5", b: "0.25", op: "+", want: "0.75" },
];

/** splits a stored value's digits where they stop matching what you typed */
function Digits({ typed, stored, tone = "hot" }: { typed: string; stored: string; tone?: "hot" | "dead" | "live" }) {
  let i = 0;
  const padded = typed.includes(".") ? typed.padEnd(stored.length, "0") : typed;
  while (i < stored.length && stored[i] === padded[i]) i++;
  if (i >= stored.length) return <span className="text-hi">{stored}</span>;
  return (
    <span className="break-all">
      <span className="text-hi">{stored.slice(0, i)}</span>
      <span style={{ color: `var(--${tone})` }}>{stored.slice(i)}</span>
    </span>
  );
}

export function FloatZoom() {
  const [id, setId] = useState("a");
  const c = CASES.find((x) => x.id === id)!;

  const d = useMemo(() => {
    const a = Number(c.a),
      b = Number(c.b),
      want = Number(c.want);
    const fa = toFrac(a),
      fb = toFrac(b);
    const trueResult = c.op === "+" ? add(fa, fb) : c.op === "-" ? sub(fa, fb) : mul(fa, fb);
    const result = c.op === "+" ? a + b : c.op === "-" ? a - b : a * b;
    // five neighbouring doubles around the one you wanted
    const ticks = [nextDown(nextDown(want)), nextDown(want), want, nextUp(want), nextUp(nextUp(want))];
    const lo = toFrac(ticks[0]);
    const ulp = sub(toFrac(ticks[1]), lo);
    const pos = (f: Frac) => {
      const [x, u] = align(sub(f, lo), ulp);
      return Number(x) / Number(u);
    };
    return {
      a: exact(fa),
      b: exact(fb),
      trueExact: exact(trueResult),
      result,
      resultExact: exact(toFrac(result)),
      wantExact: exact(toFrac(want)),
      ticks,
      truePos: pos(trueResult),
      resultPos: pos(toFrac(result)),
      ulp: Math.abs(nextUp(want) - want),
      same: result === want,
    };
  }, [c]);

  const X = (p: number) => `${4 + (Math.min(4.6, Math.max(-0.6, p)) / 4) * 92}%`;

  return (
    <div className="font-mono text-13">
      <Row k="java =" last>
        <Words options={CASES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="expression" />
      </Row>

      <div className="mt-4 grid grid-cols-[minmax(9ch,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-12 leading-[1.6]">
        <span className="text-faint">{c.a}</span>
        <span>
          <span className="text-faint">stored as </span>
          <Digits typed={c.a} stored={d.a} />
        </span>
        <span className="text-faint">{c.b}</span>
        <span>
          <span className="text-faint">stored as </span>
          <Digits typed={c.b} stored={d.b} />
        </span>
        <span className="text-faint">exact {c.op === "*" ? "product" : c.op === "-" ? "difference" : "sum"}</span>
        <span>
          <Digits typed={c.want} stored={d.trueExact} tone="hot" />
          <span className="text-faint"> (not a double)</span>
        </span>
        <span className="text-hi">{c.label}</span>
        <span>
          <span className="text-faint">rounds to </span>
          <Digits typed={c.want} stored={d.resultExact} tone={d.same ? "live" : "dead"} />
          <span className="text-faint"> → prints </span>
          <span className={d.same ? "text-live" : "text-dead"}>{javaDouble(d.result)}</span>
        </span>
        <span className="text-faint">{c.want}</span>
        <span>
          <span className="text-faint">stored as </span>
          <Digits typed={c.want} stored={d.wantExact} />
        </span>
      </div>

      {/* the number line: five neighbouring doubles, one ulp apart */}
      <div className="relative mt-8 h-[92px]" role="img" aria-label={`the result lands ${d.same ? "on" : "next to"} the double nearest ${c.want}`}>
        <div className="absolute inset-x-0 top-[40px] h-px bg-line-2" />
        {d.ticks.map((t, i) => (
          <div key={i} className="absolute top-[30px] flex -translate-x-1/2 flex-col items-center" style={{ left: X(i) }}>
            <span className="h-[21px] w-px" style={{ background: i === 2 ? "var(--hi)" : "var(--mute)" }} />
            <span className={`mt-1.5 hidden text-[10px] whitespace-nowrap sm:block ${i === 2 ? "text-hi" : "text-faint"}`}>{javaDouble(t)}</span>
          </div>
        ))}
        {/* exact (unrounded) answer */}
        <div className="absolute top-[4px] flex -translate-x-1/2 flex-col items-center transition-[left] duration-300 ease-jle" style={{ left: X(d.truePos) }}>
          <span className="text-[10px] whitespace-nowrap text-hot">exact</span>
          <span className="mt-0.5 size-[7px] rotate-45 bg-hot" />
        </div>
        {/* where it rounded */}
        <div className="absolute top-[36px] flex -translate-x-1/2 flex-col items-center transition-[left] duration-300 ease-jle" style={{ left: X(d.resultPos) }}>
          <span className="size-[9px] rounded-full" style={{ background: d.same ? "var(--live)" : "var(--dead)" }} />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-faint">
          <span className="hidden sm:inline">← smaller</span>
          <span>neighbouring doubles, {d.ulp.toExponential(2).replace("e", "E")} apart</span>
          <span className="hidden sm:inline">bigger →</span>
        </div>
      </div>

      <p className="mt-4 font-serif text-16 leading-[1.6] text-ink [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi" aria-live="polite">
        {d.same ? (
          <>
            <code>{c.a}</code>, <code>{c.b}</code> and <code>{c.want}</code> are all sums of powers of two, so they&apos;re stored exactly
            and the math is exact. no surprises.
          </>
        ) : (
          <>
            the exact answer falls between two doubles, so it&apos;s rounded to the nearest one. that&apos;s the one{" "}
            {d.resultPos > 2 ? "just above" : "just below"} the double you get when you type <code>{c.want}</code>, so{" "}
            <code>{c.label} == {c.want}</code> is false.
          </>
        )}
      </p>
    </div>
  );
}
