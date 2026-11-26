// the hero heap: one model, two renderers. the server draws it as svg (the first frame),
// the client takes over with a canvas when the reader starts a collection.
// coordinates are dot cells on a 48 by 34 grid. a cell is PITCH user units wide.

export const COLS = 48;
export const ROWS = 34;
export const PITCH = 12;
export const W = COLS * PITCH;
export const H = ROWS * PITCH;

export type Tone = "dot" | "meta" | "ref" | "live" | "dead" | "hot";
export type Kind = "fill" | "ring" | "small" | "end";

export type Frame = { id: string; name: string; y: number; slots: number; refs: number[] };
export type Obj = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** unreachable from the start */
  garbage?: boolean;
  /** allocated just before the page opened: "1 new" */
  fresh?: boolean;
  /** only exists after the allocate step */
  spawn?: boolean;
};
export type Edge = { from: string; to: string; field: string; pts: [number, number][]; spawn?: boolean };

/** three stack frames: the gc roots. x 1 to 4, a meta header row, then slots */
export const frames: Frame[] = [
  { id: "main", name: "main()", y: 3, slots: 5, refs: [5, 7] },
  { id: "handle", name: "handle()", y: 11, slots: 3, refs: [14] },
  { id: "log", name: "log()", y: 17, slots: 2, refs: [18] },
];

export const objs: Obj[] = [
  { id: "order", name: "Order", x: 10, y: 2, w: 7, h: 4 },
  { id: "customer", name: "Customer", x: 21, y: 2, w: 9, h: 3 },
  { id: "address", name: "Address", x: 34, y: 3, w: 6, h: 5 },
  { id: "city", name: "String", x: 43, y: 2, w: 4, h: 4 },
  { id: "cache", name: "HashMap", x: 11, y: 11, w: 5, h: 3 },
  { id: "cart", name: "Cart", x: 21, y: 9, w: 12, h: 3 },
  { id: "coupon", name: "Coupon", x: 37, y: 12, w: 7, h: 3 },
  { id: "oldOrder", name: "Order", x: 12, y: 19, w: 7, h: 4, garbage: true },
  { id: "items", name: "Item[]", x: 24, y: 17, w: 6, h: 4 },
  { id: "item", name: "Item", x: 34, y: 19, w: 5, h: 3, fresh: true },
  { id: "bytes", name: "byte[]", x: 43, y: 18, w: 4, h: 3, garbage: true },
  { id: "request", name: "Request", x: 10, y: 27, w: 9, h: 3 },
  { id: "buf", name: "byte[]", x: 23, y: 26, w: 5, h: 5 },
  { id: "session", name: "Session", x: 31, y: 27, w: 6, h: 3, garbage: true },
  { id: "code", name: "String", x: 40, y: 25, w: 6, h: 4 },
  // allocate puts a HashMap node in the slot the old Order freed
  { id: "node", name: "HashMap.Node", x: 12, y: 19, w: 6, h: 3, spawn: true },
];

export const edges: Edge[] = [
  { from: "main", to: "order", field: "order", pts: [[5, 5], [9, 5]] },
  { from: "main", to: "cache", field: "cache", pts: [[5, 7], [7, 7], [7, 12], [10, 12]] },
  { from: "handle", to: "request", field: "req", pts: [[5, 14], [8, 14], [8, 28], [9, 28]] },
  { from: "log", to: "buf", field: "buf", pts: [[5, 18], [6, 18], [6, 31], [25, 31]] },
  { from: "order", to: "customer", field: "customer", pts: [[17, 3], [20, 3]] },
  { from: "customer", to: "address", field: "address", pts: [[30, 3], [33, 3]] },
  { from: "address", to: "city", field: "city", pts: [[40, 4], [42, 4]] },
  { from: "order", to: "cart", field: "cart", pts: [[14, 6], [14, 8], [19, 8], [19, 10], [20, 10]] },
  { from: "cart", to: "coupon", field: "coupon", pts: [[33, 10], [36, 10], [36, 12]] },
  { from: "cart", to: "items", field: "items", pts: [[26, 12], [26, 16]] },
  { from: "items", to: "item", field: "[0]", pts: [[30, 19], [33, 19]] },
  { from: "coupon", to: "code", field: "code", pts: [[41, 15], [41, 24]] },
  { from: "request", to: "buf", field: "body", pts: [[19, 28], [22, 28]] },
  { from: "session", to: "oldOrder", field: "last", pts: [[30, 28], [29, 28], [29, 22], [19, 22]] },
  { from: "cache", to: "node", field: "table[3]", pts: [[13, 14], [13, 18]], spawn: true },
];

