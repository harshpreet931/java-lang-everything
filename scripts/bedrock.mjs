#!/usr/bin/env node
// node scripts/bedrock.mjs [java|sql]
//
// writes src/components/site/bedrock-data.ts: the floor at the bottom of every page (Footer.tsx).
// "everything" is set in Redaction 20 on a 4x4 supersampled canvas per dot cell, and a cell keeps a
// dot when its coverage is over 62% (dropping 3.5% of those), or 62% of the time between 36% and 62%,
// so the word arrives eroded the way Redaction 20 is. around it the script packs a seeded heap (java)
// or heap file (sql). the output is runs of cells per kind, for three layouts (phone, tablet, desktop),
// so the client never loads a font parser and the server can draw the same picture as svg.
//
// dev-only: rasterising the font needs a chromium. it uses playwright-core, from PLAYWRIGHT_CORE
// (a path to playwright-core's index.mjs) or an installed `playwright-core` package. run it again
// only when the font, the seeds or the layouts change, and commit the data file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = process.argv[2] ?? "java";
if (BOOK !== "java" && BOOK !== "sql") throw new Error("book is java or sql");
const fontFile = path.join(root, "src/fonts/redaction-20/Redaction20-400-normal.woff2");
const out = path.join(root, "src/components/site/bedrock-data.ts");
const outSvg = path.join(root, "public/bedrock.svg");

// vc: the columns a reader sees at the layout's reference width; the pitch is width / vc (desktop
// caps it at pmax, and shows more of the dc columns past that). frac: how much of vc the word spans.
// top: rows of heap above the word.
const LAYOUTS = {
  p: { vc: 97, dc: 97, frac: 0.94, top: 16, phone: true },
  t: { vc: 150, dc: 150, frac: 0.9, top: 14, phone: false },
  d: { vc: 205, dc: 300, frac: 0.9, top: 14, phone: false },
};

const S = 4; // samples per cell edge

const pw = process.env.PLAYWRIGHT_CORE ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href) : await import("playwright-core");
const browser = await pw.chromium.launch();
const page = await browser.newPage();
const b64 = fs.readFileSync(fontFile).toString("base64");
await page.setContent(`<style>@font-face{font-family:R20;src:url(data:font/woff2;base64,${b64}) format("woff2")}</style><p style="font-family:R20">everything</p>`);
await page.evaluate(() => document.fonts.load('400 100px "R20"'));

const cov = {};
for (const [key, L] of Object.entries(LAYOUTS)) {
  cov[key] = await page.evaluate(
    ({ L, S }) => {
      const m = document.createElement("canvas").getContext("2d");
      m.font = '400 100px "R20"';
      const adv = m.measureText("everything").width / 100;
      const fs = (L.vc * L.frac) / adv; // font size in cells
      const asc = Math.ceil(fs * 0.74);
      const rows = L.top + asc + Math.round(fs * 0.1); // the floor crops the descenders
      const baseRow = L.top + asc;
      const mc = document.createElement("canvas");
      mc.width = L.dc * S;
      mc.height = rows * S;
      const g = mc.getContext("2d");
      g.font = `400 ${fs * S}px "R20"`;
      const tw = g.measureText("everything").width;
      g.fillText("everything", (L.dc * S - tw) / 2, baseRow * S);
      const px = g.getImageData(0, 0, mc.width, mc.height).data;
      const c = [];
      for (let r = 0; r < rows; r++)
        for (let x = 0; x < L.dc; x++) {
          let a = 0;
          for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) a += px[((r * S + y) * mc.width + x * S + z) * 4 + 3];
          c.push(Math.round((a / (S * S * 255)) * 100));
        }
      return { rows, baseRow, fs, cov: c };
    },
    { L, S },
  );
}
await browser.close();

// ---------------------------------------------------------------------------- the model

