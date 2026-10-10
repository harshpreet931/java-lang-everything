"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration } from "./kit";

// ConcurrentHashMap.transfer() with two helping threads, following the jdk 25 source:
//   - the first resizer CASes sizeCtl from the threshold to (resizeStamp(n) << 16) + 2,
//     each helper adds 1, each thread leaving subtracts 1. resizeStamp(64) = 25 | 0x8000.
//   - stride = max(16, (n >>> 3) / NCPU). for n = 64 that's 16 (MIN_TRANSFER_STRIDE).
//   - threads claim [transferIndex - stride, transferIndex) by CAS and walk it top down.
//   - empty bin: CAS in the ForwardingNode. full bin: synchronized on the first node,
//     split into i and i + n, then the ForwardingNode goes in.
//   - the last thread out re-sweeps every bin, then table = nextTab, sizeCtl = 2n - n/2.
// which bins hold nodes is invented for the picture; the protocol is the real one.

const N = 64;
const full = (i: number) => (Math.imul(i + 7, 0x9e3779b1) >>> 0) % 10 < 7;
const loGets = (i: number) => full(i) && (i * 7) % 3 !== 0;
const hiGets = (i: number) => full(i) && ((i * 7) % 3 === 0 || (i * 5) % 3 !== 1);

type R = [number, number]; // inclusive, processed
type S = {
  done: R[];
  claimA?: [number, number]; // [lo, hi)
  claimB?: [number, number];
  curA?: number;
  curB?: number;
  ti: string;
  sc: [string, string]; // hex, meaning
  next: boolean;
  a: string;
  b: string;
  c: string;
  commit?: boolean;
  readBin?: number;
  note: string;
};

