"use client";

import { useState } from "react";
import { Row, Words } from "./ui";

// if a race shows up once in N runs, how likely is a test run k times to catch it?
//   P(at least one failure) = 1 - (1 - 1/N)^k      and you need about 3N runs for 95%.

const NS = [100, 1_000, 10_000, 100_000, 1_000_000] as const;
const KS = [1, 100, 1_000, 10_000, 100_000, 1_000_000] as const;
const fmt = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}k` : String(n));

export function RaceOdds() {
  const [n, setN] = useState<number>(10_000);
  const [k, setK] = useState<number>(1_000);
  const p = 1 - Math.pow(1 - 1 / n, k);
  const need = Math.ceil(Math.log(0.05) / Math.log(1 - 1 / n));
  const pct = p * 100;
  const shown = pct >= 99.95 ? ">99.9" : pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1);

  return (
    <div>
      <div className="text-13">
        <Row k="bug shows up =" w="15ch">
          <Words options={NS.map((v) => ({ v, label: `1 in ${fmt(v)}` }))} value={n} onChange={setN} label="failure rate" />
        </Row>
        <Row k="test runs =" w="15ch">
          <Words options={KS.map((v) => ({ v, label: fmt(v) }))} value={k} onChange={setK} label="number of test runs" />
        </Row>
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-3 text-12">
        <span className="text-faint">chance the test ever fails</span>
        <span className="text-20 tabular" style={{ color: p >= 0.95 ? "var(--live)" : p < 0.5 ? "var(--dead)" : "var(--hot)" }}>
          {shown}%
        </span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-well-2" role="img" aria-label={`${shown} percent`}>
        <div
          className="h-3 rounded-full transition-[width] duration-300 ease-jle"
          style={{ width: `${Math.max(0.5, pct)}%`, background: p >= 0.95 ? "var(--live)" : p < 0.5 ? "var(--dead)" : "var(--hot)" }}
        />
      </div>
      <p className="mt-4 font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {p < 0.5
          ? `run it ${fmt(k)} times and you'll most likely see green every time, and ship the bug.`
          : p < 0.95
            ? `a coin flip, roughly. a green run tells you very little.`
            : `now the test has a real chance of catching it.`}{" "}
        for a 95% chance of seeing a 1-in-{fmt(n)} race at least once, you need about {need.toLocaleString("en-US")} runs.
      </p>
    </div>
  );
}
