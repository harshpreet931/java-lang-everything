"use client";

import { useState } from "react";

// if one backend call is slow 1% of the time (its p99), how often is a page that makes
// n independent calls slow? 1 - 0.99^n. pure arithmetic, no measurement.

export function TailOdds() {
  const [n, setN] = useState(40);
  const [p, setP] = useState(99);
  const q = p / 100;
  const hit = 1 - Math.pow(q, n);

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2 text-13">
        <span className="shrink-0 text-12 whitespace-nowrap text-faint">calls per page =</span>
        <input type="range" className="slider min-w-[10rem] flex-1" min={1} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="calls per page" />
        <span className="w-[5ch] text-right text-hi tabular">{n}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2 text-13">
        <span className="shrink-0 text-12 whitespace-nowrap text-faint">slow means =</span>
        <div className="flex flex-wrap gap-1">
          {[90, 99, 99.9, 99.99].map((v) => (
            <button key={v} className="word" aria-pressed={p === v} onClick={() => setP(v)}>
              above p{v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" role="img" aria-label={`${Math.round(hit * 100)} out of 100 page loads include at least one slow call`}>
        {Array.from({ length: 100 }, (_, i) => (
          <span
            key={i}
            className="aspect-square rounded-[2px] transition-colors duration-200"
            style={{ background: i < Math.round(hit * 100) ? "var(--dead)" : "var(--well-2)", boxShadow: "inset 0 0 0 1px var(--line)" }}
          />
        ))}
      </div>
      <p className="mt-4 font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        <span className="text-dead tabular">{(hit * 100).toFixed(hit < 0.1 ? 1 : 0)}%</span> of page loads include at least one call slower than its p{p}. the &ldquo;1 in {Math.round(1 / (1 - q)).toLocaleString("en-US")}&rdquo; tail is what {hit > 0.5 ? "most" : hit > 0.2 ? "a big chunk" : "some"} of your users see.
      </p>
    </div>
  );
}
