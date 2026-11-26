import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { markShapes, shapesSvg } from "@/lib/marks";

// share images: always paper, so they read in any feed. the title in eroded redaction 20 on flat
// paper at the left; at the right, a fragment of the chapter's own instrument drawn as dots, with
// the book's mesh glow rising from the bottom right corner behind it. departure mono footer.
//
// satori can't read css variables, so the paper tokens from globals.css are copied here as hex.

export const ogSize = { width: 1200, height: 630 };

/* ------------------------------------------------------------------ the book */

const BOOK = {
  kind: "java" as const,
  prefix: "java.lang.",
  domain: "java.harshpreet.com",
  // dawn: rose, apricot, butter, mauve
  glow: ["#f3a2c0", "#f8c79d", "#f2e3a6", "#ecc6e0"],
  book: "#b0305f",
};

/* ------------------------------------------------------------------ paper tokens */

const C = {
  bg: "#f7f6f2",
  well: "#fdfcfa",
  hi: "#141311",
  ink: "#26241f",
  mute: "#5c5850",
  faint: "#6b665d",
  line2: "#d3cfc6",
  grid: "#d6d2c8",
  dot: "#3b3832",
  ref: "#2a5fa6",
  live: "#2b7448",
  dead: "#b0362f",
  meta: "#6a45ad",
  hot: "#94580a",
};

const font = (f: string) => readFile(join(process.cwd(), "src/assets/fonts", f));
const fonts = Promise.all([
  font("redaction20-400.ttf"),
  font("redaction-400.ttf"),
  font("piazzolla-italic-400.ttf"),
  font("departure-mono-400.otf"),
  font("geistmono-400.ttf"),
]);

/* ------------------------------------------------------------------ the dot field */

type Tone = "dot" | "ref" | "live" | "dead" | "meta" | "hot";
type Kind = "fill" | "ring" | "small" | "end";
type Cell = { t: Tone; k: Kind };

const COLS = 28;
const ROWS = 24;
const PITCH = 15;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

class Field {
  cells = new Map<string, Cell>();
  R: () => number;
  constructor(seed: number) {
    this.R = rng(seed);
  }
  /** integer in [a, b] */
  int(a: number, b: number) {
    return a + Math.floor(this.R() * (b - a + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.R() * xs.length)];
  }
  set(x: number, y: number, t: Tone, k: Kind = "fill") {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    this.cells.set(`${x},${y}`, { t, k });
  }
  has(x: number, y: number) {
    return this.cells.has(`${x},${y}`);
  }
  /** an object: a meta header column on the left, the body to its right */
  block(x: number, y: number, w: number, h: number, body: Tone = "dot", o: { header?: "col" | "row" | false; k?: Kind } = {}) {
    const header = o.header ?? "col";
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const isHead = (header === "col" && i === 0) || (header === "row" && j === 0);
        this.set(x + i, y + j, isHead ? "meta" : body, o.k === "ring" ? "ring" : "fill");
      }
  }
  /** a reference: a run of small dots ending in a bigger one, orthogonal segments only */
  path(pts: [number, number][], t: Tone = "ref") {
    const out: [number, number][] = [];
    for (let p = 0; p < pts.length - 1; p++) {
      let [x0, y0] = pts[p];
      const [x1, y1] = pts[p + 1];
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      for (;;) {
        out.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        x0 += dx;
        y0 += dy;
      }
    }
    const seen = new Set<string>();
    const uniq = out.filter(([x, y]) => (seen.has(`${x},${y}`) ? false : (seen.add(`${x},${y}`), true)));
    uniq.forEach(([x, y], i) => this.set(x, y, t, i === uniq.length - 1 ? "end" : "small"));
  }
  /** is the rectangle (with a one dot margin) still empty */
  free(x: number, y: number, w: number, h: number) {
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (this.has(x + i, y + j)) return false;
    return true;
  }
  /** find a free spot for a w by h block inside [x0, x1] by [y0, y1] */
  place(w: number, h: number, x0: number, x1: number, y0: number, y1: number): [number, number] | null {
    for (let n = 0; n < 60; n++) {
      const x = this.int(x0, Math.max(x0, x1 - w));
      const y = this.int(y0, Math.max(y0, y1 - h));
      if (this.free(x, y, w, h)) return [x, y];
    }
    return null;
  }
  /** move the drawing so its bounding box sits in the middle of the field */
  centre() {
    const xs = [...this.cells.keys()].map((k) => k.split(",").map(Number));
    if (!xs.length) return;
    const minX = Math.min(...xs.map((c) => c[0]));
    const maxX = Math.max(...xs.map((c) => c[0]));
    const minY = Math.min(...xs.map((c) => c[1]));
    const maxY = Math.max(...xs.map((c) => c[1]));
    const dx = Math.floor((COLS - (maxX - minX + 1)) / 2) - minX;
    const dy = Math.floor((ROWS - (maxY - minY + 1)) / 2) - minY;
    const moved = new Map<string, Cell>();
    for (const [k, c] of this.cells) {
      const [x, y] = k.split(",").map(Number);
      moved.set(`${x + dx},${y + dy}`, c);
    }
    this.cells = moved;
  }
  svg(ox: number, oy: number) {
    const R = rng(7);
    const p = PITCH;
    let grid = "";
    let lit = "";
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const cx = ox + x * p + p / 2;
        const cy = oy + y * p + p / 2;
        const c = this.cells.get(`${x},${y}`);
        if (!c) {
          grid += `<circle cx="${cx}" cy="${cy}" r="${(p * 0.09).toFixed(2)}"/>`;
          continue;
        }
        // seeded per-dot brightness, so a block reads as a lit panel and not a flat fill
        const o = (0.8 + R() * 0.2).toFixed(2);
        const r = c.k === "small" ? p * 0.17 : c.k === "end" ? p * 0.27 : c.t === "hot" ? p * 0.31 : p * 0.28;
        const fill = C[c.t];
        lit +=
          c.k === "ring"
            ? `<circle cx="${cx}" cy="${cy}" r="${(r - p * 0.03).toFixed(2)}" fill="none" stroke="${fill}" stroke-width="${(p * 0.09).toFixed(2)}" opacity="${o}"/>`
            : `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${fill}" opacity="${o}"/>`;
      }
    return `<g fill="${C.grid}">${grid}</g>${lit}`;
  }
}

