"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Legend, Readout, Stat, rng, useReducedMotion } from "./kit";

// three threads allocating into eden through their own TLABs.
// a model, not a measurement: eden is 96 slots, a TLAB is 16, objects are 1 to 3.
// the rules are HotSpot's: bump inside the TLAB; when the next object doesn't fit,
// either retire the TLAB (if what's left is small enough to waste) and carve a new one
// with one CAS on eden's shared top, or allocate this one object outside the TLAB.

const EDEN = 96;
const TLAB = 16;
const WASTE_LIMIT = 2; // HotSpot: the TLAB's size / 64. scaled up here so you can see it
const BIG = 20;
const THREADS = 3;

type Piece = { start: number; size: number; kind: "obj" | "waste" | "direct" | "big"; owner?: number; id: number };
type Tlab = { start: number; top: number; end: number };
type State = {
  edenTop: number;
  pieces: Piece[];
  tlabs: (Tlab | null)[];
  retired: { start: number; end: number; owner: number }[];
  last: number | null;
  note: string;
  stats: { allocs: number; fast: number; refills: number; cas: number; waste: number; gcs: number };
};

const fresh = (): State => ({
  edenTop: 0,
  pieces: [],
  tlabs: Array(THREADS).fill(null),
  retired: [],
  last: null,
  note: "eden is empty and no thread has a TLAB yet. press allocate.",
  stats: { allocs: 0, fast: 0, refills: 0, cas: 0, waste: 0, gcs: 0 },
});

let nextId = 1;

function gc(s: State, why: string, retry: (s: State) => State): State {
  const after: State = { ...fresh(), stats: { ...s.stats, gcs: s.stats.gcs + 1 } };
  const r = retry(after);
  return {
    ...r,
    note: `${why} eden is full, so every thread stops for a young GC: survivors get copied out, eden (and every TLAB) starts over empty. then the allocation retries.`,
  };
}

function allocate(s0: State, t: number, size: number): State {
  const s: State = {
    ...s0,
    pieces: [...s0.pieces],
    tlabs: [...s0.tlabs],
    retired: [...s0.retired],
    stats: { ...s0.stats, allocs: s0.stats.allocs + 1 },
  };
  const T = `T${t + 1}`;
  const tl = s.tlabs[t];

  // fast path: bump the pointer
  if (tl && tl.top + size <= tl.end) {
    const id = nextId++;
    s.pieces.push({ start: tl.top, size, kind: "obj", owner: t, id });
    s.tlabs[t] = { ...tl, top: tl.top + size };
    s.last = id;
    s.stats.fast++;
    s.note = `fast path: ${T} puts a ${size}-slot object at its top and bumps top by ${size}. no lock, no CAS. nobody else allocates in this TLAB.`;
    return s;
  }

  const left = tl ? tl.end - tl.top : 0;

  // too much room left to throw away: allocate this one outside the TLAB
  if (tl && left > WASTE_LIMIT) {
    if (s.edenTop + size > EDEN) return gc(s0, `${T} needs ${size} slots outside its TLAB.`, (f) => allocate(f, t, size));
    const id = nextId++;
    s.pieces.push({ start: s.edenTop, size, kind: "direct", owner: t, id });
    s.edenTop += size;
    s.stats.cas++;
    s.last = id;
    s.note = `slow path: ${T}'s TLAB has ${left} slots left, not enough for ${size}, but too many to waste. so this one object goes straight into eden with a CAS on the shared top, and the TLAB stays.`;
    return s;
  }

  // retire the old TLAB (pad the tail with a filler), carve a new one
  if (s.edenTop + TLAB > EDEN) return gc(s0, `${T} needs a new TLAB and there's no room for one.`, (f) => allocate(f, t, size));
  let pre = "";
  if (tl) {
    if (left > 0) {
      s.pieces.push({ start: tl.top, size: left, kind: "waste", owner: t, id: nextId++ });
      s.stats.waste += left;
    }
    s.retired.push({ start: tl.start, end: tl.end, owner: t });
    pre = left
      ? `${T}'s TLAB can't fit ${size} slots. the ${left} left over get a filler object (wasted on purpose, so the heap stays walkable). `
      : `${T}'s TLAB is exactly full. `;
  }
  const nt: Tlab = { start: s.edenTop, top: s.edenTop, end: s.edenTop + TLAB };
  s.edenTop += TLAB;
  s.stats.cas++;
  s.stats.refills++;
  const id = nextId++;
  s.pieces.push({ start: nt.top, size, kind: "obj", owner: t, id });
  nt.top += size;
  s.tlabs[t] = nt;
  s.last = id;
  s.note = `${pre}${T} grabs a fresh ${TLAB}-slot TLAB from eden with one CAS on the shared top, then bump-allocates into it.`;
  return s;
}

