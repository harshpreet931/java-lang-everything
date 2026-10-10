"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration } from "./kit";

// HashMap.resize() going from 16 to 32 bins. the bins are the real ones: these 13
// Integer keys put in this order into a default HashMap on jdk 25, dumped with
// reflection before and after (Integer keys under 65536 hash to themselves).
//   before: 0=[0,16] 2=[2] 5=[5,21,37,53] 7=[7] 9=[25] 12=[12,44] 14=[30,62]
//   after:  0=[0] 2=[2] 5=[5,37] 7=[7] 12=[12,44] 16=[16] 21=[21,53] 25=[25] 30=[30,62]

const OLD: Record<number, number[]> = { 0: [0, 16], 2: [2], 5: [5, 21, 37, 53], 7: [7], 9: [25], 12: [12, 44], 14: [30, 62] };

type S = { done: number[]; cur: number[]; alloc: boolean; gone?: boolean; fresh?: number; note: string };

const STEPS: S[] = [
  {
    done: [],
    cur: [],
    alloc: false,
    fresh: 16,
    note: "13 entries in 16 bins. the threshold is 12 (16 × 0.75), so the 13th put (key 16, into bin 0) pushed size past it and called resize().",
  },
  {
    done: [],
    cur: [],
    alloc: true,
    note: "resize() allocates a Node[32] and doubles the threshold to 24. it's drawn as two rows: bins 0 to 15 on top, 16 to 31 below. same column = j and j + 16.",
  },
  { done: [0], cur: [0], alloc: true, note: "j = 0. walk the chain: 0 & 16 is 0, so 0 stays in bin 0 (the lo list). 16 & 16 is 16, so it drops to bin 16 (the hi list)." },
  { done: [0, 2], cur: [2], alloc: true, note: "j = 2. a lone node skips the split loop and goes straight to hash & 31, which is 2." },
  {
    done: [0, 2, 5],
    cur: [5],
    alloc: true,
    note: "j = 5. four nodes, one bit decides each: 5 and 37 have bit 4 clear (lo, bin 5), 21 and 53 have it set (hi, bin 21). both lists keep their original order.",
  },
  { done: [0, 2, 5, 7, 9], cur: [7, 9], alloc: true, note: "j = 7 and j = 9. lone nodes again. 25 is 11001 in binary, bit 4 set, so it moves to 9 + 16 = 25." },
  { done: [0, 2, 5, 7, 9, 12], cur: [12], alloc: true, note: "j = 12. 12 is 01100 and 44 is 101100: bit 4 clear on both. the whole chain stays put." },
  { done: [0, 2, 5, 7, 9, 12, 14], cur: [14], alloc: true, note: "j = 14. 30 is 11110 and 62 is 111110: bit 4 set on both. the whole chain moves to 30." },
  {
    done: [0, 2, 5, 7, 9, 12, 14],
    cur: [],
    alloc: true,
    gone: true,
    note: "done. no node went anywhere but j or j + 16, and nobody called hashCode(): every Node kept the hash it got on its first put. the old array is garbage now.",
  },
];

const OLDCAP = 16;
const lo = (k: number) => (k & OLDCAP) === 0;

