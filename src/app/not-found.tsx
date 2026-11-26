import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

// the 404, drawn: a weak reference whose page has been collected. main holds a strong reference
// to a WeakReference, and the WeakReference's referent is gone: get() returns null.
//
// one load moment, css only (no js): the reference lights up dot by dot, then the page drains,
// fill first, outline kept. the server renders the end state's geometry, so nothing waits on js.
// with reduced motion the drain still happens (colour and opacity), just without the walk.

const P = 14; // svg units per cell
const COLS = 36;
const ROWS = 12;
const at = (n: number) => n * P + P / 2;

type Tone = "dot" | "ref" | "meta" | "dead";
type Cell = { x: number; y: number; t: Tone; k: "fill" | "small" | "end"; role?: "walk" | "drain"; i?: number };

function cells(): Cell[] {
  const out: Cell[] = [];
  const block = (x: number, y: number, w: number, h: number, head: "row" | "col", role?: Cell["role"]) => {
    for (let j = 0; j < h; j++)
      for (let k = 0; k < w; k++) {
        const isHead = head === "row" ? j === 0 : k === 0;
        out.push({ x: x + k, y: y + j, t: isHead ? "meta" : "dot", k: "fill", role, i: k });
      }
  };
  const path = (pts: [number, number][], from: number) => {
    let n = from;
    for (let s = 0; s < pts.length - 1; s++) {
      let [x, y] = pts[s];
      const [x1, y1] = pts[s + 1];
      while (x !== x1 || y !== y1) {
        out.push({ x, y, t: "ref", k: "small", role: "walk", i: n++ });
        x += Math.sign(x1 - x);
        y += Math.sign(y1 - y);
      }
    }
    const [ex, ey] = pts[pts.length - 1];
    out.push({ x: ex, y: ey, t: "ref", k: "end", role: "walk", i: n++ });
    return n;
  };
  // the stack frame: main, with two slots
  block(1, 2, 6, 7, "row");
  // the WeakReference object: a header column and its fields
  block(13, 3, 6, 4, "col");
  // the page it pointed at, drained
  block(26, 2, 9, 8, "col", "drain");
  // main's slot holds a strong reference to the WeakReference
  const n = path([[7, 4], [12, 4]], 0);
  // the referent: a reference that still has an address, and nothing alive at the end
  path([[19, 5], [22, 5], [22, 6], [25, 6]], n);
  return out;
}

const CELLS = cells();
const WALK = CELLS.filter((c) => c.role === "walk").length;

/** a label under the figure, lined up with a column of the field */
function Label({ col, children }: { col: number; children: ReactNode }) {
  return (
    <span className="absolute top-0 whitespace-nowrap" style={{ left: `${((col * P) / (COLS * P)) * 100}%` }}>
      {children}
    </span>
  );
}

function Figure() {
  const sw = P * 0.09;
  const lit = new Set(CELLS.map((c) => `${c.x},${c.y}`));
  const grid: ReactNode[] = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (!lit.has(`${x},${y}`)) grid.push(<circle key={`${x},${y}`} cx={at(x)} cy={at(y)} r={P * 0.09} />);
  // seeded per-dot brightness, the same on every render
  let s = 7;
  const op = () => (0.8 + ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 0.2).toFixed(2);

  return (
    <svg
      viewBox={`0 0 ${COLS * P} ${ROWS * P}`}
      role="img"
      aria-label="a stack frame holds a reference to a WeakReference. its referent, the page, has been collected: a hollow ring where the object was."
      className="nf-fig"
    >
      <defs>
        {/* the dark theme's lit-display glow, same recipe as the figures */}
        <filter id="nf-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
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
      <g className="nf-grid">{grid}</g>
      <g className="nf-lit">
        {CELLS.map((c) => {
          const r = c.k === "small" ? P * 0.17 : c.k === "end" ? P * 0.27 : P * 0.28 - sw / 2;
          const drain = c.role === "drain" && c.t !== "meta";
          const style = {
            "--c": `var(--${c.t})`,
            "--o": op(),
            "--dl": c.role === "walk" ? `${120 + (c.i ?? 0) * 34}ms` : c.role === "drain" ? `${200 + WALK * 34 + (c.i ?? 0) * 60}ms` : undefined,
          } as CSSProperties;
          return (
            <circle
              key={`${c.x},${c.y}`}
              cx={at(c.x)}
              cy={at(c.y)}
              r={(c.role === "drain" ? P * 0.27 - sw / 2 : r).toFixed(2)}
              strokeWidth={c.k === "small" ? 0 : sw.toFixed(2)}
              className={c.role === "walk" ? "nf-walk" : drain ? "nf-drain" : c.role === "drain" ? "nf-drain-head" : undefined}
              style={style}
            />
          );
        })}
      </g>
    </svg>
  );
}

