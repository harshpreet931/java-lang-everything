"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  COLS, GRID_R, H, PITCH, RING_W, ROWS, W, cells, edgeById, edgeId, edges, frameById, frames, nameOf, objById, objs,
  planMark, radius, startEdges, type Cell, type Tone,
} from "./heap";
import s from "./home.module.css";

/**
 * the hero instrument: a heap drawn in dots, and one garbage collection the reader runs
 * by hand. mark follows every reference from the stack, sweep frees what it never reached,
 * allocate drops a new object into a freed slot.
 *
 * the server renders the field as svg (with a css-only load wave), so there is never a blank
 * box. the first time the reader touches it, a canvas takes over for the animation.
 */

// ---------------------------------------------------------------------------- timing

const LEAD = 180; // mark dims the references before the first comet leaves
const DOT_MS = 28; // a comet crosses one dot in this long
const SCAN_MS = 120; // an object is scanned this long before its references go out
const SWEEP_GAP = 220;
const SWEEP_ROW = 55;
const SWEEP_DUR = 520;
const ALLOC_COL = 45;
const ALLOC_ROW = 30;
const ALLOC_DUR = 420;
const ALLOC_REF = 760;
const RESET_DUR = 380;

const planFull = planMark(DOT_MS, SCAN_MS, startEdges);
const cometOf = (plan: typeof planFull) => new Map(plan.comets.map((k) => [k.edge, k]));
// reduced motion: nothing travels. each level of the graph changes colour together.
const planStill = planMark(0, 300, startEdges);
// the load wave: the same walk, compressed into about a second
const planWave = planMark(13, 46, startEdges);
const cometFull = cometOf(planFull);
const cometStill = cometOf(planStill);
const cometWave = cometOf(planWave);

const garbage = objs.filter((o) => o.garbage).sort((a, b) => a.x - b.x);
const garbageIds = new Set(garbage.map((o) => o.id));
const reachableCount = planFull.marked.size;
const startCount = objs.filter((o) => !o.spawn).length;
const node = objs.find((o) => o.spawn)!;
const nodeEdge = edges.find((e) => e.spawn)!;

const sweepStart = (id: string) => garbage.findIndex((o) => o.id === id) * SWEEP_GAP;
const sweepDone = (id: string) => sweepStart(id) + (objById.get(id)!.h - 1) * SWEEP_ROW + SWEEP_DUR;
const SWEEP_END = Math.max(...garbage.map((o) => sweepDone(o.id))) + 120;
const ALLOC_END = ALLOC_REF + 4 * 45 + 320;
const markEnd = (still: boolean) => LEAD + (still ? planStill : planFull).end + 360;

type Phase = "idle" | "mark" | "sweep" | "alloc" | "reset";
type Clock = { phase: Phase; t: number };
const INF = 1e9;

// ---------------------------------------------------------------------------- the look of one dot

type RGB = [number, number, number];
type Pal = Record<Tone | "grid" | "book", RGB>;
type V = { r: number; col: RGB; fillA: number; strokeA: number; dy: number };

const hidden = (col: RGB): V => ({ r: 0, col, fillA: 0, strokeA: 0, dy: 0 });
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mix = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

const edgeFrom = (c: Cell) => edgeById.get(c.owner)!.from;
const isGarbageEdge = (c: Cell) => c.ownerType === "edge" && garbageIds.has(edgeFrom(c));

function base(c: Cell, P: Pal): V {
  if (c.spawn) return hidden(P[c.tone]);
  const r = radius(c);
  if (c.kind === "ring") return { r, col: P[c.tone], fillA: c.a * 0.22, strokeA: c.a, dy: 0 };
  return { r, col: P[c.tone], fillA: c.a, strokeA: 0, dy: 0 };
}