/* ------------------------------------------------------------------ motifs: one per kind of instrument */

export type Motif = "heap" | "trays" | "tree" | "lanes" | "buckets" | "sweep" | "page" | "bits" | "rows" | "join" | "ghosts" | "tape";

/** stack frames on the left, objects on the heap, references between them, garbage as rings */
function heap(F: Field, big = false) {
  const frames = F.int(2, 3);
  let y = F.int(1, 3);
  const refs: [number, number][] = [];
  for (let f = 0; f < frames && y < ROWS - 4; f++) {
    const h = F.int(2, 4);
    F.block(1, y, 5, h + 1, "dot", { header: "row" });
    for (let j = 1; j <= h; j++) if (F.R() < 0.6 || j === 1) refs.push([6, y + j]);
    y += h + 3;
  }
  const objs: [number, number, number, number][] = [];
  const n = big ? 5 : F.int(3, 4);
  const band = Math.floor((ROWS - 2) / n);
  for (let i = 0; i < n; i++) {
    const w = F.int(4, big ? 7 : 8);
    const h = Math.min(band - 2, F.int(2, 4));
    const at = F.place(w, h, 11, COLS - 3, 1 + i * band, 1 + (i + 1) * band);
    if (at) objs.push([at[0], at[1], w, h]);
  }
  // references first, so an object sits on top of any path that passes under it
  refs.slice(0, objs.length).forEach(([x, y], i) => {
    const [ox, oy, , oh] = objs[i];
    const ty = oy + Math.min(oh - 1, 1);
    const mid = Math.max(x + 1, ox - 2);
    F.path([[x, y], [mid, y], [mid, ty], [ox - 1, ty]]);
  });
  // one object holding a reference to another, down the right-hand side
  if (objs.length > 2 && F.R() < 0.75) {
    const [ax, ay, aw] = objs[0];
    const [bx, by, bw] = objs[objs.length - 1];
    const edge = Math.min(COLS - 1, Math.max(ax + aw, bx + bw) + 1);
    F.path([[ax + aw, ay + 1], [edge, ay + 1], [edge, by + 1], [bx + bw, by + 1]]);
  }
  objs.forEach(([x, y, w, h], i) => F.block(x, y, w, h, i === objs.length - 1 && F.R() < 0.5 ? "hot" : "dot"));
  // unreachable: nothing points here. fill drains, outline stays
  for (let g = 0; g < (big ? 2 : F.int(1, 2)); g++) {
    const w = F.int(3, 5);
    const h = F.int(2, 3);
    const at = F.place(w, h, 8, COLS, 1, ROWS);
    if (at) F.block(at[0], at[1], w, h, "dead", { k: "ring" });
  }
}