// kinds: 0 grid, 1 glyph, 2 header, 3 body, 4 garbage, 5 fresh, 6 ref, 7 ref end,
// 8 tuple, 9 dead tuple, 10 page header, 11 the root reference (and the slot that holds it), 12 its end,
// 13 the root frame's header column, 14 its other slots
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function build(L, { rows, baseRow, fs, cov: cv }) {
  const cols = L.dc;
  const N = cols * rows;
  const R = rng(BOOK === "java" ? 25 : 18);
  const kind = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const c = cv[i] / 100;
    if (c > 0.62 ? R() > 0.035 : c > 0.36 ? R() < 0.62 : false) kind[i] = 1;
  }
  const halo = new Uint8Array(N);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (kind[r * cols + c] === 1)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const cc = c + dx, rr = r + dy;
            if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) halo[rr * cols + cc] = 1;
          }
  const taken = new Uint8Array(N); // cells something other than the heap has claimed
  const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && kind[r * cols + c] === 0 && !halo[r * cols + c] && !taken[r * cols + c];
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? 255 : kind[r * cols + c]);
  const set = (c, r, k) => (kind[r * cols + c] = k);

  if (BOOK === "java") {
    // the root: a stack frame left of the word, holding the one reference that runs into the first
    // letter. it bends once: across above the word, then down into the top of the e.
    let first = cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (kind[r * cols + c] === 1 && c < first) first = c;
    // the e: the glyph columns from `first` until the first empty column
    let eEnd = first;
    for (let c = first; c < cols; c++) {
      let any = false;
      for (let r = 0; r < rows; r++) if (kind[r * cols + c] === 1) any = true;
      if (!any) break;
      eEnd = c;
    }
    const tc = Math.round((first + eEnd) / 2);
    let top = 0;
    while (top < rows && kind[top * cols + tc] !== 1) top++;
    const visLeft = Math.floor((L.dc - L.vc) / 2);
    const fw = L.phone ? 3 : 4, fh = 3;
    // (13 the frame's header column, 14 its slots)
    const f0 = Math.max(visLeft + 1, first - fw - (L.phone ? 4 : 7));
    const fr = Math.max(2, top - (L.phone ? 7 : 10)); // the frame's slot row
    for (let r = fr - 1; r <= fr + 1; r++)
      for (let c = f0; c < f0 + fw; c++) {
        set(c, r, c === f0 ? 13 : r === fr && c === f0 + fw - 1 ? 11 : 14);
        taken[r * cols + c] = 1;
      }
    // across, then down, stopping one cell short of the glyph
    const path = [];
    for (let c = f0 + fw; c <= tc; c++) path.push([c, fr]);
    for (let r = fr + 1; r < top - 1; r++) path.push([tc, r]);
    path.forEach(([c, r], n) => set(c, r, n === path.length - 1 ? 12 : 11));
    // keep the heap off the frame and the reference
    for (const [c, r] of [...path, ...Array.from({ length: fh * fw }, (_, j) => [f0 + (j % fw), fr - 1 + Math.floor(j / fw)])])
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cc = c + dx, rr = r + dy;
          if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) taken[rr * cols + cc] = 1;
        }

    // the heap: objects as dot blocks, a header column at the left, packed into the free space
    const objs = [];
    const grp = new Int32Array(N).fill(-1);
    const tries = Math.round((cols * rows) / 4);
    for (let t = 0; t < tries; t++) {
      const w = 4 + Math.floor(R() * (L.phone ? 6 : 9)), h = 3 + Math.floor(R() * 3);
      const c0 = Math.floor(R() * (cols - w)), r0 = Math.floor(R() * (rows - h + 1));
      let ok = true;
      for (let r = r0 - 1; r <= r0 + h && ok; r++)
        for (let c = c0 - 2; c <= c0 + w + 1 && ok; c++) {
          if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
          if (!free(c, r)) ok = false;
        }
      if (!ok) continue;
      const roll = R();
      const body = roll < 0.16 ? 4 : roll < 0.22 ? 5 : 3;
      const id = objs.length;
      objs.push({ c0, r0, w, h, body });
      for (let r = r0; r < r0 + h; r++)
        for (let c = c0; c < c0 + w; c++) {
          set(c, r, c === c0 ? 2 : body);
          grp[r * cols + c] = id;
        }
    }
    // references: straight runs from an object's edge to the next object they meet
    for (const o of objs) {
      if (o.body === 4 && R() < 0.7) continue; // garbage mostly has nobody pointing out of it
      const dirs = R() < 0.5 ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]];
      for (const [dx, dy] of dirs) {
        const r = dy ? o.r0 + o.h : o.r0 + Math.floor(R() * o.h);
        const c = dx ? o.c0 + o.w : o.c0 + 1 + Math.floor(R() * (o.w - 1));
        const run = [];
        let cc = c, rr = r, hit = false;
        while (cc < cols && rr < rows) {
          const k = at(cc, rr);
          if (k === 0 && !halo[rr * cols + cc] && !taken[rr * cols + cc]) {
            run.push([cc, rr]);
            cc += dx;
            rr += dy;
            continue;
          }
          hit = k >= 2 && k <= 5;
          break;
        }
        if (hit && run.length >= 2) {
          run.forEach(([x, y], n) => set(x, y, n === run.length - 1 ? 7 : 6));
          break;
        }
      }
    }
  } else {
    // the heap file: pages side by side, each with a header bar, tuples as whole rows
    const pw = L.phone ? 22 : 30;
    for (let p0 = 0; p0 < cols; p0 += pw + 2) {
      const p1 = Math.min(cols - 1, p0 + pw - 1);
      for (let c = p0; c <= p1; c++) if (kind[c] === 0) set(c, 0, 10);
      for (let r = 2; r < rows; r += 2) {
        let c = p0;
        while (c <= p1) {
          if (!free(c, r)) {
            c++;
            continue;
          }
          let e = c;
          while (e + 1 <= p1 && free(e + 1, r)) e++;
          let s = c;
          while (s <= e) {
            const len = Math.min(e - s + 1, 3 + Math.floor(R() * (pw - 4)));
            if (len >= 3 && R() < 0.82) {
              const k = R() < 0.14 ? 9 : 8;
              for (let x = s; x < s + len; x++) set(x, r, k);
            }
            s += len + 1;
          }
          c = e + 1;
        }
      }
    }
  }

  // maximal horizontal runs of one kind: [kind, row, col, length]
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const k = kind[r * cols + c];
      if (k === 0) {
        c++;
        continue;
      }
      let e = c;
      while (e + 1 < cols && kind[r * cols + e + 1] === k) e++;
      runs.push(k, r, c, e - c + 1);
      c = e + 1;
    }
  }
  return { vc: L.vc, dc: L.dc, rows, base: baseRow, fs: Math.round(fs * 10) / 10, runs };
}

