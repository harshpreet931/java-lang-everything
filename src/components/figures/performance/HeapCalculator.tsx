"use client";

import { useState } from "react";
import { Row, Words } from "../meta/kit";

// what the JVM picks by default inside a container. the rule is HotSpot's (Arguments::set_heap_size)
// and every "measured" value is real: eclipse-temurin:25-jre (jdk 25.0.4.1) under docker with
// -m <limit> --cpus <n>, read back with -XX:+PrintFlagsFinal and -XshowSettings:system.

const FLOOR = 126; // MiB: the built-in default MaxHeapSize (96 MB scaled for 64-bit, aligned). measured: 132120576 bytes
const MEMS = [128, 200, 256, 512, 1024, 1792, 2048, 4096, 8192, 16384];
const CPUS = [0.5, 1, 1.5, 2, 3, 4, 8];

// measured max heap (MiB), keyed by `${mem}:${maxRamPct}`
const MEASURED: Record<string, number> = {
  "128:25": 64,
  "256:25": 126,
  "512:25": 128,
  "1024:25": 256,
  "1792:25": 448,
  "2048:25": 512,
  "4096:25": 1024,
  "8192:25": 2048,
  "16384:25": 4096,
  "128:75": 64,
  "200:75": 100,
  "256:75": 192,
  "1024:75": 768,
};
// measured with -m 4g
const CPU_MEASURED: Record<number, { eff: number; gc: string; par: number; ci: number }> = {
  0.5: { eff: 1, gc: "Serial", par: 0, ci: 2 },
  1: { eff: 1, gc: "Serial", par: 0, ci: 2 },
  1.5: { eff: 2, gc: "G1", par: 2, ci: 2 },
  2: { eff: 2, gc: "G1", par: 2, ci: 2 },
  3: { eff: 3, gc: "G1", par: 3, ci: 2 },
  4: { eff: 4, gc: "G1", par: 4, ci: 3 },
  8: { eff: 8, gc: "G1", par: 8, ci: 4 },
};

const alignUp = (mib: number) => Math.ceil(mib / 2) * 2;
function maxHeap(mem: number, pct: number) {
  const half = mem * 0.5; // MinRAMPercentage = 50
  if (half < FLOOR) return { mib: alignUp(half), rule: "small" as const };
  const share = mem * (pct / 100);
  return share > FLOOR ? { mib: alignUp(share), rule: "pct" as const } : { mib: FLOOR, rule: "floor" as const };
}
const fmtMem = (mib: number) => (mib >= 1024 ? `${+(mib / 1024).toFixed(2)} GB` : `${mib} MB`);

export function HeapCalculator() {
  const [mi, setMi] = useState(3);
  const [cpus, setCpus] = useState(2);
  const [pct, setPct] = useState(25);
  const mem = MEMS[mi];
  const h = maxHeap(mem, pct);
  const measured = MEASURED[`${mem}:${pct}`];
  const c = CPU_MEASURED[cpus];
  const serverClass = c.eff >= 2 && mem >= 1792;
  const gc = serverClass ? "G1" : "Serial";
  const left = mem - h.mib;

  const why =
    h.rule === "small"
      ? `${fmtMem(mem)} is small: half of it is under the ${FLOOR} MB built-in default, so the JVM uses MinRAMPercentage (50%) and ignores MaxRAMPercentage entirely.`
      : h.rule === "floor"
        ? `${pct}% of ${fmtMem(mem)} would be less than the built-in default of ${FLOOR} MB, so the JVM uses ${FLOOR} MB instead.`
        : `MaxRAMPercentage = ${pct}: ${pct}% of the ${fmtMem(mem)} the container allows.`;

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2 text-13">
        <span className="w-[11ch] shrink-0 text-12 text-faint">-m =</span>
        <input type="range" className="slider min-w-[9rem] flex-1" min={0} max={MEMS.length - 1} value={mi} onChange={(e) => setMi(Number(e.target.value))} aria-label="container memory limit" />
        <span className="w-[8ch] text-right text-hi tabular">{fmtMem(mem)}</span>
      </div>
      <Row k="--cpus =" w="11ch">
        <Words options={CPUS.map((v) => ({ v, label: String(v) }))} value={cpus} onChange={setCpus} label="cpu limit" />
      </Row>
      <Row k="MaxRAM% =" w="11ch">
        <Words options={[{ v: 25, label: "25 (default)" }, { v: 50, label: "50" }, { v: 75, label: "75" }]} value={pct} onChange={setPct} label="MaxRAMPercentage" />
      </Row>

      <div className="mt-4" role="img" aria-label={`max heap ${fmtMem(h.mib)} of a ${fmtMem(mem)} container`}>
        <div className="flex h-9 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--line-2)]">
          <div className="flex items-center justify-center bg-ref/20 text-12 text-ref transition-[width] duration-300 ease-jle" style={{ width: `${(h.mib / mem) * 100}%` }}>
            {h.mib / mem > 0.18 ? `heap ${fmtMem(h.mib)}` : ""}
          </div>
          <div className="flex flex-1 items-center justify-center bg-well-2 text-12 text-mute">
            {left / mem > 0.32 ? `everything else ${fmtMem(left)}` : left / mem > 0.12 ? fmtMem(left) : ""}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-11 text-faint">
          <span>0</span>
          <span>container limit {fmtMem(mem)}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-12">
        <dt className="text-faint">max heap</dt>
        <dd className="text-hi">
          {fmtMem(h.mib)}{" "}
          {measured !== undefined ? (
            <span className="text-live">✓ measured: {fmtMem(measured)}</span>
          ) : (
            <span className="text-faint">(computed from the rule)</span>
          )}
        </dd>
        <dt className="text-faint">CPUs the JVM sees</dt>
        <dd className="text-hi">
          {c.eff} <span className="text-faint">(quota rounded up)</span>
        </dd>
        <dt className="text-faint">garbage collector</dt>
        <dd className="text-hi">
          {gc} <span className="text-faint">{serverClass ? "(2+ CPUs and 1792 MB+)" : `(${c.eff < 2 ? "under 2 CPUs" : "under 1792 MB"}: not a "server class machine")`}</span>
        </dd>
        <dt className="text-faint">GC / JIT threads</dt>
        <dd className="text-hi">
          ParallelGCThreads={serverClass ? c.par : 0}, CICompilerCount={c.ci} <span className="text-faint">(measured at 4 GB)</span>
        </dd>
      </dl>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {why} the rest of the container has to hold metaspace, the code cache, thread stacks, GC structures and direct buffers.
      </p>
    </div>
  );
}
