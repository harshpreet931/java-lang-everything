// the marks, as data. one source for the bar mark (Mark.tsx), the favicons (icon.svg, ico, pngs)
// and the share images (og.tsx). everything sits on a three by three dot grid in a 16 unit box.
//
// tones, not colours: the caller maps them. on the page ink is currentColor, faint is --line-2 and
// book is --book. on the dark display tile they are fixed, since a favicon can't read css.

export type Tone = "ink" | "faint" | "book";
export type MarkKind = "series" | "java" | "sql";
export type Shape =
  | { t: "dot"; cx: number; cy: number; r: number; tone: Tone }
  | { t: "pill"; x: number; y: number; w: number; h: number; tone: Tone }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; tone: Tone };

/** the page grid: dots at 3.5, 8, 12.5 */
const P = [3.5, 8, 12.5];
/**
 * the tile grid, tuned for 16px: 3px dots at 2.5, 7.5, 12.5, so at one unit to one pixel every dot
 * covers whole pixels (crisp, not a soft 4px blur), is at least 2.5px across, and every gap is 2px.
 */
const T = [2.5, 7.5, 12.5];

export function markShapes(kind: MarkKind, size: "page" | "tile" = "page"): Shape[] {
  const s: Shape[] = [];
  if (kind === "series") {
    // all the way down: each row smaller than the last. never coloured.
    const r = [2.05, 1.6, 1.1];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) s.push({ t: "dot", cx: P[x], cy: P[y], r: r[y], tone: "ink" });
    return s;
  }
  if (kind === "java") {
    // a reference on the grid: one slot, a stroke, one object lit in the book colour.
    // the faint dots are the rest of the heap.
    if (size === "tile") {
      for (const [x, y] of [[1, 0], [2, 0], [0, 1], [0, 2]]) s.push({ t: "dot", cx: T[x], cy: T[y], r: 1.5, tone: "faint" });
      s.push({ t: "line", x1: 3.6, y1: 3.6, x2: 8, y2: 8, w: 1.6, tone: "ink" });
      s.push({ t: "dot", cx: T[0], cy: T[0], r: 1.5, tone: "ink" });
      s.push({ t: "dot", cx: 10, cy: 10, r: 4, tone: "book" });
      return s;
    }
    for (const [x, y] of [[1, 0], [2, 0], [0, 1], [0, 2]]) s.push({ t: "dot", cx: P[x], cy: P[y], r: 1.25, tone: "faint" });
    s.push({ t: "line", x1: P[0] + 1.2, y1: P[0] + 1.2, x2: P[1] + 0.6, y2: P[1] + 0.6, w: 1.3, tone: "ink" });
    s.push({ t: "dot", cx: P[0], cy: P[0], r: 2.05, tone: "ink" });
    s.push({ t: "dot", cx: 10.6, cy: 10.6, r: 3.7, tone: "book" });
    return s;
  }
  // sql: a table on the grid. a header, the row the query lit, a row it left alone.
  if (size === "tile") {
    s.push({ t: "pill", x: 1, y: 1, w: 13, h: 3, tone: "ink" });
    for (let x = 0; x < 3; x++) s.push({ t: "dot", cx: T[x], cy: T[1], r: 1.5, tone: "book" });
    for (let x = 0; x < 3; x++) s.push({ t: "dot", cx: T[x], cy: T[2], r: 1.5, tone: "faint" });
    return s;
  }
  s.push({ t: "pill", x: 1.45, y: 1.45, w: 13.1, h: 4.1, tone: "ink" });
  for (let x = 0; x < 3; x++) s.push({ t: "dot", cx: P[x], cy: P[1], r: 2.05, tone: "book" });
  for (let x = 0; x < 3; x++) s.push({ t: "dot", cx: P[x], cy: P[2], r: 1.25, tone: "faint" });
  return s;
}

/** svg markup for the shapes, for places that can't render react (favicons, share images) */
export function shapesSvg(shapes: Shape[], tone: Record<Tone, string>): string {
  return shapes
    .map((s) => {
      if (s.t === "dot") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${tone[s.tone]}"/>`;
      if (s.t === "pill") return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.h / 2}" fill="${tone[s.tone]}"/>`;
      return `<path d="M${s.x1} ${s.y1}L${s.x2} ${s.y2}" stroke="${tone[s.tone]}" stroke-width="${s.w}" stroke-linecap="round"/>`;
    })
    .join("");
}

/** the display tile the favicons sit on: dark in every browser chrome, dots lit */
export const tile = {
  bg: "#161513",
  edge: "#4a4741",
  ink: "#f1ece3",
  faint: "#4a4741",
  book: { java: "#f17ca8", sql: "#4fd0c5" },
};

/**
 * a favicon as a standalone svg. `rim` adds the faint book-colour rim used at 180 and up;
 * `size` picks the 16px-tuned glyph ("tile") or the page glyph ("page") for the big icons.
 */
export function iconSvg(book: "java" | "sql", { rim = false, glyph = "tile" as "tile" | "page" } = {}) {
  const tones = { ink: tile.ink, faint: tile.faint, book: tile.book[book] };
  const frame =
    `<rect x=".25" y=".25" width="15.5" height="15.5" rx="3.45" fill="${tile.bg}" stroke="${tile.edge}" stroke-width=".5"/>` +
    (rim ? `<rect x=".5" y=".5" width="15" height="15" rx="3.2" fill="none" stroke="${tile.book[book]}" stroke-opacity=".32" stroke-width=".22"/>` : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${frame}${shapesSvg(markShapes(book, glyph), tones)}</svg>`;
}