const css = `
.nf-panel { background: var(--well); box-shadow: var(--rim); border-radius: var(--radius-lg, 12px); padding: clamp(16px, 3vw, 28px); }
.nf-fig { display: block; width: 100%; height: auto; overflow: visible; }
.nf-grid { fill: var(--grid); }
.nf-lit circle { fill: var(--c); stroke: var(--c); opacity: var(--o); }
/* the page: the fill drains, the outline stays, the colour turns dead */
.nf-lit .nf-drain { fill: var(--dead); fill-opacity: 0; stroke: var(--dead); }
.nf-lit .nf-drain-head { fill: var(--meta); stroke: var(--meta); fill-opacity: 0; }
.nf-walk { animation: nf-walk 260ms var(--ease, ease-out) var(--dl) backwards; }
.nf-drain, .nf-drain-head { animation: nf-drain 420ms var(--ease, ease-out) var(--dl) backwards; }
@keyframes nf-walk { from { opacity: 0.12; } }
@keyframes nf-drain { from { fill: var(--dot); stroke: var(--dot); fill-opacity: 1; } }
.nf-drain-head { animation-name: nf-drain-head; }
@keyframes nf-drain-head { from { fill-opacity: 1; } }
:root[data-theme="dark"] .nf-lit { filter: url(#nf-glow); }
@media (prefers-reduced-motion: reduce) {
  /* no walk: the reference is simply there. the drain stays, it is colour and opacity only */
  .nf-walk { animation: none; }
  .nf-drain, .nf-drain-head { animation-delay: 200ms; }
}
`;

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-var(--bar-h))] max-w-[880px] flex-col justify-center px-[var(--gutter)] py-20">
      <style>{css}</style>
      <figure className="nf-panel m-0">
        <Figure />
        <figcaption className="relative mt-2 h-5 font-mono text-12 text-faint" aria-hidden>
          <Label col={1}>main</Label>
          <Label col={13}>
            <span className="hidden sm:inline">WeakReference</span>
            <span className="sm:hidden">weak ref</span>
          </Label>
          <Label col={26}>
            <span className="hidden sm:inline">the page, collected</span>
            <span className="sm:hidden">collected</span>
          </Label>
        </figcaption>
      </figure>
      <p className="mt-4 font-mono text-13 text-faint">
        page.get() <span className="text-mute">==</span> null
      </p>
      <h1 className="mt-10 font-title-eroded text-[clamp(2.5rem,1.6rem+3vw,3.5rem)] leading-[0.98] tracking-[-0.03em] text-hi">
        that page was collected.
      </h1>
      <p className="mt-5 max-w-[36rem] font-body text-[1.125rem] leading-[1.6] text-mute">
        the link held a weak reference, and the page at the other end is gone. the contents has every page that&apos;s still
        reachable.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/learn" className="act solid">
          open the contents
        </Link>
        <Link href="/" className="act">
          go home
        </Link>
      </div>
    </main>
  );
}
