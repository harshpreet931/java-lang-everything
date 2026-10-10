"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Legend, Readout, Row, Stat, rng, useReducedMotion } from "./kit";

// a generational heap you can drive: eden, two survivor spaces, an old gen and its card table.
// a model with Serial/Parallel-style rules:
//   - new objects go in eden. a full eden triggers a minor GC.
//   - a minor GC copies live eden + from-survivor objects into to-survivor, age + 1.
//   - age >= tenuring threshold, or no room in to-survivor: promote to old.
//   - an old → young reference dirties a card; the minor GC scans dirty cards as extra roots.
//   - a full old gen needs a full GC (mark-compact of everything).
// lifetimes follow the weak generational hypothesis: most objects die almost immediately.

const EDEN = 16;
const SURV = 8;
const OLD = 32;
const CARD = 4; // old-gen slots per card

type O = { id: number; born: number; life: number; age: number; pinnedBy?: number };
type Sp = (O | null)[];
type State = {
  t: number;
  next: number;
  eden: Sp;
  surv: [Sp, Sp];
  from: 0 | 1;
  old: Sp;
  cards: boolean[];
  moved: Set<number>;
  scanCard: number | null;
  note: string;
  stats: { minor: number; full: number; copied: number; promoted: number; early: number; lastCopied: number };
};

const empty = (n: number): Sp => Array(n).fill(null);

const fresh = (): State => ({
  t: 0,
  next: 1,
  eden: empty(EDEN),
  surv: [empty(SURV), empty(SURV)],
  from: 0,
  old: empty(OLD),
  cards: Array(OLD / CARD).fill(false),
  moved: new Set(),
  scanCard: null,
  note: "an empty heap. press allocate (or let it run) and watch how few objects make it out of eden.",
  stats: { minor: 0, full: 0, copied: 0, promoted: 0, early: 0, lastCopied: 0 },
});

function lifetime(r: () => number) {
  const x = r();
  if (x < 0.8) return 1 + Math.floor(r() * 3); // dies almost immediately
  if (x < 0.93) return 12 + Math.floor(r() * 22); // lives a little while
  return 180 + Math.floor(r() * 300); // a long-lived one (a cache entry, a session)
}

function alive(o: O, s: State): boolean {
  if (o.pinnedBy !== undefined) {
    const holder = s.old.find((x) => x && x.id === o.pinnedBy);
    if (holder && alive(holder, s)) return true;
  }
  return s.t < o.born + o.life;
}

function compactOld(s: State, old: Sp): { old: Sp; freed: number } {
  const keep = old.filter((o): o is O => !!o && alive(o, s));
  return { old: [...keep, ...empty(OLD - keep.length)], freed: old.filter(Boolean).length - keep.length };
}

function minorGC(s0: State, threshold: number, why: string): State {
  const s: State = { ...s0, eden: [...s0.eden], surv: [[...s0.surv[0]], [...s0.surv[1]]], old: [...s0.old], cards: [...s0.cards], moved: new Set() };
  const from = s.surv[s.from];
  const to = empty(SURV);
  const young = [...from, ...s.eden].filter((o): o is O => !!o);
  const live = young.filter((o) => alive(o, s));
  const viaCard = live.filter((o) => o.pinnedBy !== undefined && o.born + o.life <= s.t);
  const dirty = s.cards.findIndex(Boolean);
  let copied = 0;
  let promoted = 0;
  let early = 0;
  let fullNeeded = false;
  let ti = 0;
  const promote = (o: O) => {
    let i = s.old.findIndex((x) => x === null);
    if (i < 0) {
      const c = compactOld(s, s.old);
      s.old = c.old;
      s.stats = { ...s.stats, full: s.stats.full + 1 };
      fullNeeded = true;
      i = s.old.findIndex((x) => x === null);
    }
    if (i >= 0) {
      s.old[i] = o;
      s.moved.add(o.id);
    }
  };
  for (const o0 of live) {
    const o = { ...o0, age: o0.age + 1 };
    if (o.age >= threshold) {
      promote(o);
      promoted++;
    } else if (ti < SURV) {
      to[ti++] = o;
      s.moved.add(o.id);
      copied++;
    } else {
      promote(o);
      promoted++;
      early++;
    }
  }
  s.eden = empty(EDEN);
  s.surv[s.from] = empty(SURV);
  s.surv[s.from === 0 ? 1 : 0] = to;
  s.from = s.from === 0 ? 1 : 0;
  s.cards = s.cards.map(() => false);
  s.scanCard = dirty >= 0 ? dirty : null;
  s.stats = {
    ...s.stats,
    minor: s.stats.minor + 1,
    copied: s.stats.copied + copied,
    promoted: s.stats.promoted + promoted,
    early: s.stats.early + early,
    lastCopied: copied + promoted,
  };
  const dead = young.length - live.length;
  const parts = [
    `${why}minor GC #${s.stats.minor}: ${live.length} of ${young.length} young objects were still alive. ${dead} died young and cost nothing.`,
    copied ? `${copied} copied to the other survivor space (age + 1).` : "",
    promoted - early ? `${promoted - early} reached age ${threshold} and got promoted to old.` : "",
    early ? `${early} got promoted early: the survivor space was full (premature promotion).` : "",
    viaCard.length ? `the dirty card was scanned too: it kept ${viaCard.map((o) => `#${o.id}`).join(", ")} alive, even though no root points at ${viaCard.length > 1 ? "them" : "it"}.` : "",
    fullNeeded ? "the old gen was full, so this turned into a full GC first (everything, old gen included, stop the world)." : "",
  ];
  s.note = parts.filter(Boolean).join(" ");
  return s;
}

