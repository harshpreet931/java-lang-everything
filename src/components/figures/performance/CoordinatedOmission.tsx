"use client";

import { useMemo, useState } from "react";
import { Row, Words, useWidth } from "../meta/kit";

// rounded so server and client render identical svg attributes (Math.log10 differs in the last digits)
const rnd = (n: number) => Math.round(n * 100) / 100;

// coordinated omission, computed. a load generator wants one request every 10 ms for 5 s
// (500 requests). the server answers in 1 ms, except request #200, which hits a stall.
// "recorded" is what a send-wait-send loop measures (it skips requests it's too late for,
// exactly like the CO.java program in the chapter). "experienced" measures every intended
// request from when it should have started, assuming it queues behind the stall.

const INTERVAL = 10;
const TOTAL = 500;
const SERVICE = 1;
const STALL_AT = 200;

type Req = { i: number; t: number; lat: number | null; queued: boolean };

function simulate(stall: number) {
  const recorded: Req[] = [];
  let now = 0;
  for (let i = 0; i < TOTAL; i++) {
    const intended = i * INTERVAL;
    if (now > intended + INTERVAL) {
      recorded.push({ i, t: intended, lat: null, queued: false });
      continue;
    }
    const start = Math.max(now, intended);
    const service = SERVICE + (i === STALL_AT ? stall : 0);
    now = start + service;
    recorded.push({ i, t: intended, lat: service, queued: false });
  }
  const experienced: Req[] = [];
  let free = 0;
  for (let i = 0; i < TOTAL; i++) {
    const intended = i * INTERVAL;
    const begin = Math.max(intended, free);
    const service = SERVICE + (i === STALL_AT ? stall : 0);
    free = begin + service;
    experienced.push({ i, t: intended, lat: free - intended, queued: begin > intended });
  }
  return { recorded, experienced };
}

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.ceil((p / 100) * s.length) - 1];
}

const PS = [50, 90, 99, 99.9, 100];
const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v} ms`);

export function CoordinatedOmission() {
  const [stall, setStall] = useState(1000);
  const [view, setView] = useState<"recorded" | "experienced">("recorded");
  const sim = useMemo(() => simulate(stall), [stall]);
  const rec = sim.recorded.filter((r) => r.lat !== null).map((r) => r.lat as number);
  const exp = sim.experienced.map((r) => r.lat as number);
  const skipped = TOTAL - rec.length;
  const reqs = view === "recorded" ? sim.recorded : sim.experienced;

  const [box, W] = useWidth<HTMLDivElement>(600);
  const H = W < 480 ? 170 : 150;
  const L = 46;
  const x = (t: number) => rnd(L + (t / (TOTAL * INTERVAL)) * (W - L - 10));
  const y = (ms: number) => {
    const lo = Math.log10(0.5);
    const hi = Math.log10(2500);
    return rnd(H - 18 - ((Math.log10(ms) - lo) / (hi - lo)) * (H - 30));
  };
  const stallStart = STALL_AT * INTERVAL;
  const stallEnd = stallStart + stall + SERVICE;

  return (
    <div className="@container">
      <Row k="stall =" w="7ch">
        <Words options={[100, 500, 1000, 2000].map((v) => ({ v, label: v >= 1000 ? `${v / 1000} s` : `${v} ms` }))} value={stall} onChange={setStall} label="stall length" />
      </Row>
      <Row k="show =" w="7ch">
        <Words
          options={[
            { v: "recorded", label: "what the loop recorded" },
            { v: "experienced", label: "what users waited" },
          ]}
          value={view}
          onChange={setView}
          label="which view"
        />
      </Row>

      <div ref={box} className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`latency per request over 5 seconds; ${view === "recorded" ? `${skipped} requests were never sent` : "every request measured from its intended start"}`}>
        {[1, 10, 100, 1000].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 4} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
              {v >= 1000 ? "1s" : `${v}ms`}
            </text>
          </g>
        ))}
        <rect x={x(stallStart)} y={8} width={Math.max(1, x(stallEnd) - x(stallStart))} height={H - 26} fill="color-mix(in srgb, var(--dead) 9%, transparent)" />
        <text x={x(stallStart) + 4} y={18} fontSize={10} fill="var(--dead)" fontFamily="var(--font-code)">
          server stalled
        </text>
        {reqs.map((r) =>
          r.lat === null ? (
            <line key={r.i} x1={x(r.t)} x2={x(r.t)} y1={H - 20} y2={H - 16} stroke="var(--line-2)" strokeWidth={1} />
          ) : (
            <line
              key={r.i}
              x1={x(r.t)}
              x2={x(r.t)}
              y1={H - 18}
              y2={y(r.lat)}
              stroke={r.lat > 50 ? "var(--dead)" : "var(--ink)"}
              strokeWidth={r.lat > 50 ? 1 : 0.8}
              opacity={r.lat > 50 ? 0.9 : 0.35}
            />
          ),
        )}
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <text key={s} x={x(s * 1000)} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
            {s}s
          </text>
        ))}
      </svg>
      </div>
      <div className="mt-1 text-11 text-faint">
        one line per intended request, height = latency (log scale).{" "}
        {view === "recorded" ? `the ${skipped} tiny ticks at the bottom were never sent, so never measured.` : `requests that queued behind the stall in red.`}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-12 whitespace-nowrap tabular">
          <thead>
            <tr className="text-faint">
              <th className="py-1 text-left font-normal"> </th>
              {PS.map((p) => (
                <th key={p} className="py-1 text-right font-normal">
                  {p === 100 ? "max" : `p${p}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line" style={{ opacity: view === "recorded" ? 1 : 0.55 }}>
              <td className="py-1.5 text-ink">recorded ({rec.length})</td>
              {PS.map((p) => (
                <td key={p} className="py-1.5 text-right text-ink">
                  {fmt(pct(rec, p))}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line" style={{ opacity: view === "experienced" ? 1 : 0.55 }}>
              <td className="py-1.5 text-ink">experienced ({TOTAL})</td>
              {PS.map((p) => {
                const v = pct(exp, p);
                return (
                  <td key={p} className="py-1.5 text-right" style={{ color: v > 50 ? "var(--dead)" : "var(--ink)" }}>
                    {fmt(v)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {view === "recorded"
          ? `the loop saw one slow request and ${rec.length - 1} fast ones. its p99 says ${fmt(pct(rec, 99))}. it didn't send anything while it was stuck waiting, so the stall barely shows up in the stats.`
          : `real users don't wait for your load generator. ${sim.experienced.filter((r) => r.lat! > 50).length} requests were queued behind the stall, and the p99 is ${fmt(pct(exp, 99))}, not ${fmt(pct(rec, 99))}.`}
      </p>
    </div>
  );
}
