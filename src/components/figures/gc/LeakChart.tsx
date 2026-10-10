"use client";

import { HEALTHY, LEAKING, OOM_AT, type Gc } from "./data/leakruns";
import { Legend, Stat, useWidth } from "./kit";

// two real runs, same heap, same collector, same x axis: the healthy toy service and the
// one with a listener leak. the sawtooth is heap used before → after each GC; the amber
// line joins the "after" of whole-heap collections (remark, full), which is the live set.

const END = 3.65;
const MAXMB = 256;

function Panel({ runs, w, title, file, done }: { runs: Gc[]; w: number; title: string; file: string; done: "ok" | "oom" }) {
  const padL = 34;
  const padR = 10;
  const H = 128;
  const top = 8;
  const plotH = 92;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (t: number) => r2(padL + (t / END) * (w - padL - padR));
  const y = (mb: number) => r2(top + (1 - mb / MAXMB) * plotH);
  let d = "";
  runs.forEach(([t, b, a], i) => {
    d += `${i ? "L" : "M"} ${x(t)} ${y(b)} L ${x(t)} ${y(a)} `;
  });
  // the floor: full GCs if the run had any (they see the whole heap), otherwise remarks
  const hasFull = runs.some((g) => g[3] === "f");
  const floor = runs.filter((g) => g[3] === (hasFull ? "f" : "r"));
  const floorPath = floor.map(([t, , a], i) => `${i ? "L" : "M"} ${x(t)} ${y(a)}`).join(" ");
  const fulls = runs.filter((g) => g[3] === "f");
  const last = runs[runs.length - 1];
  const stripY = top + plotH + 8;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-12">
        <span className="text-hi">{title}</span>
        <span className="text-faint">{file}</span>
      </div>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block" style={{ fontFamily: "var(--font-code)" }} role="img"
        aria-label={`${title}: ${runs.length} collections, ${fulls.length} full GCs, ${done === "oom" ? `OutOfMemoryError at ${OOM_AT} s` : `finished at ${last[0]} s`}`}>
        {[0, 128, 256].map((mb) => (
          <g key={mb}>
            <line x1={padL} x2={w - padR} y1={y(mb)} y2={y(mb)} stroke="var(--line)" />
            <text x={padL - 6} y={y(mb) + 3} textAnchor="end" fontSize={9} fill="var(--faint)">
              {mb}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={0.8} opacity={0.55} strokeLinejoin="round" />
        {floor.length > 1 && <path d={floorPath} fill="none" stroke="var(--hot)" strokeWidth={1.8} strokeLinejoin="round" />}
        {floor.map(([t, , a], i) => (
          <circle key={i} cx={x(t)} cy={y(a)} r={1.6} fill="var(--hot)" />
        ))}
        {/* full GCs as ticks on a strip under the chart */}
        <line x1={padL} x2={w - padR} y1={stripY + 4} y2={stripY + 4} stroke="var(--line)" />
        {fulls.map(([t], i) => (
          <line key={i} x1={x(t)} x2={x(t)} y1={stripY} y2={stripY + 8} stroke="var(--dead)" strokeWidth={1} opacity={0.8} />
        ))}
        <text x={padL - 6} y={stripY + 7} textAnchor="end" fontSize={8.5} fill="var(--faint)">
          full
        </text>
        {done === "oom" ? (
          <g>
            <path d={`M ${x(OOM_AT) - 4} ${y(MAXMB) - 2} l 8 8 M ${x(OOM_AT) + 4} ${y(MAXMB) - 2} l -8 8`} stroke="var(--dead)" strokeWidth={1.8} />
            <text x={x(OOM_AT) - 8} y={y(MAXMB) + 18} textAnchor="end" fontSize={10} fill="var(--dead)">
              OutOfMemoryError
            </text>
          </g>
        ) : (
          <text x={x(last[0]) + 6} y={y(last[2]) + 3} fontSize={10} fill="var(--live)">
            done
          </text>
        )}
      </svg>
    </div>
  );
}

const sum = (r: Gc[]) => r.length;

export function LeakChart() {
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const x = (t: number) => 34 + (t / END) * (W - 44);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div ref={ref} className="grid min-w-0 gap-3">
        <Panel runs={HEALTHY} w={W} title="healthy" file="Service.java" done="ok" />
        <Panel runs={LEAKING} w={W} title="leaking" file="LeakyService.java" done="oom" />
        <div className="relative h-4 text-[9px] text-faint tabular">
          {[0, 1, 2, 3].map((s) => (
            <span key={s} className="absolute -translate-x-1/2" style={{ left: x(s) }}>
              {s}s
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
        <Stat k="healthy: collections" v={sum(HEALTHY)} />
        <Stat k="healthy: done in" v="1.0 s" tone="live" />
        <Stat k="leaking: full GCs" v={LEAKING.filter((g) => g[3] === "f").length} tone="dead" />
        <Stat k="leaking: died at" v={`${OOM_AT} s`} tone="dead" />
      </div>
      <Legend
        items={[
          ["mute", "heap used, before → after each GC"],
          ["hot", "after a whole-heap GC: the live set"],
          ["dead", "a full GC"],
        ]}
      />
    </div>
  );
}
