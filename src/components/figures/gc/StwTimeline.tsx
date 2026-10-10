"use client";

import { useState } from "react";
import { Legend, Row, Stat, Words } from "./kit";

// stop-the-world young GCs on a timeline: one GC thread (serial) vs N (parallel).
// pause lengths are measured: median young pause of a toy service (content/gc/serial-and-parallel.mdx)
// on jdk 25, macOS aarch64, 14 cores, -Xms512m -Xmx512m -Xmn200m -XX:-UseAdaptiveSizePolicy,
// three runs each. the app lanes are illustrative: every app thread stops for every pause.

type Cfg = { young: number; total: number; wall: number; cpu: number };
const SERIAL: Cfg = { young: 10.1, total: 529, wall: 1.23, cpu: 1.21 };
const PARALLEL: Record<number, Cfg> = {
  1: { young: 6.6, total: 315, wall: 1.02, cpu: 1.0 },
  2: { young: 3.9, total: 198, wall: 0.91, cpu: 1.05 },
  4: { young: 2.6, total: 140, wall: 0.87, cpu: 1.14 },
  8: { young: 1.7, total: 114, wall: 0.82, cpu: 1.21 },
  11: { young: 1.7, total: 119, wall: 0.82, cpu: 1.3 },
};

const WORK = 18; // ms of app work between two young GCs (about what this run did)
const CYCLES = 3;
const AXIS = 90; // ms shown
const APP_LANES = 3;

export function StwTimeline() {
  const [gc, setGc] = useState<"serial" | "parallel">("serial");
  const [n, setN] = useState<number>(4);
  const cfg = gc === "serial" ? SERIAL : PARALLEL[n];
  const threads = gc === "serial" ? 1 : n;
  const pct = (ms: number) => `${((ms / AXIS) * 100).toFixed(3)}%`;

  const segs: { app: [number, number][]; pauses: [number, number][] } = { app: [], pauses: [] };
  let t = 0;
  for (let c = 0; c < CYCLES; c++) {
    segs.app.push([t, WORK]);
    t += WORK;
    segs.pauses.push([t, cfg.young]);
    t += cfg.young;
  }
  const done = t;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <Row k="collector" kw="12ch">
          <Words options={["serial", "parallel"] as const} value={gc} onChange={setGc} label="collector" />
        </Row>
        <Row k="GC threads" kw="12ch" last>
          {gc === "serial" ? (
            <span className="px-2 text-12 text-mute">1, always</span>
          ) : (
            <Words options={[1, 2, 4, 8, 11]} value={n} onChange={setN} label="parallel GC threads" />
          )}
        </Row>
      </div>

      <div className="grid gap-[3px]" role="img" aria-label={`${CYCLES} young GCs, ${cfg.young} ms each, ${threads} GC thread${threads > 1 ? "s" : ""}`}>
        {Array.from({ length: APP_LANES }, (_, i) => (
          <Lane key={`a${i}`} label={i === 0 ? "app threads" : ""}>
            {segs.app.map(([s, w], k) => (
              <span
                key={k}
                className="absolute inset-y-[3px] rounded-[2px] bg-mute transition-[left,width] duration-300 ease-jle"
                style={{ left: pct(s), width: pct(w), opacity: 0.55 }}
              />
            ))}
            {segs.pauses.map(([s, w], k) => (
              <span
                key={k}
                className="absolute inset-y-[3px] rounded-[2px] transition-[left,width] duration-300 ease-jle"
                style={{ left: pct(s), width: pct(w), background: "repeating-linear-gradient(135deg, var(--line-2) 0 1px, transparent 1px 4px)" }}
              />
            ))}
          </Lane>
        ))}
        <div className="h-2" />
        {Array.from({ length: threads }, (_, i) => (
          <Lane key={`g${i}`} label={i === 0 ? (threads > 1 ? "GC threads" : "GC thread") : ""} thin={threads > 4}>
            {segs.pauses.map(([s, w], k) => (
              <span
                key={k}
                className="absolute inset-y-[2px] rounded-[2px] transition-[left,width] duration-300 ease-jle"
                style={{ left: pct(s), width: pct(w), background: "var(--meta)", opacity: 0.85 }}
              />
            ))}
          </Lane>
        ))}
        {/* axis */}
        <div className="grid grid-cols-[10ch_minmax(0,1fr)] gap-2">
          <span />
          <div className="relative mt-1 h-8 border-t border-line">
            {[0, 20, 40, 60, 80].map((m) => (
              <span
                key={m}
                className={`absolute top-1 -translate-x-1/2 text-[10px] whitespace-nowrap text-faint tabular ${m % 40 ? "hidden sm:block" : ""}`}
                style={{ left: pct(m) }}
              >
                {m} ms
              </span>
            ))}
            <span
              className="absolute top-0 h-3 w-px bg-hot transition-[left] duration-300 ease-jle"
              style={{ left: pct(done) }}
            />
            <span
              className="absolute top-4 -translate-x-full pr-1 text-[10px] whitespace-nowrap text-hot transition-[left] duration-300 ease-jle"
              style={{ left: pct(done) }}
            >
              same work done at {done.toFixed(0)} ms
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
        <Stat k="young pause (median)" v={`${cfg.young} ms`} tone="hot" />
        <Stat k="all pauses in the run" v={`${cfg.total} ms`} />
        <Stat k="wall clock" v={`${cfg.wall.toFixed(2)} s`} />
        <Stat k="CPU (user)" v={`${cfg.cpu.toFixed(2)} s`} />
      </div>
      <Legend
        items={[
          ["mute", "app running"],
          ["meta", "GC thread working"],
          ["hot", "when the same app work finishes"],
        ]}
      />
    </div>
  );
}

function Lane({ label, children, thin }: { label: string; children: React.ReactNode; thin?: boolean }) {
  return (
    <div className="grid grid-cols-[10ch_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-11 text-faint">{label}</span>
      <div className={`relative rounded-[2px] bg-bg shadow-[inset_0_0_0_1px_var(--line)] ${thin ? "h-[10px]" : "h-[16px]"}`}>{children}</div>
    </div>
  );
}