/** a pipeline: trays handed down the line, shrinking or reshaped at each station */
function trays(F: Field) {
  const n = F.int(3, 5);
  const gap = 2;
  const w = Math.floor((COLS - 2 - gap * (n - 1)) / n);
  let h = F.int(7, 10);
  const top = F.int(2, 5);
  const ringAt = F.int(1, n - 2);
  for (let i = 0; i < n; i++) {
    const x = 1 + i * (w + gap);
    const body: Tone = i === n - 1 ? "live" : "dot";
    F.block(x, top, w, 1, "meta", { header: false });
    for (let j = 1; j <= h; j++)
      for (let k = 0; k < w; k++) {
        const dropped = i === ringAt && j % 2 === 0;
        F.set(x + k, top + j, dropped ? "dead" : body, dropped ? "ring" : "fill");
      }
    if (i < n - 1) F.path([[x + w, top + 1 + Math.floor(h / 2)], [x + w + gap - 1, top + 1 + Math.floor(h / 2)]]);
    if (i === ringAt) h = Math.max(2, Math.ceil(h / 2));
    else h = Math.max(2, h - F.int(0, 2));
  }
  // one value under the lens
  F.set(1 + (n - 1) * (w + gap) + F.int(0, w - 1), top + 1, "hot");
  // a second, smaller line below: the same rows, sorted or limited
  const y2 = top + 13;
  if (y2 + 3 < ROWS) {
    let x = 1;
    for (let i = 0; i < n && x < COLS - 3; i++) {
      const ww = Math.max(2, w - i);
      F.block(x, y2, ww, 3, i === n - 1 ? "live" : i === ringAt ? "hot" : "dot", { header: false });
      x += ww + 2;
    }
  }
}

/** a tree: root, internal nodes, leaves; one lookup path lit hot down to a live leaf */
function tree(F: Field, btree = false) {
  const kids = F.int(2, 3);
  const rootW = btree ? 7 : 5;
  const rootX = Math.floor((COLS - rootW) / 2);
  F.block(rootX, 1, rootW, 2, "dot", { header: btree ? "row" : "col" });
  const slot = Math.floor((COLS - 2) / kids);
  const hotKid = F.int(0, kids - 1);
  const leafRow = 15;
  for (let i = 0; i < kids; i++) {
    const w = btree ? 6 : 5;
    const x = 1 + i * slot + Math.floor((slot - w) / 2);
    const fromX = rootX + Math.round(((i + 0.5) / kids) * (rootW - 1));
    F.path([[fromX, 3], [fromX, 5], [x + 2, 5], [x + 2, 7]], i === hotKid ? "hot" : "ref");
    F.block(x, 8, w, 2, i === hotKid ? "hot" : "dot", { header: btree ? "row" : "col" });
    // leaves
    const leaves = F.int(1, 2);
    const lw = Math.floor((slot - 1) / leaves) - 1;
    for (let l = 0; l < leaves; l++) {
      const lx = 1 + i * slot + l * (lw + 1);
      const lit = i === hotKid && l === leaves - 1;
      F.path([[x + 1 + l * 2, 10], [x + 1 + l * 2, 12], [lx + 1, 12], [lx + 1, leafRow - 1]], lit ? "hot" : "ref");
      const dead = !lit && F.R() < 0.25;
      F.block(lx, leafRow, Math.max(2, lw), F.int(3, 5), lit ? "live" : dead ? "dead" : "dot", { header: btree ? "row" : "col", k: dead ? "ring" : "fill" });
    }
  }
  if (btree) for (let x = 1; x < COLS - 1; x++) if (!F.has(x, leafRow + 6)) F.set(x, leafRow + 6, "ref", x === COLS - 2 ? "end" : "small");
}

/** lanes: threads or transactions, left to right in time, with sync points and contention */
function lanes(F: Field, tape = false) {
  const n = tape ? 5 : F.int(3, 4);
  const pitch = Math.floor((ROWS - 2) / n);
  const hotLane = F.int(0, n - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 + i * pitch + 1;
    F.set(0, y, "meta");
    F.set(0, y + 1, "meta");
    let x = 2;
    while (x < COLS - 1) {
      const run = F.int(2, 6);
      const tone: Tone = i === hotLane && x > COLS / 2 && x < COLS / 2 + 6 ? "hot" : "dot";
      for (let k = 0; k < run && x + k < COLS - 1; k++) {
        F.set(x + k, y, tone);
        if (!tape || F.R() < 0.5) F.set(x + k, y + 1, tone);
      }
      x += run + F.int(1, 3);
    }
    if (tape) F.set(COLS - 2, y, "hot");
  }
  // sync points: a reference from one lane down to the next
  const syncs = F.int(1, 3);
  for (let s = 0; s < syncs; s++) {
    const a = F.int(0, n - 2);
    const x = F.int(6, COLS - 4);
    F.path([[x, 1 + a * pitch + 3], [x, 1 + (a + 1) * pitch]]);
  }
  // an aborted run: rings
  const a = F.int(0, n - 1);
  const x = F.int(4, COLS - 8);
  for (let k = 0; k < 4; k++) {
    F.set(x + k, 1 + a * pitch + 1, "dead", "ring");
    F.set(x + k, 1 + a * pitch + 2, "dead", "ring");
  }
}

