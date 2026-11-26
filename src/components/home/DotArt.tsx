import s from "./home.module.css";

/**
 * a small dot drawing on the same grid as the hero heap. one character per cell:
 *   .  an unlit dot (the address space)
 *   o  structure        m  meta, a header        h  hot, look here
 *   l  live             x  dead, a hollow ring
 *   r  a reference run  R  the dot a reference ends on
 */

const P = 10;

type Look = { fill: string; r: number; ring?: boolean };
const looks: Record<string, Look> = {
  o: { fill: "var(--dot)", r: P * 0.28 },
  m: { fill: "var(--meta)", r: P * 0.28 },
  h: { fill: "var(--hot)", r: P * 0.31 },
  l: { fill: "var(--live)", r: P * 0.28 },
  x: { fill: "var(--dead)", r: P * 0.28, ring: true },
  r: { fill: "var(--ref)", r: P * 0.17 },
  R: { fill: "var(--ref)", r: P * 0.27 },
};

export function DotArt({ rows, label }: { rows: string[]; label: string }) {
  const w = Math.max(...rows.map((r) => r.length));
  const grid: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];
  rows.forEach((row, y) =>
    [...row.padEnd(w, ".")].forEach((ch, x) => {
      const cx = x * P + P / 2;
      const cy = y * P + P / 2;
      const look = looks[ch];
      if (!look) {
        grid.push(<circle key={`${x},${y}`} cx={cx} cy={cy} r={P * 0.09} fill="var(--grid)" data-grid="" />);
        return;
      }
      // when lit, the colour sweeps in left to right, top to bottom
      const style = { "--d": `${x * 32 + y * 18}ms` } as React.CSSProperties;
      lit.push(
        look.ring ? (
          <circle key={`${x},${y}`} cx={cx} cy={cy} r={look.r} fill={look.fill} fillOpacity={0.22} stroke={look.fill} strokeWidth={P * 0.09} data-ring="" style={style} />
        ) : (
          <circle key={`${x},${y}`} cx={cx} cy={cy} r={look.r} fill={look.fill} style={style} />
        ),
      );
    }),
  );
  return (
    <svg viewBox={`0 0 ${w * P} ${rows.length * P}`} role="img" aria-label={label}>
      <g>{grid}</g>
      <g className={s.artLit}>{lit}</g>
    </svg>
  );
}

/** the dark theme glow for lit dots, defined once on the page */
export function DotGlow() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="jle-dot-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
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
    </svg>
  );
}