function allocate(s0: State, r: () => number, threshold: number): State {
  let s = s0;
  let why = "";
  if (!s.eden.includes(null)) {
    s = minorGC(s, threshold, "eden is full, so allocation triggers a ");
    why = s.note;
  }
  const i = s.eden.findIndex((x) => x === null);
  const o: O = { id: s.next, born: s.t, life: lifetime(r), age: 0 };
  const eden = [...s.eden];
  eden[i] = o;
  const next: State = { ...s, eden, t: s.t + 1, next: s.next + 1, moved: why ? s.moved : new Set([o.id]), scanCard: why ? s.scanCard : null };
  next.note = why ? why.replace(/^eden is full, so allocation triggers a minor/, "eden was full, so that allocation triggered minor") : `new object #${o.id} goes into eden (a pointer bump in a TLAB). eden: ${i + 1}/${EDEN}.`;
  return next;
}

function fullGC(s0: State, threshold: number): State {
  const s = minorGC(s0, threshold, "");
  const c = compactOld(s, s.old);
  return {
    ...s,
    old: c.old,
    stats: { ...s.stats, full: s.stats.full + 1 },
    note: `full GC: young and old, everything at once. ${c.freed} dead objects in the old gen were reclaimed and the rest compacted. in Serial and Parallel this is the long stop-the-world pause you don't want often.`,
  };
}

function oldToYoung(s0: State): State {
  const oi = s0.old.findIndex((o) => o && alive(o, s0) && o.life > 100);
  const anyOld = s0.old.findIndex((o) => o && alive(o, s0));
  const holderIdx = oi >= 0 ? oi : anyOld;
  const yi = s0.eden.findLastIndex((o) => o && o.pinnedBy === undefined);
  if (holderIdx < 0) return { ...s0, note: "nothing lives in the old gen yet. allocate and collect a few times first." };
  if (yi < 0) return { ...s0, note: "eden is empty. allocate something first, then point an old object at it." };
  const holder = s0.old[holderIdx]!;
  const eden = [...s0.eden];
  const y = { ...eden[yi]!, pinnedBy: holder.id, life: 0, born: s0.t };
  eden[yi] = y;
  const cards = [...s0.cards];
  cards[Math.floor(holderIdx / CARD)] = true;
  return {
    ...s0,
    eden,
    cards,
    moved: new Set([holder.id, y.id]),
    scanCard: null,
    note: `old #${holder.id}.field = young #${y.id}. nothing else points at #${y.id}. the write barrier marks the card covering #${holder.id} dirty, so the next minor GC knows to look there, without scanning the whole old gen.`,
  };
}