/** a bucket array with chains hanging off it: each entry a small object, the collisions a longer chain */
function buckets(F: Field) {
  const n = F.int(6, 7);
  const collide = F.int(0, n - 1);
  const hotAt = F.int(0, n - 1);
  F.block(0, 0, 3, n * 3, "dot", { header: "row" });
  for (let i = 0; i < n; i++) {
    const y = 1 + i * 3;
    const len = i === collide ? 3 : F.R() < 0.6 ? F.int(1, 2) : 0;
    let cur = 3;
    for (let e = 0; e < len && cur + 6 <= COLS; e++) {
      const w = F.int(3, 4);
      F.path([[cur, y], [cur + 1, y]]);
      F.block(cur + 2, y, w, 2, i === hotAt && e === len - 1 ? "hot" : "dot");
      cur += w + 3;
    }
    if (!len) F.set(3, y, "dead", "ring");
  }
}

/** a heap after marking: live objects, unreachable rings, young and old split by a meta rule */
function sweep(F: Field) {
  const split = F.int(9, 13);
  for (let y = 0; y < ROWS; y += 2) F.set(split, y, "meta", "small");
  for (let n = 0; n < 40; n++) {
    const w = F.int(2, 4);
    const h = F.int(1, 3);
    const at = F.place(w, h, 0, COLS, 0, ROWS);
    if (!at) continue;
    const old = at[0] > split;
    const r = F.R();
    const dead = r < (old ? 0.22 : 0.55);
    F.block(at[0], at[1], w, h, dead ? "dead" : r > 0.94 ? "hot" : "live", { header: false, k: dead ? "ring" : "fill" });
  }
}

/** a slotted page: header, line pointers growing down, tuples growing up, free space between */
function page(F: Field, ghosts = false) {
  const W = 22;
  const H = 16;
  F.block(0, 0, W, 2, "meta", { header: false });
  // tuples fill from the end of the page backwards, two dots tall, in rows
  const tuples: [number, number, number][] = [];
  let x = W;
  let y = H - 2;
  const n = F.int(8, 10);
  for (let i = 0; i < n; i++) {
    const w = F.int(3, 5);
    if (x - w < 0) {
      x = W;
      y -= 3;
    }
    x -= w;
    tuples.push([x, y, w]);
    const dead = ghosts ? F.R() < 0.4 : F.R() < 0.12;
    F.block(x, y, w, 2, dead ? "dead" : ghosts && F.R() < 0.35 ? "live" : "dot", { k: dead ? "ring" : "fill" });
    x -= 1;
  }
  // the line pointer array, one per tuple, growing down from the header
  tuples.forEach((_, i) => F.set(i * 2, 3, "ref"));
  // two of them followed to their tuple; the one being read is hot
  for (const [i, tone] of [[0, "hot"], [F.int(2, Math.min(4, n - 1)), "ref"]] as const) {
    const [tx, ty] = tuples[i];
    const lane = 5 + (i === 0 ? 0 : 2);
    F.path([[i * 2, 4], [i * 2, lane], [tx + 1, lane], [tx + 1, ty - 1]], tone);
  }
  // free space: nothing, on purpose
}

/** values as bits: a frame of slots, each slot a 16 bit register. ones lit, zeros dim, sign bit hot */
function bits(F: Field, key: string) {
  const rows = F.int(4, 6);
  F.block(0, 0, 4, rows * 2 + 1, "dot", { header: "row" });
  for (let r = 0; r < rows; r++) {
    const y = 1 + r * 2;
    const v = hash(key + r) & 0xffff;
    F.path([[4, y], [6, y]]);
    for (let b = 0; b < 16; b++) {
      const on = (v >> (15 - b)) & 1;
      const x = 8 + b + (b >= 8 ? 1 : 0);
      F.set(x, y, b === 0 && on ? "hot" : "dot", on ? "fill" : "small");
    }
  }
}

