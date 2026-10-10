"use client";

import { javaDouble } from "@/components/figures/basics/kit";

// Math.ulp(x) on jdk 25, for x across 31 orders of magnitude. log scale.
// (the shared <Bars> formats with toLocaleString, which rounds 1e-16 to "0", hence this.)

const DATA = [
  { x: "1.0", ulp: 2.220446049250313e-16 },
  { x: "1e6", ulp: 1.1641532182693481e-10 },
  { x: "1e15", ulp: 0.125 },
  { x: "1e16", ulp: 2.0, hot: true },
];

export function UlpBars() {
  const lo = Math.log10(1e-17);
  const hi = Math.log10(10);
  const w = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
  return (
    <div className="font-mono text-13" role="img" aria-label="the gap between neighbouring doubles grows from 2.2E-16 at 1.0 to 2.0 at 1e16">
      <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]">
        {DATA.map((d) => (
          <div key={d.x} className="contents">
            <span className="text-ink">Math.ulp({d.x})</span>
            <span className="relative h-[14px] rounded-sm bg-well-2">
              <span
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${w(d.ulp)}%`, background: d.hot ? "var(--hot)" : "var(--mute)" }}
              />
            </span>
            <span className={`col-start-2 -mt-1.5 text-12 tabular sm:col-start-auto sm:mt-0 sm:text-right ${d.hot ? "text-hot" : "text-mute"}`}>
              {javaDouble(d.ulp)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-11 text-faint">
        <span>1E-17</span>
        <span>log scale</span>
        <span>10</span>
      </div>
    </div>
  );
}