const data = {};
for (const [key, L] of Object.entries(LAYOUTS)) data[key] = build(L, cov[key]);

const enc = (a) => {
  // runs as one string of base-36 numbers, four per run, so the module stays small
  return a.map((n) => n.toString(36)).join(" ");
};
const src = `// generated by scripts/bedrock.mjs (${BOOK}). do not edit by hand: change the script and run it again.
// each layout: vc visible columns at the reference width, dc designed columns (centred), rows,
// base the word's baseline row, and runs: [kind, row, col, length] in base 36, space separated.

export type BedrockLayout = { vc: number; dc: number; rows: number; base: number; runs: string };

export const BEDROCK: Record<"p" | "t" | "d", BedrockLayout> = {
${Object.entries(data)
  .map(([k, d]) => `  ${k}: { vc: ${d.vc}, dc: ${d.dc}, rows: ${d.rows}, base: ${d.base}, runs: "${enc(d.runs)}" },`)
  .join("\n")}
};
`;
fs.writeFileSync(out, src);

// ---------------------------------------------------------------------------- the static first frame
// one svg file, one <g> per layout, drawn in cell units (a cell is 1 wide, a dot sits at its centre).
// Footer.tsx shows it with <use href="/bedrock.svg#d">, so it is fetched once and cached, not repeated
// in every page's html. colours are the footer's --bk-* tokens, which follow the theme through <use>.
// a run of dots is one stroked line with a dash per cell. the address space is one line per row.
const R = { 13: 0.25, 14: 0.25, 1: 0.36, 2: 0.25, 3: 0.25, 4: 0.27, 5: 0.25, 6: 0.13, 7: 0.27, 8: 0.2, 9: 0.24, 10: 0.2, 11: 0.2, 12: 0.32 };
const f = (n) => String(Math.round(n * 1000) / 1000).replace(/^0\./, ".");
const dots = (runs, k) => {
  let d = "";
  for (let i = 0; i < runs.length; i += 4) if (runs[i] === k) d += `M${f(runs[i + 2] + 0.5)} ${f(runs[i + 1] + 0.5)}h${f(runs[i + 3] - 1 + 0.002)}`;
  return d;
};
const bars = (runs, k) => {
  let d = "";
  for (let i = 0; i < runs.length; i += 4) if (runs[i] === k && runs[i + 3] > 1) d += `M${f(runs[i + 2] + 0.5)} ${f(runs[i + 1] + 0.5)}h${runs[i + 3] - 1}`;
  return d;
};
const line = (d, w, colour, dash = true) =>
  d ? `<path d="${d}" style="fill:none;stroke:${colour};stroke-width:${f(w)};stroke-linecap:round${dash ? ";stroke-dasharray:.001 .999" : ""}"/>` : "";