function markV(c: Cell, t: number, P: Pal, still: boolean): V {
  const v = base(c, P);
  if (c.spawn) return v;
  const plan = still ? planStill : planFull;
  const dim = clamp(t / LEAD);
  if (c.ownerType === "edge") {
    const comet = (still ? cometStill : cometFull).get(c.owner);
    if (!comet) return { ...v, fillA: v.fillA * lerp(1, 0.4, dim) };
    const at = LEAD + comet.start + c.i * (still ? 0 : DOT_MS);
    if (t < at) return { ...v, fillA: v.fillA * lerp(1, 0.35, dim) };
    const k = Math.exp(-(t - at) / (still ? 260 : 90));
    return { ...v, col: mix(P.ref, P.live, k * 0.9), r: v.r * (still ? 1 : 1 + 0.9 * k) };
  }
  if (c.ownerType === "frame" && c.root) {
    const k = t < LEAD ? t / LEAD : Math.exp(-(t - LEAD) / 240);
    return { ...v, col: mix(P.ref, P.live, k * 0.85) };
  }
  if (c.ownerType === "obj" && c.i > 0) {
    const m = plan.marked.get(c.owner);
    if (m == null) return v;
    const since = t - (LEAD + m + c.i * (still ? 0 : 22));
    if (since < 0) return v;
    return { ...v, col: mix(v.col, P.live, clamp(since / 200)), r: v.r * (still ? 1 : 1 + 0.22 * Math.exp(-since / 120)) };
  }
  return v;
}

function sweepV(c: Cell, t: number, P: Pal, still: boolean): V {
  const v = markV(c, INF, P, still);
  const owner = c.ownerType === "edge" ? edgeFrom(c) : c.owner;
  if (!garbageIds.has(owner)) return v;
  const o = objById.get(owner)!;
  const at = sweepStart(owner) + (c.ownerType === "edge" ? (o.h - 1) * SWEEP_ROW + c.i * 22 : (c.y - o.y) * SWEEP_ROW);
  const u = clamp((t - at) / SWEEP_DUR);
  const w = clamp((u - 0.3) / 0.7);
  return {
    ...v,
    fillA: c.kind === "ring" ? v.fillA * (1 - clamp(u / 0.4)) : v.fillA * (1 - w),
    strokeA: v.strokeA * (1 - w),
    r: still ? v.r : lerp(v.r, GRID_R, easeOut(w)),
  };
}

function allocV(c: Cell, t: number, P: Pal, still: boolean): V {
  const v = sweepV(c, INF, P, still);
  if (!c.spawn) return v;
  const r = radius(c);
  if (c.ownerType === "edge") {
    const since = t - (ALLOC_REF + c.i * 45);
    if (since < 0) return v;
    const k = Math.exp(-since / 120);
    return { r: r * (still ? 1 : 1 + 0.8 * k), col: P.ref, fillA: c.a * clamp(since / 120), strokeA: 0, dy: 0 };
  }
  const since = t - (c.i * ALLOC_COL + (c.y - node.y) * ALLOC_ROW);
  const u = clamp(since / ALLOC_DUR);
  if (u <= 0) return v;
  const e = easeOut(u);
  return { r, col: P[c.tone], fillA: c.a * clamp(u * 1.6), strokeA: 0, dy: still ? 0 : -(1 - e) * PITCH * 1.6 };
}

function at(c: Cell, k: Clock, P: Pal, still: boolean, from: Clock | null): V {
  switch (k.phase) {
    case "mark":
      return markV(c, k.t, P, still);
    case "sweep":
      return sweepV(c, k.t, P, still);
    case "alloc":
      return allocV(c, k.t, P, still);
    case "reset": {
      const a = from ? at(c, from, P, still, null) : base(c, P);
      const b = base(c, P);
      const u = easeInOut(clamp(k.t / RESET_DUR));
      return {
        r: a.fillA + a.strokeA === 0 ? b.r : b.fillA + b.strokeA === 0 ? a.r : lerp(a.r, b.r, u),
        col: mix(a.col, b.col, u),
        fillA: lerp(a.fillA, b.fillA, u),
        strokeA: lerp(a.strokeA, b.strokeA, u),
        dy: lerp(a.dy, b.dy, u),
      };
    }
    default:
      return base(c, P);
  }
}

