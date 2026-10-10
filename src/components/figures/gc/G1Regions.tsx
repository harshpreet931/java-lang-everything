"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { useMemo, useState } from "react";
import { Legend, Readout, Row, Words } from "./kit";

// G1's heap as a grid of equal regions, and one full cycle: young GCs, a humongous
// allocation, concurrent marking, then mixed GCs that pick the old regions with the most
// garbage first. 48 regions here; a real heap has about 2048. which old regions get picked
// follows G1's rules (most garbage first, skip regions over 85% live), and the pause target
// controls how many fit in one mixed GC.

type T = "F" | "E" | "S" | "O" | "H" | "h";
type R = { t: T; live?: number; cset?: boolean; mark?: boolean; skip?: boolean };
type Snap = { regions: R[]; note: string; cset?: string };

const N = 48;
const free = (): R[] => Array.from({ length: N }, () => ({ t: "F" as T }));
const put = (rs: R[], idx: number[], r: R) => idx.forEach((i) => (rs[i] = { ...r }));

const EDEN_A = [0, 1, 2, 6, 7, 10, 11, 13, 19, 20];
const EDEN_B = [0, 1, 2, 6, 7, 10, 11, 13];
const OLD = [3, 5, 8, 12, 14, 17, 21, 22, 26, 30, 33, 37, 40, 44];
const LIVE: Record<number, number> = { 3: 0.92, 5: 0.15, 8: 0.6, 12: 0, 14: 0.35, 17: 0.97, 21: 0.08, 22: 0.7, 26: 0, 30: 0.45, 33: 0.88, 37: 0.25, 40: 0.55, 44: 0.18 };
const HUM = [34, 35, 36];
const BY_GARBAGE = OLD.filter((i) => LIVE[i] > 0 && LIVE[i] <= 0.85).sort((a, b) => LIVE[a] - LIVE[b]);

function script(k: number): Snap[] {
  const out: Snap[] = [];
  let rs = free();
  out.push({ regions: rs, note: "a fresh heap: every region is free. G1 has no fixed eden or old gen. any region can become either, and a region's job can change after every GC." });

  rs = free();
  put(rs, EDEN_A, { t: "E" });
  out.push({ regions: rs, note: "the app allocates. G1 hands out free regions as eden (E), one at a time, until eden reaches the size it picked to meet the pause target." });

  rs = rs.map((r) => (r.t === "E" ? { ...r, cset: true } : r));
  out.push({ regions: rs, cset: "10 eden", note: "eden is full: a young GC (stop the world). the collection set, outlined, is every young region. G1 always collects whole regions." });

  rs = free();
  put(rs, [9, 27], { t: "S" });
  put(rs, [3], { t: "O" });
  out.push({ regions: rs, note: "evacuation: live objects are copied out of the collection set into fresh survivor (S) regions, and into old (O) regions once they're old enough. the 10 eden regions are simply free again." });

  rs = free();
  put(rs, OLD, { t: "O" });
  put(rs, [9, 27], { t: "S" });
  put(rs, EDEN_B, { t: "E" });
  out.push({ regions: rs, note: "many young GCs later, old regions have piled up all over the heap. some of what's in them has died since, but G1 can't tell how much without marking." });

  put(rs, HUM, { t: "h" });
  rs[HUM[0]] = { t: "H" };
  out.push({ regions: rs.map((r) => ({ ...r })), note: "a 2.5 MB array (with 1 MB regions) is humongous: it skips eden and gets 3 contiguous regions to itself. the end of the last one is wasted." });

  const marking = rs.map((r) => (r.t === "O" || r.t === "H" || r.t === "h" ? { ...r, mark: true } : { ...r }));
  out.push({ regions: marking, note: "old-gen occupancy crossed the threshold (45% of the heap by default, adapted over time). a young GC starts concurrent marking, and marking threads walk the old regions while the app keeps running (SATB keeps it correct)." });

  const marked = rs.map((r, i) => {
    if (r.t !== "O") return { ...r };
    return LIVE[i] === 0 ? { t: "F" as T } : { ...r, live: LIVE[i] };
  });
  out.push({ regions: marked, note: "remark and cleanup (two short pauses) finish the job. now G1 knows how much of each old region is live (green) and how much is garbage (red). two regions were entirely garbage: they're freed on the spot, no copying needed." });

  const pick = BY_GARBAGE.slice(0, k);
  const mixed = marked.map((r, i) => {
    if (r.t === "E" || r.t === "S") return { ...r, cset: true };
    if (r.t === "O" && pick.includes(i)) return { ...r, cset: true };
    if (r.t === "O" && (r.live ?? 0) > 0.85) return { ...r, skip: true };
    return { ...r };
  });
  out.push({
    regions: mixed,
    cset: `8 eden + 2 survivor + ${k} old`,
    note: `a mixed GC: all young regions plus the ${k} old regions with the most garbage, as many as G1 predicts will fit in the pause target. garbage first: the least copying for the most space back. regions over 85% live (dimmed) aren't worth it and are never picked.`,
  });

  const liveSum = pick.reduce((a, i) => a + LIVE[i], 0);
  const after = marked.map((r, i) => {
    if (r.t === "E" || r.t === "S") return { t: "F" as T };
    if (pick.includes(i)) return { t: "F" as T };
    return { ...r };
  });
  const dest = [15, 16, 23];
  let left = liveSum;
  let d = 0;
  while (left > 0.001 && d < dest.length) {
    after[dest[d]] = { t: "O", live: Math.min(1, left) };
    left -= 1;
    d++;
  }
  put(after, [18], { t: "S" });
  out.push({
    regions: after,
    note: `the live objects from those ${k} old regions fit in ${d} fresh region${d > 1 ? "s" : ""}. ${k - d} regions of garbage came back, and the copying compacted the survivors on the way: no fragmentation. a smaller pause target means fewer old regions per mixed GC, so it takes more of them.`,
  });

  const rest = BY_GARBAGE.slice(k);
  const finalRs = after.map((r, i) => (rest.includes(i) ? { ...r, cset: true } : { ...r }));
  out.push({
    regions: finalRs,
    note: `the rest of the candidates (outlined) go in the next mixed GCs, spread over up to 8 of them. G1 stops early once what's left would free less than 5% of the heap. then it's back to young-only GCs until the next marking cycle.`,
  });
  return out;
}