function allocateBig(s0: State): State {
  const s: State = { ...s0, pieces: [...s0.pieces], stats: { ...s0.stats, allocs: s0.stats.allocs + 1 } };
  if (s.edenTop + BIG > EDEN) return gc(s0, `a ${BIG}-slot array needs room.`, (f) => allocateBig(f));
  const id = nextId++;
  s.pieces.push({ start: s.edenTop, size: BIG, kind: "big", id });
  s.edenTop += BIG;
  s.stats.cas++;
  s.last = id;
  s.note = `a ${BIG}-slot array is bigger than any TLAB, so it skips them entirely and goes straight into eden (one CAS). in G1, an object of half a region or more doesn't even go to eden: it gets its own humongous regions.`;
  return s;
}

export function TlabSim() {
  const [s, setS] = useState<State>(fresh);
  const [playing, setPlaying] = useState(false);
  const rand = useRef(rng(7));
  const reduce = useReducedMotion();

  const step = useCallback(() => {
    const r = rand.current;
    const t = Math.floor(r() * THREADS);
    const size = 1 + Math.floor(r() * 3);
    setS((cur) => allocate(cur, t, size));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(step, reduce ? 250 : 650);
    return () => clearInterval(id);
  }, [playing, step, reduce]);

  const reset = () => {
    setPlaying(false);
    rand.current = rng(7);
    setS(fresh());
  };

  const st = s.stats;
  const fastPct = st.allocs ? Math.round((st.fast / st.allocs) * 100) : 0;

  return (
    <div className="grid gap-5">
      {/* eden overview */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-11 text-faint">
          <span>eden, shared</span>
          <span className="tabular">
            {s.edenTop}/{EDEN} slots taken
          </span>
        </div>
        <EdenBar s={s} />
      </div>

      {/* per-thread TLABs, zoomed */}
      <div className="grid gap-2.5">
        {s.tlabs.map((tl, t) => (
          <Lane key={t} t={t} tl={tl} s={s} />
        ))}
      </div>

      <Readout minLines={3}>{s.note}</Readout>

      <div className="grid grid-cols-3 gap-3 border-t border-line pt-3 sm:grid-cols-6">
        <Stat k="objects" v={st.allocs} />
        <Stat k="fast path" v={`${fastPct}%`} />
        <Stat k="TLAB refills" v={st.refills} />
        <Stat k="CAS on eden" v={st.cas} />
        <Stat k="slots wasted" v={st.waste} />
        <Stat k="young GCs" v={st.gcs} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="act solid" onClick={step}>
          allocate
        </button>
        <button className="act min-w-[9ch]" onClick={() => setPlaying((p) => !p)}>
          {playing ? "pause" : "keep going"}
        </button>
        <button className="act" onClick={() => setS((cur) => allocateBig(cur))}>
          new byte[big]
        </button>
        <button className="act" onClick={reset}>
          reset
        </button>
      </div>
      <Legend
        items={[
          ["hot", "just allocated"],
          ["meta", "TLAB bounds and top pointers"],
          ["mute", "filler (waste)"],
        ]}
      />
    </div>
  );
}

function pieceStyle(p: Piece, last: number | null) {
  if (p.kind === "waste")
    return {
      background: "repeating-linear-gradient(135deg, var(--line-2) 0 1px, transparent 1px 4px)",
      boxShadow: "inset 0 0 0 1px var(--line-2)",
    };
  const hot = p.id === last;
  return {
    background: hot ? "color-mix(in srgb, var(--hot) 30%, transparent)" : "color-mix(in srgb, var(--ink) 16%, transparent)",
    boxShadow: `inset 0 0 0 1px ${hot ? "var(--hot)" : "color-mix(in srgb, var(--ink) 45%, transparent)"}`,
  };
}

function EdenBar({ s }: { s: State }) {
  const pct = (n: number) => `${((n / EDEN) * 100).toFixed(3)}%`;
  const live = s.tlabs.map((tl, owner) => (tl ? { ...tl, owner } : null)).filter(Boolean) as (Tlab & { owner: number })[];
  return (
    <div className="relative">
      <div
        className="relative h-9 overflow-hidden rounded-xs bg-bg shadow-[inset_0_0_0_1px_var(--line-2)]"
        role="img"
        aria-label={`eden: ${s.edenTop} of ${EDEN} slots handed out`}
      >
        {s.pieces.map((p) => (
          <div
            key={p.id}
            className="absolute inset-y-[5px] rounded-[1px]"
            style={{ left: pct(p.start), width: pct(p.size), ...pieceStyle(p, s.last) }}
          />
        ))}
        {[...s.retired, ...live].map((r, i) => (
          <div
            key={`${r.start}-${i}`}
            className="absolute inset-y-[2px] rounded-[1px]"
            style={{ left: pct(r.start), width: pct(r.end - r.start), boxShadow: "inset 0 0 0 1px var(--meta)", opacity: i < s.retired.length ? 0.4 : 1 }}
          >
            <span className="absolute top-[1px] left-[3px] hidden text-[9px] leading-none text-meta sm:block">T{r.owner + 1}</span>
          </div>
        ))}
      </div>
      {/* the shared top */}
      <div className="relative h-5">
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center text-[10px] leading-3 text-meta transition-[left] duration-200 ease-jle"
          style={{ left: pct(s.edenTop) }}
        >
          <span>▲</span>
          <span className="whitespace-nowrap">top</span>
        </div>
      </div>
    </div>
  );
}

function Lane({ t, tl, s }: { t: number; tl: Tlab | null; s: State }) {
  const pieces = tl ? s.pieces.filter((p) => p.start >= tl.start && p.start < tl.end && p.kind !== "direct" && p.kind !== "big") : [];
  const cells = Array.from({ length: TLAB }, (_, i) => i);
  return (
    <div className="grid grid-cols-[3ch_minmax(0,1fr)] items-start gap-2 text-12">
      <span className="pt-1 text-mute">T{t + 1}</span>
      {tl ? (
        <div>
          <div className="relative h-7 rounded-xs bg-bg shadow-[inset_0_0_0_1px_var(--meta)]">
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${TLAB}, minmax(0,1fr))` }}>
              {cells.map((c) => (
                <span key={c} className={c ? "border-l border-line" : ""} />
              ))}
            </div>
            {pieces.map((p) => (
              <div
                key={p.id}
                className="absolute inset-y-[4px] rounded-[1px]"
                style={{
                  left: `calc(${(((p.start - tl.start) / TLAB) * 100).toFixed(3)}% + 2px)`,
                  width: `calc(${((p.size / TLAB) * 100).toFixed(3)}% - 4px)`,
                  ...pieceStyle(p, s.last),
                }}
              />
            ))}
          </div>
          <div className="relative h-4">
            <span
              className="absolute top-0 -translate-x-1/2 text-[10px] leading-3 whitespace-nowrap text-meta transition-[left] duration-200 ease-jle"
              style={{ left: `${(((tl.top - tl.start) / TLAB) * 100).toFixed(3)}%` }}
            >
              ▲ top
            </span>
            <span className="absolute top-0 right-0 text-[10px] leading-3 text-meta">end</span>
          </div>
        </div>
      ) : (
        <div className="flex h-7 items-center text-11 text-faint">no TLAB</div>
      )}
    </div>
  );
}