/** a table: header row, rows, the ones the query kept lit, the ones it threw out as rings */
function rows(F: Field, writes = false) {
  const w = F.int(9, 13);
  const h = F.int(9, 13);
  const top = F.int(1, 3);
  F.block(1, top, w, 1, "meta", { header: false });
  const kept = new Set<number>();
  for (let j = 1; j <= h; j++) {
    const r = F.R();
    const tone: Tone = r < 0.3 ? "live" : r < 0.5 ? "dead" : "dot";
    if (tone === "live") kept.add(j);
    for (let i = 0; i < w; i++) F.set(1 + i, top + j, tone, tone === "dead" ? "ring" : "fill");
  }
  if (writes) for (let i = 0; i < w; i++) F.set(1 + i, top + h + 1, "hot");
  // the result set: only the kept rows, fewer columns
  const rw = F.int(3, 6);
  const rx = w + 6;
  const ry = top + 2;
  F.path([[w + 1, top + 2 + 1], [rx - 1, top + 2 + 1]]);
  F.block(rx, ry, Math.min(rw, COLS - rx - 1), 1, "meta", { header: false });
  let j = 1;
  for (let n = 0; n < kept.size && ry + j < ROWS - 1; n++, j++)
    for (let i = 0; i < Math.min(rw, COLS - rx - 1); i++) F.set(rx + i, ry + j, "live");
  if (!kept.size) F.set(rx, ry + 1, "dead", "ring");
}

/** two tables and the rows that match across them */
function tables(F: Field) {
  const lw = F.int(5, 7);
  const rw = F.int(5, 8);
  const lh = F.int(7, 11);
  const rh = F.int(7, 11);
  const rx = COLS - 1 - rw;
  F.block(1, 2, lw, 1, "meta", { header: false });
  F.block(rx, 2, rw, 1, "meta", { header: false });
  const used = new Set<number>();
  for (let j = 1; j <= lh; j++) {
    const match = F.R() < 0.5;
    for (let i = 0; i < lw; i++) F.set(1 + i, 2 + j * 2 - 1, match ? "live" : "dead", match ? "fill" : "ring");
    if (match) {
      let t = F.int(1, rh);
      for (let n = 0; n < rh && used.has(t); n++) t = (t % rh) + 1;
      used.add(t);
      const ty = 2 + t * 2 - 1;
      const mid = lw + 2 + ((j * 3) % Math.max(1, rx - lw - 4));
      if (ty < ROWS && 2 + j * 2 - 1 < ROWS) F.path([[lw + 1, 2 + j * 2 - 1], [mid, 2 + j * 2 - 1], [mid, ty], [rx - 1, ty]]);
    }
  }
  for (let j = 1; j <= rh; j++) for (let i = 0; i < rw; i++) F.set(rx + i, 2 + j * 2 - 1, used.has(j) ? "live" : "dot");
}

function draw(motif: Motif, key: string, big = false) {
  const F = new Field(hash(key));
  if (motif === "heap") heap(F, big);
  else if (motif === "trays") trays(F);
  else if (motif === "tree") tree(F, false);
  else if (motif === "lanes") lanes(F);
  else if (motif === "tape") lanes(F, true);
  else if (motif === "buckets") buckets(F);
  else if (motif === "sweep") sweep(F);
  else if (motif === "page") page(F);
  else if (motif === "ghosts") page(F, true);
  else if (motif === "bits") bits(F, key);
  else if (motif === "rows") rows(F, /write|insert|update|delete|upsert|merge|returning/.test(key));
  else if (motif === "join") tables(F);
  F.centre();
  return F;
}

/** which instrument a part's chapters draw a fragment of, keyed by the part's glyph */
const MOTIF: Record<string, Motif | Motif[]> = {
  // java
  cup: "trays",
  bits: "bits",
  objects: "heap",
  toolbox: "heap",
  brackets: "tree",
  buckets: "buckets",
  stream: "trays",
  spark: "tree",
  threads: "lanes",
  pipes: "trays",
  mirror: "heap",
  wrench: "trays",
  bytecode: "page",
  sweep: "sweep",
  gauge: "lanes",
  book: "heap",
  horizon: "lanes",
  // sql
  cylinder: "rows",
  grid: "rows",
  laces: "join",
  frame: "rows",
  caret: "rows",
  shapes: "bits",
  schema: "join",
  tabs: "tree",
  plan: "trays",
  scales: "tree",
  lanes: "lanes",
  page: "page",
  tree: "tree",
  ghosts: "ghosts",
  padlock: "lanes",
  tape: "tape",
  shards: "buckets",
  // both: the deep dives borrow a different instrument per chapter
  magnifier: ["heap", "tree", "lanes", "page", "trays", "sweep"],
};