// ---------------------------------------------------------------------------- what the readout says

type Count = { v: number; word: string; tone: "hi" | Tone };
type Readout = { counts: [Count, Count, Count]; say: string; step: number };

const SAY = {
  idle: "three stack frames hold references into the heap. press mark to run one collection.",
  mark: "mark: start at the stack frames and follow every reference. whatever is reached is live.",
  marked: `${reachableCount} objects reached. the ${garbage.length} rings were never reached, so no code can use them again.`,
  sweep: "sweep: every unreached object is freed, and its dots go back to the address space.",
  swept: `${garbage.length} objects freed. a Session still pointed at an old Order, but nothing pointed at the Session.`,
  alloc: "cache.put(key, value) needs a new HashMap.Node. it lands in a slot the sweep just freed.",
};

/** step: 0 idle, 1 marking, 2 marked, 3 sweeping, 4 swept, 5 allocating, 6 allocated */
function readout(k: Clock, still: boolean, from: Clock | null): Readout {
  const g = garbage.length;
  if (k.phase === "mark") {
    const plan = still ? planStill : planFull;
    let n = 0;
    for (const m of plan.marked.values()) if (k.t >= LEAD + m) n++;
    const done = k.t >= markEnd(still);
    return {
      counts: [{ v: n, word: "marked", tone: "live" }, { v: g, word: "unreachable", tone: "dead" }, { v: 1, word: "new", tone: "hot" }],
      say: done ? SAY.marked : SAY.mark,
      step: done ? 2 : 1,
    };
  }
  if (k.phase === "sweep") {
    const freed = garbage.filter((o) => k.t >= sweepDone(o.id)).length;
    const done = k.t >= SWEEP_END;
    return {
      counts: [{ v: reachableCount, word: "live", tone: "live" }, { v: g - freed, word: "unreachable", tone: "dead" }, { v: freed, word: "freed", tone: "hi" }],
      say: done ? SAY.swept : SAY.sweep,
      step: done ? 4 : 3,
    };
  }
  if (k.phase === "alloc") {
    const landed = k.t >= ALLOC_DUR;
    return {
      counts: [
        { v: reachableCount + (landed ? 1 : 0), word: "objects", tone: "hi" },
        { v: 0, word: "unreachable", tone: "dead" },
        { v: landed ? 1 : 0, word: "new", tone: "hot" },
      ],
      say: SAY.alloc,
      step: k.t >= ALLOC_END ? 6 : 5,
    };
  }
  if (k.phase === "reset" && from && k.t < RESET_DUR * 0.5) return readout(from, still, null);
  return {
    counts: [{ v: startCount, word: "objects", tone: "hi" }, { v: g, word: "unreachable", tone: "dead" }, { v: 1, word: "new", tone: "hot" }],
    say: SAY.idle,
    step: 0,
  };
}

/** which references exist at this point of the cycle */
function edgeVisible(id: string, step: number) {
  const e = edgeById.get(id)!;
  if (e.spawn) return step >= 5;
  if (garbageIds.has(e.from)) return step < 4;
  return true;
}
function objVisible(id: string, step: number) {
  const o = objById.get(id);
  if (!o) return true;
  if (o.spawn) return step >= 5;
  if (o.garbage) return step < 4;
  return true;
}

