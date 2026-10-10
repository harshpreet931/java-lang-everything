"use client";

import { useMemo, useState } from "react";
import { useWidth } from "@/components/figures/gc/kit";
import { Words } from "./kit";

// the memory addresses a for-each loop reads, in order, for 32 elements. layouts follow what
// HotSpot does with compressed oops: an Object[] is a 16-byte header plus 4 bytes per slot,
// an Integer is 16 bytes, a LinkedList.Node 24. `list.add(1000 + i)` allocates the Integer and
// then the Node, so a freshly built LinkedList interleaves them: 40 bytes per element, in
// order. "shuffled" uses the same memory, linked in a random order (what you get when a list
// is built by inserting at random positions, or after lots of add/remove in the middle).
// ns per element: measured in the chapter's benchmark at 100,000 elements.

type Mode = "al" | "ll" | "shuffled";
const N = 32;

function trace(mode: Mode): { addr: number; kind: "slot" | "int" | "node" }[] {
  const out: { addr: number; kind: "slot" | "int" | "node" }[] = [];
  if (mode === "al") {
    for (let i = 0; i < N; i++) {
      out.push({ addr: 16 + 4 * i, kind: "slot" });
      out.push({ addr: 16 + 4 * N + 16 * i, kind: "int" });
    }
    return out;
  }
  const order = Array.from({ length: N }, (_, i) => i);
  if (mode === "shuffled") {
    let s = 12345;
    for (let i = N - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  for (const e of order) {
    out.push({ addr: 40 * e + 16, kind: "node" });
    out.push({ addr: 40 * e, kind: "int" });
  }
  return out;
}

const INFO: Record<Mode, { label: string; ns: number; lines: string; next: string; note: string }> = {
  al: {
    label: "ArrayList",
    ns: 0.34,
    lines: "11",
    next: "yes: slot i + 1",
    note: "two streams, both marching forward: the slots of the array, and the Integers, which were allocated in the same order. the CPU sees the pattern and prefetches ahead, and since the next slot's address is just i + 1, it can start several loads at once.",
  },
  ll: {
    label: "LinkedList, fresh",
    ns: 1.6,
    lines: "20",
    next: "no: it's inside this node",
    note: "still one forward stream, so the prefetcher helps. but twice the bytes per element, and every step is a dependent load: the address of the next node is in the node you're loading, so the CPU can't start the next load until this one lands.",
  },
  shuffled: {
    label: "LinkedList, shuffled",
    ns: 8.91,
    lines: "20",
    next: "no, and it's anywhere",
    note: "the same nodes, linked in a different order than they sit in memory. now every hop is a jump the prefetcher can't guess, so most loads go all the way to a slower level of cache, one at a time. same O(n), 26 times slower than the ArrayList.",
  },
};

export function AccessTrace() {
  const [mode, setMode] = useState<Mode>("al");
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const pts = useMemo(() => trace(mode), [mode]);
  const maxAddr = 40 * N;
  const H = 220;
  const padL = 44;
  const padB = 22;
  const x = (i: number) => Math.round((padL + (i / (2 * N - 1)) * (W - padL - 8)) * 10) / 10;
  const y = (a: number) => Math.round((8 + (1 - a / maxAddr) * (H - padB - 8)) * 10) / 10;
  const info = INFO[mode];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Words
        options={(Object.keys(INFO) as Mode[]).map((m) => ({ v: m, label: INFO[m].label }))}
        value={mode}
        onChange={setMode}
        label="layout"
      />
      <div ref={ref} className="min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" style={{ fontFamily: "var(--font-code)" }} role="img"
          aria-label={`addresses read in order, ${info.label}: ${info.lines} cache lines for 32 elements`}>
          {/* cache lines */}
          {Array.from({ length: maxAddr / 64 + 1 }, (_, k) => (
            <line key={k} x1={padL} x2={W - 8} y1={y(k * 64)} y2={y(k * 64)} stroke="var(--line)" />
          ))}
          {[0, 320, 640, 960, 1280].map((a) => (
            <text key={a} x={padL - 6} y={y(a) + 3} textAnchor="end" fontSize={9} fill="var(--faint)" className="tabular">
              {a === maxAddr ? `${a} B` : a}
            </text>
          ))}
          <text x={W - 8} y={H - 4} textAnchor="end" fontSize={9} fill="var(--faint)">
            read number →
          </text>
          <text x={padL} y={H - 4} fontSize={9} fill="var(--faint)">
            each band = one 64-byte cache line
          </text>
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.addr)}`).join(" ")} fill="none" stroke="var(--ref)" strokeWidth={1.1} opacity={0.75} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.addr)} r={2.3} fill={p.kind === "int" ? "var(--bg)" : "var(--ink)"} stroke="var(--ink)" strokeWidth={1} />
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-3 text-12">
        <div>
          <div className="text-11 text-faint">cache lines, 32 elements</div>
          <div className="text-hi tabular">{info.lines}</div>
        </div>
        <div>
          <div className="text-11 text-faint">next address known early?</div>
          <div className="text-hi">{info.next}</div>
        </div>
        <div>
          <div className="text-11 text-faint">measured, per element</div>
          <div className="tabular" style={{ color: mode === "al" ? "var(--live)" : mode === "shuffled" ? "var(--dead)" : "var(--hi)" }}>
            {info.ns} ns
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 text-11 text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-ink" /> slot or node
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full shadow-[inset_0_0_0_1px_var(--ink)]" /> the Integer it points at
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-px w-3 bg-ref" /> the next read
        </span>
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {info.note}
      </p>
    </div>
  );
}