/** a chapter about a thing gets that thing's instrument, whatever part it sits in */
const WORDS: [RegExp, Motif][] = [
  [/garbage|\bgc\b|zgc|shenandoah|g1|leak/i, "sweep"],
  [/vacuum|mvcc|dead tuple|bloat|visibility|hot update|xmin|freez/i, "ghosts"],
  [/\bwal\b|write-ahead|checkpoint|recovery|replication|crash/i, "tape"],
  [/thread|virtual|concurren|lock|synchron|volatile|atomic|executor|deadlock|isolation|race/i, "lanes"],
  [/b-tree|btree|index|tree|hierarch|inherit|sealed|polymorph/i, "tree"],
  [/hash|bucket|partition|shard/i, "buckets"],
  [/\bjoins?\b|foreign key|normal/i, "join"],
  [/\bpage|tuple|toast|heap file|buffer|class file|bytecode/i, "page"],
  [/stream|pipeline|lambda|collector|order a query|plan|explain|pipe/i, "trays"],
  [/stack and heap|heap|memory|reference|\bnull|object|string|record|identity|equals/i, "heap"],
  [/\bbits?\b|byte|binary|primitive|integer|overflow|float|numeric/i, "bits"],
];

export function motifFor(glyph: string, key: string, words = ""): Motif {
  for (const [re, m] of WORDS) if (re.test(words)) return m;
  const m = MOTIF[glyph] ?? "heap";
  return Array.isArray(m) ? m[hash(key) % m.length] : m;
}

/* ------------------------------------------------------------------ the card */

const W = ogSize.width;
const H = ogSize.height;
const ART_X = W - 64 - COLS * PITCH;
const ART_Y = 132;

/** glow + dot field as one svg, the whole card behind the type */
function backdrop(F: Field, field = true) {
  const [a, b, c, d] = BOOK.glow;
  // the preview's glow box: left 660, top 150, 680 by 700, blurred 70px
  const gx = 660;
  const gy = 150;
  const gw = 680;
  const gh = 700;
  const e = (fill: string, l: number, t: number, w: number, h: number) =>
    `<ellipse cx="${gx + gw * (l + w / 2)}" cy="${gy + gh * (t + h / 2)}" rx="${(gw * w) / 2}" ry="${(gh * h) / 2}" fill="${fill}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter></defs>` +
    `<g filter="url(#g)" opacity=".9">${e(a, 0.08, 0.06, 0.58, 0.7)}${e(b, 0.44, 0.3, 0.52, 0.64)}${e(c, 0.2, 0.58, 0.46, 0.4)}${e(d, 0.62, 0, 0.34, 0.4)}</g>` +
    (field ? F.svg(ART_X, ART_Y) : "") +
    `</svg>`
  );
}

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

function titleSize(t: string) {
  const n = t.length;
  return n <= 16 ? 88 : n <= 26 ? 80 : n <= 34 ? 70 : 62;
}

/** a part's cover, from covers/spec.ts: the printed board, its pattern, its label */
export type OgCover = {
  pattern: string;
  ground: string;
  ink: string;
  deep: boolean;
  n: string;
  count: string;
  title: string;
};

const CV = { x: 812, y: 96, w: 316, h: 420 };

/**
 * the cover's pattern as svg. satori's tiled css gradients don't survive, so each pattern of
 * covers/patterns.ts is redrawn here with svg patterns at the same proportions (u = the pitch).
 */