export function GenHeap() {
  const [s, setS] = useState<State>(fresh);
  const [threshold, setThreshold] = useState(3);
  const [playing, setPlaying] = useState(false);
  const r = useRef(rng(11));
  const reduce = useReducedMotion();

  const alloc = useCallback(() => setS((cur) => allocate(cur, r.current, threshold)), [threshold]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(alloc, reduce ? 200 : 420);
    return () => clearInterval(id);
  }, [playing, alloc, reduce]);

  const reset = () => {
    setPlaying(false);
    r.current = rng(11);
    setS(fresh());
  };

  const st = s.stats;
  const oldUsed = s.old.filter(Boolean).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 [--slot:28px] sm:[--slot:32px]">
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <Space label="eden" sub={`${s.eden.filter(Boolean).length}/${EDEN}`} cells={s.eden} cols={8} s={s} threshold={threshold} />
        <Space label={`survivor ${s.from === 0 ? "S0 (from)" : "S0 (to)"}`} cells={s.surv[0]} cols={4} s={s} threshold={threshold} />
        <Space label={`survivor ${s.from === 1 ? "S1 (from)" : "S1 (to)"}`} cells={s.surv[1]} cols={4} s={s} threshold={threshold} />
      </div>
      <div>
        <Space label="old gen" sub={`${oldUsed}/${OLD}`} cells={s.old} cols={8} s={s} threshold={threshold} cards={s.cards} scanCard={s.scanCard} />
        <div className="mt-1 text-11 text-faint">
          the bar under every 4 old slots is their <span className="text-meta">card</span>. filled = dirty.
        </div>
      </div>

      <Readout minLines={3}>{s.note}</Readout>

      <div className="grid grid-cols-3 gap-3 border-t border-line pt-3 sm:grid-cols-5">
        <Stat k="minor GCs" v={st.minor} />
        <Stat k="copied" v={st.copied} />
        <Stat k="promoted" v={st.promoted} />
        <Stat k="promoted early" v={st.early} tone={st.early ? "hot" : undefined} />
        <Stat k="full GCs" v={st.full} tone={st.full ? "dead" : undefined} />
      </div>

      <div>
        <Row k="tenure at">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={1}
            max={8}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="tenuring threshold"
          />
          <span className="w-[7ch] text-right text-hi tabular">age {threshold}</span>
        </Row>
        <div className="flex flex-wrap gap-2 pt-3">
          <button className="act solid" onClick={alloc}>
            allocate
          </button>
          <button className="act min-w-[9ch]" onClick={() => setPlaying((p) => !p)}>
            {playing ? "pause" : "keep going"}
          </button>
          <button className="act" onClick={() => setS((cur) => minorGC(cur, threshold, ""))}>
            minor GC
          </button>
          <button className="act" onClick={() => setS((cur) => oldToYoung(cur))}>
            old → young ref
          </button>
          <button className="act" onClick={() => setS((cur) => fullGC(cur, threshold))}>
            full GC
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </div>
      </div>
      <Legend
        items={[
          ["live", "reachable"],
          ["dead", "garbage, not collected yet"],
          ["hot", "just allocated or moved"],
          ["ref", "held only by an old object"],
          ["meta", "card table"],
        ]}
      />
    </div>
  );
}

function Space({
  label,
  sub,
  cells,
  cols,
  s,
  threshold,
  cards,
  scanCard,
}: {
  label: string;
  sub?: string;
  cells: Sp;
  cols: number;
  s: State;
  threshold: number;
  cards?: boolean[];
  scanCard?: number | null;
}) {
  const rows = Array.from({ length: Math.ceil(cells.length / cols) }, (_, r) => cells.slice(r * cols, r * cols + cols));
  return (
    <div className="w-max max-w-full min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-11 text-faint">
        <span>{label}</span>
        {sub && <span className="tabular">{sub}</span>}
      </div>
      <div className="grid w-max gap-[3px] rounded-md p-[3px] shadow-[inset_0_0_0_1px_var(--line-2)]">
        {rows.map((row, r) => (
          <div key={r} className="grid gap-[3px]">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, var(--slot))` }}>
              {row.map((o, j) => slot(o, r * cols + j, s, threshold, label))}
            </div>
            {cards && (
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols / CARD}, 1fr)` }}>
                {Array.from({ length: cols / CARD }, (_, k) => {
                  const ci = (r * cols) / CARD + k;
                  const dirty = cards[ci];
                  return (
                    <span
                      key={k}
                      className="h-[5px] rounded-[1px] transition-colors duration-200"
                      style={{
                        background: dirty ? "var(--meta)" : scanCard === ci ? "color-mix(in srgb, var(--meta) 40%, transparent)" : "transparent",
                        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--meta) 55%, transparent)",
                      }}
                      title={dirty ? "dirty card" : "clean card"}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function slot(o: O | null, i: number, s: State, threshold: number, label: string) {
  if (!o) return <span key={`e${i}`} className="aspect-square rounded-[3px] bg-bg" style={{ width: "var(--slot)" }} />;
  const live = alive(o, s);
  const moved = s.moved.has(o.id);
  const pinned = o.pinnedBy !== undefined && o.born + o.life <= s.t && live;
  const tone = moved ? "hot" : !live ? "dead" : pinned ? "ref" : "live";
  return (
    <span
      key={o.id}
      className="relative flex aspect-square items-center justify-center rounded-[3px] text-11 tabular transition-[box-shadow,background-color] duration-200 ease-jle"
      style={{
        width: "var(--slot)",
        color: `var(--${tone})`,
        background: `color-mix(in srgb, var(--${tone}) ${live ? 14 : 8}%, var(--bg))`,
        boxShadow: `inset 0 0 0 ${moved ? 1.6 : 1}px var(--${tone})`,
        opacity: live ? 1 : 0.8,
      }}
      title={`#${o.id}, age ${o.age}${live ? "" : ", garbage"}`}
    >
      {o.age}
      {o.age >= threshold - 1 && live && label !== "old gen" && (
        <span className="absolute top-[1px] right-[3px] text-[8px] leading-none" style={{ color: "var(--hot)" }}>
          •
        </span>
      )}
    </span>
  );
}