let svg = `<svg xmlns="http://www.w3.org/2000/svg"><!-- generated by scripts/bedrock.mjs (${BOOK}) -->\n`;
for (const [key, d] of Object.entries(data)) {
  const { runs } = d;
  const has = (k) => runs.some((_, i) => i % 4 === 0 && runs[i] === k);
  let g = "";
  // the heap's structure, a step under the word
  let st = line(Array.from({ length: d.rows }, (_, r) => `M.5 ${f(r + 0.5)}h${f(d.dc - 1 + 0.002)}`).join(""), 0.26, "var(--grid)");
  for (const k of [2, 3, 5, 6, 7, 10, 8]) st += line(dots(runs, k), R[k] * 2, `var(--bk-${k})`);
  if (BOOK === "sql") st += line(bars(runs, 8), 0.34, "var(--bk-8)", false) + line(bars(runs, 10), 0.34, "var(--bk-10)", false);
  // garbage and dead tuples are rings: a dot, then the paper inside it
  for (const k of [4, 9]) if (has(k)) st += line(dots(runs, k), R[k] * 2, `var(--bk-${k})`) + line(dots(runs, k), (R[k] - 0.09) * 2, "var(--bg)");
  g += `<g style="opacity:.75">${st}</g>`;
  if (BOOK === "sql") g += line(bars(runs, 1), 0.5, "var(--bk-1)", false);
  g += line(dots(runs, 1), R[1] * 2, "var(--bk-1)");
  g += line(dots(runs, 13), R[13] * 2, "var(--bk-13)") + line(dots(runs, 14), R[14] * 2, "var(--bk-14)");
  g += line(dots(runs, 11), R[11] * 2, "var(--bk-11)") + line(dots(runs, 12), R[12] * 2, "var(--bk-11)");
  svg += `<g id="${key}">${g}</g>\n`;
}
svg += "</svg>\n";
fs.writeFileSync(outSvg, svg);
console.log("wrote", path.relative(root, outSvg), `${(svg.length / 1024).toFixed(1)}kb`);
for (const [k, d] of Object.entries(data)) console.log(k, `${d.dc}x${d.rows}`, `fs ${d.fs}`, `${d.runs.length / 4} runs`);
console.log("wrote", path.relative(root, out), `${(src.length / 1024).toFixed(1)}kb`);