function patternSvg(name: string, ink: string, u: number) {
  const L = (m: number) => +(u * m).toFixed(2);
  const pat = (id: string, w: number, h: number, body: string, extra = "") =>
    `<pattern id="${id}" width="${L(w)}" height="${L(h)}" patternUnits="userSpaceOnUse" ${extra}>${body}</pattern>`;
  const dot = (x: number, y: number, r: number) => `<circle cx="${L(x)}" cy="${L(y)}" r="${L(r)}" fill="${ink}"/>`;
  const fill = (id: string, op = 1) => `<rect width="100%" height="100%" fill="url(#${id})" opacity="${op}"/>`;
  const dots = (id: string, pitch: number, r: number) => pat(id, pitch, pitch, dot(pitch / 2, pitch / 2, r));
  switch (name) {
    case "dots":
      return { defs: dots("p", 1, 0.29), body: fill("p") };
    case "polka":
      return { defs: pat("p", 1, 1, dot(0.5, 0.5, 0.25) + [0, 1].flatMap((x) => [0, 1].map((y) => dot(x, y, 0.1))).join("")), body: fill("p") };
    case "fine":
      return { defs: dots("p", 0.42, 0.075), body: fill("p") };
    case "half":
      return { defs: pat("p", 1, 0.64, dot(0.5, 0.64, 0.43)), body: fill("p") };
    case "rings":
      return {
        defs: pat(
          "p",
          1.24,
          1.24,
          dot(0.62, 0.62, 0.1) +
            `<circle cx="${L(0.62)}" cy="${L(0.62)}" r="${L(0.245)}" fill="none" stroke="${ink}" stroke-width="${L(0.07)}"/>` +
            `<circle cx="${L(0.62)}" cy="${L(0.62)}" r="${L(0.41)}" fill="none" stroke="${ink}" stroke-width="${L(0.06)}"/>`,
        ),
        body: fill("p"),
      };
    case "sdots": {
      const w = Math.max(0.7, u * 0.07);
      return {
        defs:
          `<pattern id="st" width="${w * 2.5}" height="10" patternUnits="userSpaceOnUse"><rect width="${w}" height="10" fill="${ink}"/></pattern>` +
          pat("p", 1.1, 1.1, `<circle cx="${L(0.55)}" cy="${L(0.55)}" r="${L(0.42)}" fill="url(#st)"/>`),
        body: fill("p"),
      };
    }
    case "ddots": {
      const w = Math.max(0.7, u * 0.065);
      const c = (x: number, y: number) => `<circle cx="${L(x)}" cy="${L(y)}" r="${L(0.34)}" fill="url(#st)"/>`;
      return {
        defs:
          `<pattern id="st" width="${w * 2.7}" height="${w * 2.7}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${w}" height="${w * 2.7}" fill="${ink}"/></pattern>` +
          pat("p", 1, 1, c(0.5, 0.5) + c(0, 0) + c(1, 0) + c(0, 1) + c(1, 1)),
        body: fill("p"),
      };
    }
    case "ruled":
      return {
        defs: pat("p", 0.22, 0.6, dot(0.11, 0.11, 0.07)) + dots("q", 0.22, 0.07),
        body: fill("p") + `<rect x="${L(1.15) - L(0.11)}" width="${L(0.22)}" height="100%" fill="url(#q)" opacity=".6"/><rect x="${L(1.4) - L(0.11)}" width="${L(0.22)}" height="100%" fill="url(#q)" opacity=".6"/>`,
      };
    case "grid":
      return { defs: pat("p", 0.2, 1, dot(0.1, 0.1, 0.068)) + pat("q", 1, 0.2, dot(0.1, 0.1, 0.068)), body: fill("p") + fill("q") };
    case "hatch":
      return { defs: pat("p", 1, 1, [0, 1, 2, 3, 4].map((i) => dot(0.1 + i * 0.2, 0.9 - i * 0.2, 0.075)).join("")), body: fill("p") };
    case "check":
      return {
        defs: dots("d", 0.2, 0.07) + pat("p", 1.6, 1.6, `<rect width="${L(0.8)}" height="${L(0.8)}" fill="url(#d)"/><rect x="${L(0.8)}" y="${L(0.8)}" width="${L(0.8)}" height="${L(0.8)}" fill="url(#d)"/>`),
        body: fill("p"),
      };
    case "plaid":
      return {
        defs:
          dots("d", 0.2, 0.068) +
          pat("h", 1.38, 1.38, `<rect width="100%" height="${L(0.46)}" fill="url(#d)"/>`) +
          pat("v", 1.38, 1.38, `<rect width="${L(0.46)}" height="100%" fill="url(#d)"/>`) +
          pat("b", 0.2, 0.92, dot(0.1, 0.1, 0.05)),
        body: fill("h", 0.72) + fill("v", 0.72) + fill("b", 0.5),
      };
    case "rows":
      return {
        defs: dots("d", 0.2, 0.068) + pat("p", 2.05, 0.46, `<rect width="${L(1.75)}" height="${L(0.2)}" fill="url(#d)"/>`, `y="${L(0.96)}"`) + dots("h", 0.2, 0.075),
        body: `<rect y="${L(0.86)}" width="100%" height="100%" fill="url(#p)"/><rect width="100%" height="${L(0.62)}" fill="url(#h)"/>`,
      };
    case "cells":
      return { defs: dots("d", 1 / 6, 0.058) + pat("p", 1, 1, `<rect width="${L(0.5)}" height="${L(0.5)}" fill="url(#d)"/>`), body: fill("p") };
    default:
      return { defs: dots("p", 1, 0.29), body: fill("p") };
  }
}

/** the printed board as one svg: ground, pattern, spine with two sheens, a finish */
function boardSvg(c: OgCover) {
  const { w, h } = CV;
  const { defs, body } = patternSvg(c.pattern, c.ink, 38);
  const glow = c.deep
    ? `<filter id="gl" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}${glow}` +
    `<clipPath id="cl"><rect width="${w}" height="${h}" rx="6"/></clipPath>` +
    `<linearGradient id="sp1"><stop offset=".12" stop-color="#fff" stop-opacity="0"/><stop offset=".29" stop-color="#fff" stop-opacity=".24"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/><stop offset=".91" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="sp2"><stop offset="0" stop-opacity=".22"/><stop offset=".5" stop-opacity=".07"/><stop offset="1" stop-opacity=".18"/></linearGradient>` +
    `<linearGradient id="fin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".13"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-opacity=".07"/></linearGradient>` +
    `</defs><g clip-path="url(#cl)"><rect width="${w}" height="${h}" fill="${c.ground}"/>` +
    `<g opacity="${c.deep ? 0.8 : 1}" ${c.deep ? 'filter="url(#gl)"' : ""}>${body}</g>` +
    `<rect width="24" height="${h}" fill="url(#sp2)"/><rect width="24" height="${h}" fill="url(#sp1)"/><rect x="24" width="1" height="${h}" fill="#000" opacity=".12"/>` +
    `<rect width="${w}" height="${h}" fill="url(#fin)"/></g></svg>`
  );
}

