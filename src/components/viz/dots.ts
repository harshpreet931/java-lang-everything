// the dot-field model. pure data, safe on the server and the client.
//
// a figure is a grid of cells. unlit cells are the address space (drawn as tiny
// grid dots). lit cells carry one of the five semantic tones (or "dot", neutral
// structure) and one shape, so colour is never the only signal:
//   ref  = a run of small dots ending in a bigger "end" dot   (points at)
//   meta = the header column at the left of every block        (machinery)
//   dead = a hollow ring: the fill drained, the outline kept    (garbage)
//   hot  = a slightly larger dot                                (look here)
//   live = a filled dot                                         (valid, reachable)
//
// every lit cell belongs to a group (an object, a path, a frame) so a figure can
// restyle, drain or light a whole group at once, and has an order inside it so
// the change can travel as a wave. paths keep their cells in order for comets.
//
// same vocabulary as the sql book's figure kit (tone names, tv()).

export type Tone = "ref" | "live" | "dead" | "meta" | "hot";
export type DotTone = Tone | "dot";
export type DotKind = "fill" | "ring" | "small" | "end";
export type Pt = readonly [number, number];

export type Dot = {
  x: number;
  y: number;
  tone: DotTone;
  kind: DotKind;
  /** the group this dot belongs to (an object, a path) */
  g: string;
  /** order inside the group, for waves */
  i: number;
};

export type Field = {
  cols: number;
  rows: number;
  dots: Dot[];
  /** ordered cells of every path, for comets */
  paths: Record<string, Pt[]>;
};

/** the css colour of a dot tone. */
export const tv = (t: DotTone | "grid"): string => (t === "dot" ? "var(--dot, var(--ink))" : t === "grid" ? "var(--grid, var(--line-2))" : `var(--${t})`);

/** a tiny seeded rng (lcg), so per-dot opacity is the same on the server and the client. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** cells along an orthogonal polyline, corners included once, in order. */
export function walk(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  const seen = new Set<string>();
  for (let p = 0; p < pts.length - 1; p++) {
    let [x0, y0] = pts[p];
    const [x1, y1] = pts[p + 1];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    for (;;) {
      const k = `${x0},${y0}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([x0, y0]);
      }
      if (x0 === x1 && y0 === y1) break;
      // orthogonal only: walk x first, then y, if a segment is diagonal
      if (x0 !== x1) x0 += dx;
      else y0 += dy;
    }
  }
  if (pts.length === 1) out.push(pts[0]);
  return out;
}

export type BlockOpts = {
  tone?: DotTone;
  kind?: "fill" | "ring";
  /** a meta header column at the left (default true) */
  header?: boolean;
  /** header tone (default meta) */
  headerTone?: DotTone;
  /** wave order: by column (default), by row, or from a corner */
  order?: "col" | "row" | "diag";
};

/**
 *   const f = dotField(48, 34);
 *   f.block("p1", 10, 2, 7, 4);                 // an object with a meta header
 *   f.path("p->s", [[5, 5], [9, 5]]);           // a reference, small dots then an end dot
 *   f.set("x", 3, 3, "hot");
 *   <DotField field={f.done()} />
 */
export function dotField(cols: number, rows: number) {
  const cells = new Map<string, Dot>();
  const paths: Record<string, Pt[]> = {};
  const put = (d: Dot) => {
    if (d.x < 0 || d.y < 0 || d.x >= cols || d.y >= rows) return;
    cells.set(`${d.x},${d.y}`, d);
  };
  const api = {
    cols,
    rows,
    set(g: string, x: number, y: number, tone: DotTone = "dot", kind: DotKind = "fill", i = 0) {
      put({ x, y, tone, kind, g, i });
      return api;
    },
    /** a rectangle of dots. the first column is the meta header unless header: false. */
    block(g: string, x: number, y: number, w: number, h: number, o: BlockOpts = {}) {
      const { tone = "dot", kind = "fill", header = true, headerTone = "meta", order = "col" } = o;
      for (let j = 0; j < h; j++)
        for (let k = 0; k < w; k++) {
          const isH = header && k === 0;
          const i = order === "row" ? j : order === "diag" ? j + k : k;
          put({ x: x + k, y: y + j, tone: isH ? headerTone : tone, kind: isH ? (kind === "ring" ? "ring" : "fill") : kind, g, i });
        }
      return api;
    },
    /** an orthogonal path: small dots, then a bigger end dot. tone defaults to ref. */
    path(g: string, pts: readonly Pt[], tone: DotTone = "ref", end = true) {
      const cs = walk(pts);
      paths[g] = cs;
      cs.forEach(([x, y], i) => put({ x, y, tone, kind: end && i === cs.length - 1 ? "end" : "small", g, i }));
      return api;
    },
    /** a horizontal run of dots (a row, a buffer). */
    run(g: string, x: number, y: number, n: number, tone: DotTone = "dot", kind: DotKind = "fill") {
      for (let k = 0; k < n; k++) put({ x: x + k, y, tone, kind, g, i: k });
      return api;
    },
    /** remove whatever is at a cell (to cut a gap into a block). */
    clear(x: number, y: number) {
      cells.delete(`${x},${y}`);
      return api;
    },
    has(x: number, y: number) {
      return cells.has(`${x},${y}`);
    },
    done(): Field {
      const dots = [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
      return { cols, rows, dots, paths };
    },
  };
  return api;
}

/** the centre of a cell in svg units. */
export const at = (n: number, pitch: number) => n * pitch + pitch / 2;