function describe(id: string, step: number): string {
  const f = frameById.get(id);
  if (f) {
    const out = edges.filter((e) => e.from === id && edgeVisible(edgeId(e), step));
    return `${f.name} is a stack frame, a gc root. it holds ${out.length === 1 ? "a reference" : `${out.length} references`}: ${out.map((e) => e.field).join(", ")}.`;
  }
  const o = objById.get(id)!;
  const inc = edges.filter((e) => e.to === id && edgeVisible(edgeId(e), step));
  const from = inc.map((e) => (frameById.has(e.from) ? `${e.field} in ${nameOf(e.from)}` : `${nameOf(e.from)}.${e.field}`));
  let line = inc.length === 0 ? `${o.name}: nothing points at it.` : `${o.name}: ${inc.length === 1 ? "one reference" : `${inc.length} references`} in, from ${from.join(" and ")}.`;
  if (o.garbage) line += inc.length ? ` but ${nameOf(inc[0].from)} is unreachable itself, so this is garbage too.` : " it is garbage.";
  else if (o.spawn) line += " just allocated.";
  else if (step >= 2) line += " marked live.";
  else if (o.fresh) line += " just allocated.";
  return line;
}

// hit testing: which frame or object sits on a cell
const ownerAt = new Map<string, string>();
for (const c of cells) if (c.ownerType !== "edge" && !c.spawn) ownerAt.set(`${c.x},${c.y}`, c.owner);
const spawnAt = new Map<string, string>();
for (const c of cells) if (c.ownerType === "obj" && c.spawn) spawnAt.set(`${c.x},${c.y}`, c.owner);
const tabOrder = [...frames.map((f) => f.id), ...objs.filter((o) => !o.spawn).sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.id)];
const tabOrderAfter = [...frames.map((f) => f.id), ...objs.filter((o) => !o.garbage).sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.id)];

// ---------------------------------------------------------------------------- the server frame

const waveDelay = (c: Cell): number => {
  if (c.ownerType === "frame") return 0;
  if (c.ownerType === "edge") {
    const comet = cometWave.get(c.owner);
    return comet ? 80 + comet.start + c.i * 13 : 860 + c.i * 10;
  }
  const m = planWave.marked.get(c.owner);
  if (m == null) return 820 + c.i * 14;
  return 80 + m + c.i * 16;
};