/** expand an orthogonal polyline into its cells, without repeats */
export function walk(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (let p = 0; p < pts.length - 1; p++) {
    let [x, y] = pts[p];
    const [x1, y1] = pts[p + 1];
    const dx = Math.sign(x1 - x);
    const dy = Math.sign(y1 - y);
    for (;;) {
      const k = `${x},${y}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([x, y]);
      }
      if (x === x1 && y === y1) break;
      x += dx;
      y += dy;
    }
  }
  return out;
}

/** one lit dot. `owner` is the frame, object or edge it belongs to. */
export type Cell = {
  x: number;
  y: number;
  tone: Tone;
  kind: Kind;
  /** 0.8 to 1, seeded, so a block reads like a lit panel instead of a flat fill */
  a: number;
  owner: string;
  ownerType: "frame" | "obj" | "edge";
  /** index along an edge, or column inside an object */
  i: number;
  spawn?: boolean;
  /** the frame slot a root reference leaves from */
  root?: boolean;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export const edgeId = (e: Edge) => `${e.from}>${e.to}`;

function build() {
  const R = rng(11);
  const cells: Cell[] = [];
  for (const f of frames) {
    for (let x = 1; x <= 4; x++) cells.push({ x, y: f.y, tone: "meta", kind: "fill", a: 0, owner: f.id, ownerType: "frame", i: x - 1 });
    for (let j = 1; j <= f.slots; j++)
      for (let x = 1; x <= 4; x++) {
        const root = f.refs.includes(f.y + j) && x === 4;
        cells.push({ x, y: f.y + j, tone: root ? "ref" : "dot", kind: "fill", a: 0, owner: f.id, ownerType: "frame", i: x - 1, root });
      }
  }
  for (const o of objs) {
    for (let j = 0; j < o.h; j++)
      for (let i = 0; i < o.w; i++) {
        const head = i === 0;
        const tone: Tone = head ? "meta" : o.garbage ? "dead" : o.fresh || o.spawn ? "hot" : "dot";
        cells.push({ x: o.x + i, y: o.y + j, tone, kind: o.garbage ? "ring" : "fill", a: 0, owner: o.id, ownerType: "obj", i, spawn: o.spawn });
      }
  }
  for (const e of edges) {
    const run = walk(e.pts);
    run.forEach(([x, y], i) =>
      cells.push({ x, y, tone: "ref", kind: i === run.length - 1 ? "end" : "small", a: 0, owner: edgeId(e), ownerType: "edge", i, spawn: e.spawn }),
    );
  }
  for (const c of cells) c.a = 0.8 + R() * 0.2;
  return cells;
}

export const cells: Cell[] = build();

/** radius of a dot, in user units */
export function radius(c: Pick<Cell, "kind" | "tone">) {
  if (c.kind === "small") return PITCH * 0.17;
  if (c.kind === "end") return PITCH * 0.27;
  if (c.tone === "hot") return PITCH * 0.31;
  return PITCH * 0.28;
}
export const GRID_R = PITCH * 0.09;
export const RING_W = PITCH * 0.09;

export const objById = new Map(objs.map((o) => [o.id, o]));
export const frameById = new Map(frames.map((f) => [f.id, f]));
export const edgeById = new Map(edges.map((e) => [edgeId(e), e]));
export const edgeLen = new Map(edges.map((e) => [edgeId(e), walk(e.pts).length]));
export const nameOf = (id: string) => objById.get(id)?.name ?? frameById.get(id)?.name ?? id;

/**
 * the mark phase as a schedule. every reachable object is scanned once; scanning sends a
 * comet down each of its outgoing references. an object is marked when the first comet
 * reaches it (dijkstra over path lengths). times are in "dot steps" plus a scan pause.
 */
export type MarkPlan = {
  marked: Map<string, number>; // object id -> time it turns live
  comets: { edge: string; start: number; len: number }[];
  end: number;
};

export function planMark(dotMs: number, scanMs: number, live: (e: Edge) => boolean): MarkPlan {
  const marked = new Map<string, number>();
  const comets: MarkPlan["comets"] = [];
  const queue: { id: string; t: number }[] = frames.map((f) => ({ id: f.id, t: 0 }));
  const scanned = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t);
    const { id, t } = queue.shift()!;
    if (scanned.has(id)) continue;
    scanned.add(id);
    if (objById.has(id)) marked.set(id, t);
    for (const e of edges) {
      if (e.from !== id || !live(e)) continue;
      const len = edgeLen.get(edgeId(e))!;
      const start = t + (objById.has(id) ? scanMs : 0);
      comets.push({ edge: edgeId(e), start, len });
      const arrive = start + len * dotMs;
      if (!scanned.has(e.to)) queue.push({ id: e.to, t: arrive });
    }
  }
  let end = 0;
  for (const c of comets) end = Math.max(end, c.start + c.len * dotMs);
  for (const t of marked.values()) end = Math.max(end, t);
  return { marked, comets, end };
}

export const startEdges = (e: Edge) => !e.spawn;