const STEPS: S[] = [
  {
    done: [],
    ti: "0",
    sc: ["48", "the resize threshold (64 × 0.75)"],
    next: false,
    a: "put(k, v) → addCount: count is 48, 48 >= sizeCtl",
    b: "·",
    c: "·",
    note: "48 entries in a Node[64]. while there's no resize going on, sizeCtl just holds the threshold. A's put pushes the count to 48, so addCount decides it's time.",
  },
  {
    done: [],
    ti: "64",
    sc: ["0x8019_0002", "resize stamp for 64 | 1 resizer + 1"],
    next: true,
    a: "CAS sizeCtl: 48 → (rs << 16) + 2, then transfer(tab, null)",
    b: "·",
    c: "·",
    note: "A wins a CAS on sizeCtl and makes it negative: the top 16 bits are a stamp for 'resizing from 64', the bottom 16 bits count resizers (+1). A allocates nextTable, a Node[128], and sets transferIndex to 64.",
  },
  {
    done: [],
    claimA: [48, 64],
    curA: 63,
    ti: "48",
    sc: ["0x8019_0002", "1 resizer"],
    next: true,
    a: "CAS transferIndex 64 → 48. my bins: 48..63",
    b: "·",
    c: "·",
    note: "work is handed out in strides. on a 64-bin table the stride is the minimum, 16. A claims bins 48 to 63 with a CAS on transferIndex and walks them from the top down.",
  },
  {
    done: [[56, 63]],
    claimA: [48, 64],
    curA: 55,
    ti: "48",
    sc: ["0x8019_0002", "1 resizer"],
    next: true,
    a: "bin 55: synchronized (f) { split lo / hi }",
    b: "·",
    c: "·",
    note: "bin by bin: an empty bin just gets a ForwardingNode by CAS. a full bin is locked on its first node, split into bin i and bin i + 64 of the new table, then replaced by the ForwardingNode (hash MOVED, which is -1).",
  },
  {
    done: [[52, 63]],
    claimA: [48, 64],
    claimB: [32, 48],
    curA: 51,
    curB: 47,
    ti: "32",
    sc: ["0x8019_0003", "2 resizers"],
    next: true,
    a: "bin 51 …",
    b: "put → bin 60 is MOVED → helpTransfer: CAS sizeCtl + 1, claim 32..47",
    c: "·",
    note: "B wants to put a key into bin 60 and finds a ForwardingNode there. instead of waiting, it joins in: sizeCtl + 1, then it claims the next stride, 32 to 47. its put retries once the resize is done.",
  },
  {
    done: [
      [48, 63],
      [42, 47],
    ],
    claimA: [48, 64],
    claimB: [32, 48],
    curB: 41,
    ti: "32",
    sc: ["0x8019_0003", "2 resizers"],
    next: true,
    readBin: 58,
    a: "stride 48..63 done",
    b: "bin 41 …",
    c: "get(k) → bin 58 is a ForwardingNode → find() in nextTable",
    note: "C calls get on a key in bin 58. it's already been moved, so get follows the ForwardingNode's nextTable and looks in bin 58 or 122 of the new array. readers never help and never wait.",
  },
  {
    done: [
      [48, 63],
      [38, 47],
    ],
    claimA: [16, 32],
    claimB: [32, 48],
    curA: 31,
    curB: 37,
    ti: "16",
    sc: ["0x8019_0003", "2 resizers"],
    next: true,
    a: "CAS transferIndex 32 → 16. my bins: 16..31",
    b: "bin 37 …",
    c: "·",
    note: "A finished its stride. transferIndex says there's more, so A grabs the next one, 16 to 31. nobody coordinates this, the CAS on transferIndex is the whole scheduler.",
  },
  {
    done: [
      [32, 63],
      [24, 31],
    ],
    claimA: [16, 32],
    claimB: [0, 16],
    curA: 23,
    curB: 15,
    ti: "0",
    sc: ["0x8019_0003", "2 resizers"],
    next: true,
    a: "bin 23 …",
    b: "CAS transferIndex 16 → 0. my bins: 0..15",
    c: "·",
    note: "B finishes 32 to 47 and takes the last stride. transferIndex is 0 now: nothing left to hand out, even if a third thread showed up.",
  },
  {
    done: [
      [16, 63],
      [6, 15],
    ],
    claimB: [0, 16],
    curB: 5,
    ti: "0",
    sc: ["0x8019_0002", "1 resizer"],
    next: true,
    a: "no work left: CAS sizeCtl − 1. not the last one out, return",
    b: "bin 5 …",
    c: "·",
    note: "A runs out of work and leaves: sizeCtl − 1. the low bits say someone is still in there, so A just returns to its put.",
  },
  {
    done: [[0, 63]],
    ti: "0",
    sc: ["0x8019_0001", "last one out"],
    next: true,
    a: "·",
    b: "CAS sizeCtl − 1 → last one out: re-check all 64 bins",
    c: "·",
    note: "B finishes 0 to 15 and decrements. sizeCtl minus 2 equals the bare stamp, so B was the last resizer. before committing it sweeps all 64 old bins once more to make sure every one is a ForwardingNode.",
  },
  {
    done: [[0, 63]],
    ti: "0",
    sc: ["96", "the next threshold: 128 − 32"],
    next: true,
    commit: true,
    a: "·",
    b: "table = nextTab; nextTable = null; sizeCtl = 96",
    c: "·",
    note: "commit: the new array becomes the table and sizeCtl goes back to being a threshold (128 × 0.75). the old array full of ForwardingNodes is garbage once no reader is still walking it.",
  },
];

const inDone = (st: S, i: number) => st.done.some(([a, b]) => i >= a && i <= b);