function StaticField() {
  const lit = cells.filter((c) => !c.spawn);
  return (
    <>
      <defs>
        <pattern id="jle-heap-grid" width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
          <circle cx={PITCH / 2} cy={PITCH / 2} r={GRID_R} className={s.gridDot} />
        </pattern>
        <filter id="jle-heap-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b" />
          <feComponentTransfer in="b" result="b2">
            <feFuncA type="linear" slope="0.85" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#jle-heap-grid)" />
      <g className={s.lit}>
        {lit.map((c) => {
          const cx = c.x * PITCH + PITCH / 2;
          const cy = c.y * PITCH + PITCH / 2;
          const r = radius(c).toFixed(2);
          const style = c.ownerType === "frame" ? undefined : ({ "--d": `${Math.round(waveDelay(c))}ms` } as React.CSSProperties);
          const color = `var(--${c.tone})`;
          return c.kind === "ring" ? (
            <circle key={`${c.x},${c.y},${c.owner}`} cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={RING_W} opacity={c.a.toFixed(2)} className={s.w} style={style} />
          ) : (
            <circle key={`${c.x},${c.y},${c.owner}`} cx={cx} cy={cy} r={r} fill={color} opacity={c.a.toFixed(2)} className={c.ownerType === "frame" ? undefined : s.w} style={style} />
          );
        })}
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------- the instrument

let mountedBefore = false;

function readPalette(el: HTMLElement): Pal {
  const probe = document.createElement("span");
  probe.style.display = "none";
  el.appendChild(probe);
  const read = (v: string, fb: string): RGB => {
    probe.style.color = fb;
    probe.style.color = `var(${v}, ${fb})`;
    const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ["0", "0", "0"];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const P: Pal = {
    dot: read("--dot", "currentColor"),
    meta: read("--meta", "purple"),
    ref: read("--ref", "blue"),
    live: read("--live", "green"),
    dead: read("--dead", "red"),
    hot: read("--hot", "orange"),
    grid: read("--grid", "gray"),
    book: read("--book", "crimson"),
  };
  probe.remove();
  return P;
}

const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export function HeapField() {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const [ro, setRo] = useState<Readout>(() => readout({ phase: "idle", t: 0 }, false, null));
  const [inspect, setInspect] = useState<string | null>(null);
  const [live, setLive] = useState("");

  // everything the frame loop touches lives in one ref, so a frame never waits on react
  const eng = useRef({
    clock: { phase: "idle", t: 0 } as Clock,
    from: null as Clock | null,
    focus: null as string | null,
    keyFocus: false,
    hl: 0, // highlight mix, 0 to 1
    canvasOn: false,
    visible: true,
    still: false,
    dark: false,
    P: null as Pal | null,
    raf: 0,
    last: 0,
    scale: 1,
    dpr: 1,
    grid: null as HTMLCanvasElement | null,
    lit: null as HTMLCanvasElement | null,
    bloom: null as HTMLCanvasElement | null, // the dark glow, blurred at half size: a quarter of the pixels
    roKey: "",
    filter: false,
  });

  const draw = useCallback(() => {
    const e = eng.current;
    const cv = canvas.current;
    if (!cv || !e.P || !e.grid || !e.lit || !cv.width || !e.lit.width) return;
    const ctx = cv.getContext("2d")!;
    const lc = e.lit.getContext("2d")!;
    const P = e.P;
    const k = e.scale * e.dpr;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, e.lit.width, e.lit.height);
    lc.setTransform(k, 0, 0, k, 0, 0);

    // highlight: the focused thing, the references into it, and where they come from
    const step = readout(e.clock, e.still, e.from).step;
    let keep: Set<string> | null = null;
    if (e.focus && e.hl > 0) {
      keep = new Set([e.focus]);
      for (const ed of edges)
        if (ed.to === e.focus && edgeVisible(edgeId(ed), step)) {
          keep.add(edgeId(ed));
          keep.add(ed.from);
        }
    }

    for (const c of cells) {
      const v = at(c, e.clock, P, e.still, e.from);
      if (v.fillA + v.strokeA < 0.005) continue;
      let fa = v.fillA;
      let sa = v.strokeA;
      let r = v.r;
      if (keep) {
        if (!keep.has(c.owner)) {
          fa *= 1 - 0.62 * e.hl;
          sa *= 1 - 0.62 * e.hl;
        } else if (c.ownerType === "edge") {
          fa = lerp(fa, 1, e.hl);
          if (!e.still) r *= 1 + 0.28 * e.hl;
        }
      }
      const cx = c.x * PITCH + PITCH / 2;
      const cy = c.y * PITCH + PITCH / 2 + v.dy;
      lc.beginPath();
      lc.arc(cx, cy, Math.max(r, 0.01), 0, Math.PI * 2);
      if (fa > 0.004) {
        lc.fillStyle = rgb(v.col, fa);
        lc.fill();
      }
      if (sa > 0.004) {
        lc.lineWidth = RING_W;
        lc.strokeStyle = rgb(v.col, sa);
        lc.stroke();
      }
    }

    // keyboard focus: a ring in the book colour around the object
    if (e.focus && e.keyFocus) {
      const o = objById.get(e.focus);
      const f = frameById.get(e.focus);
      const [x, y, w, h] = o ? [o.x, o.y, o.w, o.h] : f ? [1, f.y, 4, f.slots + 1] : [0, 0, 0, 0];
      lc.strokeStyle = rgb(P.book, 1);
      lc.lineWidth = 1.5;
      lc.beginPath();
      lc.roundRect(x * PITCH - 2, y * PITCH - 2, w * PITCH + 4, h * PITCH + 4, 5);
      lc.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(e.grid, 0, 0);
    if (e.dark && e.filter && e.bloom) {
      const b = e.bloom.getContext("2d")!;
      b.clearRect(0, 0, e.bloom.width, e.bloom.height);
      b.filter = `blur(${(1.2 * k).toFixed(2)}px)`;
      b.drawImage(e.lit, 0, 0, e.bloom.width, e.bloom.height);
      b.filter = "none";
      ctx.globalAlpha = 0.85;
      ctx.drawImage(e.bloom, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(e.lit, 0, 0);
  }, []);

  const size = useCallback(() => {
    const e = eng.current;
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box || !e.P) return;
    const cssW = box.clientWidth;
    if (cssW < 1) return;
    e.dpr = Math.min(window.devicePixelRatio || 1, 2);
    e.scale = cssW / W;
    const pw = Math.round(cssW * e.dpr);
    const ph = Math.round((cssW * H * e.dpr) / W);
    cv.width = pw;
    cv.height = ph;
    for (const key of ["grid", "lit"] as const) {
      if (!e[key]) e[key] = document.createElement("canvas");
      e[key]!.width = pw;
      e[key]!.height = ph;
    }
    if (!e.bloom) e.bloom = document.createElement("canvas");
    e.bloom.width = Math.max(1, Math.round(pw / 2));
    e.bloom.height = Math.max(1, Math.round(ph / 2));
    const g = e.grid!.getContext("2d")!;
    const k = e.scale * e.dpr;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = rgb(e.P.grid);
    g.beginPath();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        g.moveTo(x * PITCH + PITCH / 2 + GRID_R, y * PITCH + PITCH / 2);
        g.arc(x * PITCH + PITCH / 2, y * PITCH + PITCH / 2, GRID_R, 0, Math.PI * 2);
      }
    g.fill();
  }, []);

  const loopRef = useRef<(now: number) => void>(() => {});

  const kick = useCallback(() => {
    const e = eng.current;
    if (!e.raf && e.visible && !document.hidden) {
      e.last = performance.now();
      e.raf = requestAnimationFrame((n) => loopRef.current(n));
    }
  }, []);

  const phaseEnd = useCallback((p: Phase) => {
    const still = eng.current.still;
    return p === "mark" ? markEnd(still) : p === "sweep" ? SWEEP_END : p === "alloc" ? ALLOC_END : p === "reset" ? RESET_DUR : 0;
  }, []);

  useEffect(() => {
    loopRef.current = (now: number) => {
      const e = eng.current;
      e.raf = 0;
      const dt = Math.min(now - e.last, 50); // a hidden tab or a long frame never skips the story
      e.last = now;
      const end = phaseEnd(e.clock.phase);
      const running = e.clock.t < end;
      if (running) e.clock = { ...e.clock, t: Math.min(e.clock.t + dt, end) };
      const target = e.focus ? 1 : 0;
      const hlMoving = e.hl !== target;
      if (hlMoving) e.hl = target > e.hl ? Math.min(1, e.hl + dt / 160) : Math.max(0, e.hl - dt / 160);
      if (e.clock.phase === "reset" && e.clock.t >= RESET_DUR) {
        e.clock = { phase: "idle", t: 0 };
        e.from = null;
      }
      draw();
      const r = readout(e.clock, e.still, e.from);
      const key = JSON.stringify(r);
      if (key !== e.roKey) {
        e.roKey = key;
        setRo(r);
      }
      if ((running || hlMoving) && e.visible && !document.hidden) e.raf = requestAnimationFrame((n) => loopRef.current(n));
    };
  }, [draw, phaseEnd]);

  /** hand the picture from the server svg to the canvas */
  const takeOver = useCallback(() => {
    const e = eng.current;
    if (e.canvasOn || !wrap.current || !canvas.current) return;
    svg.current?.getAnimations({ subtree: true }).forEach((a) => a.finish());
    e.P = readPalette(wrap.current);
    e.dark = document.documentElement.dataset.theme === "dark";
    e.filter = "filter" in CanvasRenderingContext2D.prototype;
    size();
    draw();
    e.canvasOn = true;
    canvas.current.dataset.on = "";
    if (svg.current) svg.current.dataset.off = "";
  }, [draw, size]);

  // a remount (client navigation back home) skips the load wave: it plays once
  useLayoutEffect(() => {
    if (mountedBefore) svg.current?.getAnimations({ subtree: true }).forEach((a) => a.finish());
    mountedBefore = true;
  }, []);

  useEffect(() => {
    const e = eng.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    e.still = mq.matches;
    const onMq = () => (e.still = mq.matches);
    mq.addEventListener("change", onMq);

    // take over once the load wave is done, so hover works without a hitch
    let alive = true;
    const anims = svg.current?.getAnimations({ subtree: true }) ?? [];
    Promise.all(anims.map((a) => a.finished))
      .catch(() => {})
      .then(() => alive && takeOver());

    const io = new IntersectionObserver(([en]) => {
      e.visible = en.isIntersecting;
      if (e.visible) kick();
      else if (e.raf) {
        cancelAnimationFrame(e.raf);
        e.raf = 0;
      }
    });
    if (wrap.current) io.observe(wrap.current);

    const onVis = () => !document.hidden && kick();
    document.addEventListener("visibilitychange", onVis);

    const rs = new ResizeObserver(() => {
      if (!e.canvasOn) return;
      size();
      draw();
    });
    if (wrap.current) rs.observe(wrap.current);

    const mo = new MutationObserver(() => {
      if (!e.canvasOn || !wrap.current) return;
      // wait a frame so the new theme's tokens are in place
      requestAnimationFrame(() => {
        if (!wrap.current) return;
        e.P = readPalette(wrap.current);
        e.dark = document.documentElement.dataset.theme === "dark";
        size();
        draw();
      });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    return () => {
      alive = false;
      mq.removeEventListener("change", onMq);
      io.disconnect();
      rs.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(e.raf);
      e.raf = 0;
    };
  }, [draw, kick, size, takeOver]);

  // ------------------------------------------------------------------ controls

  const go = useCallback(
    (next: Phase) => {
      takeOver();
      const e = eng.current;
      const cur = e.clock;
      const end = phaseEnd(cur.phase);
      if (next === cur.phase && cur.t < end) {
        // pressing the running step finishes it
        e.clock = { phase: cur.phase, t: end };
      } else if (next === "reset") {
        e.from = cur.phase === "reset" ? e.from : { phase: cur.phase, t: Math.min(cur.t, end) };
        e.clock = { phase: "reset", t: 0 };
      } else {
        e.from = null;
        e.clock = { phase: next, t: 0 };
      }
      const r = readout(e.clock, e.still, e.from);
      setLive(next === "reset" ? SAY.idle : r.say);
      kick();
    },
    [kick, phaseEnd, takeOver],
  );

  const setFocus = useCallback(
    (id: string | null, byKey: boolean) => {
      const e = eng.current;
      if (id === e.focus && byKey === e.keyFocus) return;
      if (id) takeOver();
      e.focus = id;
      e.keyFocus = byKey && !!id;
      setInspect(id);
      if (!e.canvasOn) return;
      draw();
      kick();
    },
    [draw, kick, takeOver],
  );

  const hit = (ev: React.PointerEvent) => {
    const box = wrap.current!.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - box.left) / box.width) * COLS);
    const y = Math.floor(((ev.clientY - box.top) / box.height) * ROWS);
    const step = ro.step;
    const k = `${x},${y}`;
    const sp = spawnAt.get(k);
    if (sp && objVisible(sp, step)) return sp;
    const id = ownerAt.get(k);
    return id && objVisible(id, step) ? id : null;
  };

  const onKey = (ev: React.KeyboardEvent) => {
    const order = ro.step >= 4 ? tabOrderAfter : tabOrder;
    const i = inspect ? order.indexOf(inspect) : -1;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
      setFocus(order[(i + 1) % order.length], true);
    } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
      setFocus(order[(i - 1 + order.length) % order.length], true);
    } else if (ev.key === "Escape") {
      setFocus(null, false);
    } else return;
    ev.preventDefault();
  };

  // announce keyboard inspection; hover only changes the visible caption
  useEffect(() => {
    if (inspect && eng.current.keyFocus) setLive(describe(inspect, ro.step));
  }, [inspect, ro.step]);

  const step = ro.step;
  const steps: { label: string; phase: Phase; next: boolean; running: boolean; done: boolean; on: boolean }[] = [
    { label: "mark", phase: "mark", next: step === 0, running: step === 1, done: step >= 2, on: step <= 1 },
    { label: "sweep", phase: "sweep", next: step === 2, running: step === 3, done: step >= 4, on: step >= 1 && step <= 3 },
    { label: "allocate", phase: "alloc", next: step === 4, running: step === 5, done: step >= 6, on: step >= 3 && step <= 5 },
    { label: "reset", phase: "reset", next: step === 6, running: false, done: false, on: step > 0 },
  ];

  const caption = inspect && objVisible(inspect, step) ? describe(inspect, step) : ro.say;

  return (
    <div className={s.instrument}>
      <div className={s.fieldwrap}>
        <div className={s.glow} aria-hidden>
          <div className={s.bloom}>
            <span className={s.ga} />
            <span className={s.gb} />
            <span className={s.gc} />
            <span className={s.gd} />
          </div>
        </div>
        <div
          ref={wrap}
          className={s.field}
          tabIndex={0}
          role="group"
          aria-roledescription="heap"
          aria-label="a heap drawn as dots. three stack frames on the left hold references, drawn as blue dot paths, into objects. each object starts with a purple header column. three objects are red rings: nothing reachable points at them. use the arrow keys to inspect objects."
          onKeyDown={onKey}
          onBlur={() => eng.current.keyFocus && setFocus(null, false)}
          onPointerMove={(ev) => ev.pointerType === "mouse" && setFocus(hit(ev), false)}
          onPointerLeave={(ev) => ev.pointerType === "mouse" && setFocus(null, false)}
          onPointerDown={(ev) => ev.pointerType !== "mouse" && setFocus(hit(ev), false)}
        >
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={s.svg} aria-hidden>
            <StaticField />
          </svg>
          <canvas ref={canvas} className={s.canvas} aria-hidden />
        </div>
      </div>

      <div className={s.readout}>
        {ro.counts.map((c, i) => (
          <span key={i} className={s.count}>
            <b className={s.num} style={{ color: c.tone === "hi" ? "var(--hi)" : `var(--${c.tone})` }}>
              {c.v}
            </b>
            <span>{c.word}</span>
          </span>
        ))}
      </div>

      <div className={s.steps} role="group" aria-label="run one garbage collection">
        {steps.map((st, i) => (
          <span key={st.label} className={s.stepWrap}>
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={s.chev}>
                <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            )}
            <button
              type="button"
              className={s.step}
              data-next={st.next ? "" : undefined}
              data-running={st.running ? "" : undefined}
              data-done={st.done ? "" : undefined}
              disabled={!st.on}
              aria-label={st.running ? `${st.label}, running. press to finish` : undefined}
              onClick={() => go(st.phase)}
            >
              <i className={s.lamp} aria-hidden />
              {st.label}
            </button>
          </span>
        ))}
      </div>

      <p className={s.caption}>{caption}</p>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <div className={s.legend} aria-hidden>
        <span><i style={{ background: "var(--ref)" }} />ref</span>
        <span><i style={{ background: "var(--live)" }} />live, marked</span>
        <span><i className={s.ring} />dead, unreachable</span>
        <span><i style={{ background: "var(--meta)" }} />meta, header</span>
        <span><i style={{ background: "var(--hot)" }} />hot, new</span>
      </div>
    </div>
  );
}