export function ResizeSplit() {
  const s = useStepper(STEPS.length, { interval: 2200 });
  const st = STEPS[s.i];

  // where every node is at this step
  const oldBins: Record<number, number[]> = {};
  const newBins: Record<number, number[]> = {};
  for (const [j, chain] of Object.entries(OLD)) {
    const jj = Number(j);
    if (st.done.includes(jj)) {
      for (const k of chain) (newBins[k & 31] ??= []).push(k);
    } else oldBins[jj] = chain;
  }
  const curKeys = st.cur.flatMap((j) => OLD[j]);
  const hot = (k: number) => curKeys.includes(k) || st.fresh === k;

  return (
    <div {...s.keys} className="@container outline-none" aria-label="HashMap resize from 16 to 32 bins, step by step">
      <div className="grid gap-5">
        <Table
          title={
            <>
              old table <span className="text-faint">· Node[16]</span>
              {st.gone && <span className="ml-2 text-dead">unreachable</span>}
            </>
          }
          from={0}
          bins={oldBins}
          hot={hot}
          curBins={st.cur}
          dead={st.gone}
        />
        <div className={`text-12 transition-opacity duration-200 ${st.alloc ? "text-mute" : "text-faint opacity-40"}`}>
          ↓ resize(): <span className="text-hi">newCap = 32</span>, threshold = 24
        </div>
        <div className={`grid gap-4 transition-opacity duration-300 ${st.alloc ? "opacity-100" : "opacity-25"}`}>
          <Table title={<>new table <span className="text-faint">· Node[32], bins 0 to 15 (lo)</span></>} from={0} bins={newBins} hot={hot} />
          <Table title={<>&nbsp;<span className="text-faint">bins 16 to 31 (hi = j + 16)</span></>} from={16} bins={newBins} hot={hot} />
        </div>
      </div>

      {/* the one bit that decides */}
      <div className="mt-5 min-h-[96px] overflow-x-auto rounded-md bg-bg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
        {curKeys.length ? (
          <table className="w-full min-w-[300px] text-12 tabular">
            <thead>
              <tr className="text-left text-11 text-faint">
                <th className="pb-1 font-normal">key</th>
                <th className="pb-1 font-normal">hash, low 6 bits</th>
                <th className="pb-1 font-normal">hash &amp; 16</th>
                <th className="pb-1 text-right font-normal">goes to</th>
              </tr>
            </thead>
            <tbody>
              {curKeys.map((k) => {
                const b = k.toString(2).padStart(6, "0");
                return (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1 text-hi">{k}</td>
                    <td className="py-1">
                      {b.split("").map((c, i) => (
                        <span key={i} className={i === 1 ? "text-hot" : c === "1" ? "text-ink" : "text-faint"}>
                          {c}
                        </span>
                      ))}
                    </td>
                    <td className={`py-1 ${lo(k) ? "text-ink" : "text-hot"}`}>{k & 16}</td>
                    <td className="py-1 text-right text-ink">
                      bin {k & 31} <span className="text-faint">{lo(k) ? "(lo, stays)" : "(hi, +16)"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-12 text-faint">
            {s.i === 0 ? "the bit that will decide is bit 4 (value 16, the old capacity). nothing has moved yet." : s.atEnd ? "every node checked exactly one bit: hash & 16." : "the loop visits old bins j = 0, 1, 2 … 15 in order."}
          </div>
        )}
      </div>

      <Narration className="mt-4">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

function Table({
  title,
  from,
  bins,
  hot,
  curBins = [],
  dead,
}: {
  title: React.ReactNode;
  from: number;
  bins: Record<number, number[]>;
  hot: (k: number) => boolean;
  curBins?: number[];
  dead?: boolean;
}) {
  return (
    <div className={`transition-opacity duration-300 ${dead ? "opacity-60" : ""}`}>
      <div className="mb-1.5 text-12 text-ink">{title}</div>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))]">
        {Array.from({ length: 16 }, (_, c) => {
          const j = from + c;
          const chain = bins[j] ?? [];
          const cur = from === 0 && curBins.includes(j) && !!bins[j];
          return (
            <div key={j} className="flex min-w-0 flex-col items-center">
              <span className={`text-[9px] leading-3 tabular @[560px]:text-[10px] ${cur ? "text-hot" : "text-faint"}`}>{j}</span>
              <div
                className="-ml-px mt-0.5 h-3 w-full transition-[box-shadow] duration-200"
                style={{ boxShadow: `inset 0 0 0 1px ${dead ? "var(--dead)" : cur ? "var(--hot)" : "var(--line-2)"}` }}
              />
              <div className="mt-1 flex min-h-[38px] flex-col items-center gap-[3px] @[560px]:min-h-[44px]">
                {chain.map((k) => (
                  <span
                    key={k}
                    className="obj-in flex h-4 w-full min-w-[15px] items-center justify-center rounded-[1px] px-px text-[9.5px] tabular @[560px]:h-[18px] @[560px]:min-w-[24px] @[560px]:text-11"
                    style={{
                      color: dead ? "var(--dead)" : hot(k) ? "var(--hot)" : "var(--hi)",
                      boxShadow: `inset 0 0 0 1px ${dead ? "color-mix(in srgb, var(--dead) 55%, transparent)" : hot(k) ? "var(--hot)" : "var(--line-2)"}`,
                      background: hot(k) && !dead ? "color-mix(in srgb, var(--hot) 12%, var(--bg))" : "var(--bg)",
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