export function CoopResize() {
  const s = useStepper(STEPS.length, { interval: 2400 });
  const st = STEPS[s.i];
  const prev = s.i > 0 ? STEPS[s.i - 1] : undefined;

  return (
    <div {...s.keys} className="@container outline-none" aria-label="ConcurrentHashMap resize with helping threads, step by step">
      <div className="grid gap-x-6 gap-y-1 text-12 @[600px]:grid-cols-3">
        <Field k="sizeCtl" v={st.sc[0]} sub={st.sc[1]} changed={!!prev && prev.sc[0] !== st.sc[0]} />
        <Field k="transferIndex" v={st.ti} changed={!!prev && prev.ti !== st.ti} />
        <Field k="nextTable" v={st.commit ? "null" : st.next ? "Node[128]" : "null"} changed={!!prev && (prev.next !== st.next || (!!st.commit && !prev.commit))} />
      </div>

      <div className={`mt-5 transition-opacity duration-300 ${st.commit ? "opacity-50" : ""}`}>
        <div className="mb-1.5 flex justify-between text-12">
          <span className="text-ink">
            old table <span className="text-faint">· Node[64]</span>
            {st.commit && <span className="ml-2 text-dead">garbage once readers are done</span>}
          </span>
          <span className="hidden text-11 text-faint @[480px]:inline">
            <span className="text-meta">▪</span> ForwardingNode
          </span>
        </div>
        <div className="grid gap-1.5">
          {[0, 16, 32, 48].map((from) => {
            const ranges = (
              [
                ["A", st.claimA],
                ["B", st.claimB],
              ] as const
            ).filter(([, r]) => r && r[0] === from);
            return (
              <div key={from}>
                <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-px">
                  {Array.from({ length: 16 }, (_, c) => {
                    const i = from + c;
                    const moved = inDone(st, i);
                    const cur = st.curA === i || st.curB === i;
                    const read = st.readBin === i;
                    return (
                      <div
                        key={i}
                        className="flex h-6 items-center justify-center text-[9px] transition-[box-shadow,background-color] duration-200"
                        style={{
                          boxShadow: `inset 0 0 0 1px ${
                            cur || read ? "var(--hot)" : moved ? (st.commit ? "color-mix(in srgb, var(--dead) 55%, transparent)" : "color-mix(in srgb, var(--meta) 60%, transparent)") : "var(--line-2)"
                          }`,
                          background: moved ? "color-mix(in srgb, var(--meta) 14%, transparent)" : cur ? "color-mix(in srgb, var(--hot) 12%, transparent)" : undefined,
                        }}
                        title={`bin ${i}`}
                      >
                        {moved ? (
                          <span className="text-meta">↗</span>
                        ) : full(i) ? (
                          <span className="size-[5px] rounded-full bg-ink" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] text-faint tabular">
                  <span>{from}</span>
                  <span className="flex gap-3">
                    {ranges.map(([who]) => (
                      <span key={who} className="text-hot">
                        claimed by {who}
                      </span>
                    ))}
                  </span>
                  <span>{from + 15}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`mt-4 transition-opacity duration-300 ${st.next ? "" : "opacity-25"}`}>
        <div className="mb-1.5 text-12 text-ink">
          {st.commit ? "table" : "nextTable"} <span className="text-faint">· Node[128], bins i and i + 64</span>
        </div>
        <div className="grid gap-3 @[600px]:grid-cols-2">
          {[0, 64].map((off) => (
            <div key={off}>
              <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-px">
                {Array.from({ length: 64 }, (_, i) => {
                  const has = inDone(st, i) && (off === 0 ? loGets(i) : hiGets(i));
                  const read = st.readBin === i && off === 64;
                  return (
                    <div
                      key={i}
                      className="flex h-3 items-center justify-center transition-[box-shadow] duration-200"
                      style={{ boxShadow: `inset 0 0 0 1px ${read ? "var(--hot)" : st.commit ? "var(--live)" : "var(--line)"}` }}
                    >
                      {has && <span className="size-1 rounded-full bg-ink" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-0.5 text-[10px] text-faint tabular">
                {off === 0 ? "0..63 (lo)" : "64..127 (hi)"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-1.5 text-12">
        {(
          [
            ["A", st.a, "started the resize"],
            ["B", st.b, "a writer that came to help"],
            ["C", st.c, "a reader"],
          ] as const
        ).map(([who, what, role]) => (
          <div key={who} className="grid grid-cols-[2.5ch_minmax(0,1fr)] gap-2 border-t border-line pt-1.5">
            <span className="text-hi" title={role}>
              {who}
            </span>
            <span className={what === "·" ? "text-faint" : "text-ink"}>{what === "·" ? role : what}</span>
          </div>
        ))}
      </div>

      <Narration className="mt-4">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

function Field({ k, v, sub, changed }: { k: string; v: string; sub?: string; changed?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 border-b border-line py-1.5">
      <span className="text-faint">{k} =</span>
      <span key={v} className={`tabular ${changed ? "flash text-hot" : "text-hi"}`}>
        {v}
      </span>
      {sub && <span className="w-full text-11 text-faint">{sub}</span>}
    </div>
  );
}