/** the part opener: the printed board and a pasted paper label */
function Cover({ c }: { c: OgCover }) {
  return (
    <div
      style={{
        position: "absolute",
        left: CV.x,
        top: CV.y,
        width: CV.w,
        height: CV.h,
        display: "flex",
        borderRadius: 6,
        boxShadow: "0 1px 2px rgba(20,18,16,.18), 0 18px 40px -16px rgba(20,18,16,.35)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUri(boardSvg(c))} width={CV.w} height={CV.h} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
      <div
        style={{
          position: "absolute",
          left: 42,
          right: 22,
          bottom: 30,
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px 16px",
          borderRadius: 4,
          background: C.well,
          boxShadow: "0 1px 2px rgba(20,18,16,.2), 0 4px 10px -4px rgba(20,18,16,.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Geist Mono", fontSize: 15, color: C.mute }}>
          <span>{c.n}</span>
          <span>{c.count}</span>
        </div>
        <div style={{ marginTop: 8, fontFamily: "Redaction", fontSize: 30, lineHeight: 1.06, letterSpacing: -0.2, color: C.hi }}>{c.title}</div>
      </div>
    </div>
  );
}

export async function renderOg({
  address,
  title,
  blurb,
  glyph,
  motif,
  big = false,
  cover,
}: {
  /** everything.basics.stackAndHeap: the last segment is lit */
  address: string;
  title: string;
  blurb: string;
  /** the part's glyph picks the instrument */
  glyph: string;
  /** force an instrument (the home card) */
  motif?: Motif;
  big?: boolean;
  /** a part card: the part's cover instead of a dot fragment */
  cover?: OgCover;
}) {
  const [erode, redaction, italic, departure, mono] = await fonts;
  const F = cover ? new Field(0) : draw(motif ?? motifFor(glyph, address, title), address, big);
  const size = titleSize(title);
  const cut = address.lastIndexOf(".");
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${shapesSvg(markShapes(BOOK.kind), { ink: C.hi, faint: C.line2, book: BOOK.book })}</svg>`;
  const shortBlurb = blurb.length > 120 ? blurb.slice(0, 117).replace(/\s+\S*$/, "") + "…" : blurb;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.bg, color: C.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri(backdrop(F, !cover))} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        {cover && <Cover c={cover} />}

        <div style={{ position: "absolute", left: 72, top: 62, display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri(mark)} width={34} height={34} alt="" />
          <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "pre" }}>
            <span style={{ fontFamily: "Geist Mono", fontSize: 22, color: C.mute, letterSpacing: -0.2 }}>{BOOK.prefix}</span>
            <span style={{ fontFamily: "Redaction", fontSize: 34, color: C.hi, letterSpacing: -0.3 }}>everything</span>
          </div>
        </div>

        <div style={{ position: "absolute", left: 72, top: 168, width: 590, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Redaction 20",
              fontSize: size,
              lineHeight: 0.98,
              letterSpacing: -0.03 * size,
              color: C.hi,
              maxWidth: 590,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: "Piazzolla",
              fontStyle: "italic",
              fontSize: shortBlurb.length > 90 ? 26 : 28,
              lineHeight: 1.36,
              color: C.mute,
              maxWidth: 540,
            }}
          >
            {shortBlurb}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 52,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "Departure Mono",
            fontSize: 22,
            color: C.mute,
          }}
        >
          <div style={{ display: "flex" }}>
            <span>{cut > 0 ? address.slice(0, cut + 1) : ""}</span>
            <span style={{ color: C.hi }}>{cut > 0 ? address.slice(cut + 1) : address}</span>
          </div>
          <span style={{ color: C.ink }}>{BOOK.domain}</span>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Redaction 20", data: erode, weight: 400, style: "normal" },
        { name: "Redaction", data: redaction, weight: 400, style: "normal" },
        { name: "Piazzolla", data: italic, weight: 400, style: "italic" },
        { name: "Departure Mono", data: departure, weight: 400, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