const TARGETS = [
  { v: 2, label: "50 ms" },
  { v: 4, label: "200 ms (default)" },
  { v: 6, label: "500 ms" },
] as const;

export function G1Regions() {
  const [k, setK] = useState<number>(4);
  const steps = useMemo(() => script(k), [k]);
  const s = useStepper(steps.length, { interval: 2400 });
  const st = steps[s.i];
  const count = (t: T) => st.regions.filter((r) => r.t === t).length;

  return (
    <div {...s.keys} className="grid grid-cols-[minmax(0,1fr)] gap-4 outline-none" aria-label="G1 region step-through">
      <Row k="pause target" kw="15ch" last>
        <Words options={TARGETS} value={k as 2 | 4 | 6} onChange={(v) => setK(v)} label="MaxGCPauseMillis" />
      </Row>

      <div className="grid gap-4 @container sm:grid-cols-[minmax(0,1fr)_15ch]">
        <div
          className="grid max-w-[560px] gap-[3px] rounded-md p-[3px] shadow-[inset_0_0_0_1px_var(--line-2)]"
          style={{ gridTemplateColumns: "repeat(12, minmax(0,1fr))" }}
          role="img"
          aria-label={`regions: ${count("E")} eden, ${count("S")} survivor, ${count("O")} old, ${count("H") + count("h")} humongous, ${count("F")} free`}
        >
          {st.regions.map((r, i) => (
            <Cell key={i} r={r} />
          ))}
        </div>
        <div className="grid content-start gap-1 text-11 text-faint">
          {(
            [
              ["E", "eden", count("E")],
              ["S", "survivor", count("S")],
              ["O", "old", count("O")],
              ["H", "humongous", count("H") + count("h")],
              ["", "free", count("F")],
            ] as const
          ).map(([l, name, n]) => (
            <div key={name} className="flex items-center justify-between gap-3">
              <span>
                <span className="inline-block w-3 text-ink">{l}</span> {name}
              </span>
              <span className="text-ink tabular">{n}</span>
            </div>
          ))}
          {st.cset && (
            <div className="mt-2 border-t border-line pt-2 text-hot">
              collection set:
              <br />
              {st.cset}
            </div>
          )}
        </div>
      </div>

      <Readout minLines={4}>{st.note}</Readout>
      <Legend
        items={[
          ["live", "live data in a region"],
          ["dead", "garbage in a region"],
          ["hot", "collection set"],
          ["meta", "being marked"],
        ]}
      />
      <StepControls s={s} />
    </div>
  );
}

function Cell({ r }: { r: R }) {
  const known = r.live !== undefined;
  const outline = r.cset ? "var(--hot)" : r.mark ? "var(--meta)" : r.t === "F" ? "var(--line)" : "var(--line-2)";
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-[3px] transition-[box-shadow,opacity] duration-200 ease-jle"
      style={{
        background: r.t === "F" ? "var(--bg)" : "var(--well-2)",
        boxShadow: `inset 0 0 0 ${r.cset ? 2 : 1}px ${outline}`,
        outline: r.mark && !r.cset ? "1px dashed var(--meta)" : undefined,
        outlineOffset: -3,
        opacity: r.skip ? 0.45 : 1,
      }}
    >
      {known && (
        <>
          <div className="absolute inset-x-0 bottom-0" style={{ height: `${Math.round((r.live ?? 0) * 100)}%`, background: "color-mix(in srgb, var(--live) 30%, transparent)" }} />
          <div className="absolute inset-x-0 top-0" style={{ height: `${100 - Math.round((r.live ?? 0) * 100)}%`, background: "color-mix(in srgb, var(--dead) 22%, transparent)" }} />
        </>
      )}
      {r.t !== "F" && (
        <span className="absolute top-[2px] left-[4px] text-[10px] leading-none" style={{ color: r.cset ? "var(--hot)" : "var(--ink)" }}>
          {r.t === "h" ? "" : r.t}
        </span>
      )}
      {r.t === "h" && <span className="absolute inset-y-[30%] right-0 left-0 border-t border-dashed border-line-2" />}
    </div>
  );
}
