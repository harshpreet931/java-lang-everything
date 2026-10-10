"use client";

import { Heads, useWidth } from "./kit";

// G1's remembered sets: each region remembers which cards elsewhere point into it,
// so collecting that region means scanning those few cards, not the whole heap.

export function RemSet() {
  const [ref, w] = useWidth();
  const W = Math.max(300, w);
  const H = 214;
  const bw = W * 0.29;
  const gap = (W - bw * 3) / 2;
  const xs = [0, bw + gap, 2 * (bw + gap)];
  const y = 46;
  const bh = 58;
  const cw = (bw - 12) / 8;
  const card = (box: number, c: number) => xs[box] + 6 + c * cw;
  const eTarget = { x: xs[2] + bw * 0.62, y: y + 30 };
  const rsY = y + bh + 26;
  const rsX = W - 152;

  return (
    <div ref={ref} className="min-w-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="two old regions each have one card pointing into an eden region; the eden region's remembered set lists those two cards">
        <Heads id="rs" tones={["ref", "meta"]} />
        {["old region 7", "old region 19", "eden region 31"].map((label, b) => (
          <g key={label}>
            <text x={xs[b]} y={y + bh + 14} fontSize={10} fill="var(--faint)">
              {label}
            </text>
            <rect x={xs[b]} y={y} width={bw} height={bh} rx={5} fill="var(--well-2)" stroke="var(--line-2)" />
            {Array.from({ length: 8 }, (_, c) => {
              const dirty = (b === 0 && c === 5) || (b === 1 && c === 2);
              return (
                <rect
                  key={c}
                  x={card(b, c) + 1}
                  y={y + bh - 16}
                  width={cw - 2}
                  height={10}
                  rx={1.5}
                  fill={dirty ? "color-mix(in srgb, var(--meta) 30%, var(--bg))" : "var(--bg)"}
                  stroke={dirty ? "var(--meta)" : "var(--line)"}
                />
              );
            })}
            <text x={xs[b] + 6} y={y + 18} fontSize={9} fill="var(--faint)">
              {b < 2 ? "cards" : ""}
            </text>
          </g>
        ))}
        {/* the young object being pointed at */}
        <rect x={eTarget.x - 14} y={y + 10} width={28} height={18} rx={3} fill="color-mix(in srgb, var(--live) 14%, var(--bg))" stroke="var(--live)" />
        <text x={eTarget.x} y={y + 23} textAnchor="middle" fontSize={10} fill="var(--live)">
          obj
        </text>
        {/* references from inside the old regions' cards */}
        {[
          { b: 0, c: 5 },
          { b: 1, c: 2 },
        ].map(({ b, c }, i) => {
          const sx = card(b, c) + cw / 2;
          const sy = y + bh - 16;
          const tx = eTarget.x - 6 + i * 12;
          const ty = y + 10;
          const lift = 30 + i * 12;
          return (
            <path
              key={i}
              d={`M ${sx} ${sy} C ${sx} ${y - lift}, ${tx} ${y - lift}, ${tx} ${ty - 2}`}
              fill="none"
              stroke="var(--ref)"
              strokeWidth={1.3}
              markerEnd="url(#rs-ref)"
            />
          );
        })}
        {/* the remembered set of the eden region */}
        <path d={`M ${xs[2] + bw - 10} ${y + bh} L ${xs[2] + bw - 10} ${rsY - 2}`} stroke="var(--meta)" strokeWidth={1.2} strokeDasharray="3 2" />
        <rect x={rsX} y={rsY} width={150} height={58} rx={5} fill="color-mix(in srgb, var(--meta) 8%, var(--bg))" stroke="var(--meta)" />
        <text x={rsX + 8} y={rsY + 16} fontSize={10} fill="var(--meta)">
          remembered set of 31
        </text>
        <text x={rsX + 8} y={rsY + 32} fontSize={10} fill="var(--ink)">
          region 7, card 5
        </text>
        <text x={rsX + 8} y={rsY + 47} fontSize={10} fill="var(--ink)">
          region 19, card 2
        </text>
        <text x={0} y={rsY + 24} fontSize={10} fill="var(--faint)">
          <tspan x={0}>collecting region 31?</tspan>
          <tspan x={0} dy={15}>scan 2 cards, not 2 regions.</tspan>
        </text>
      </svg>
    </div>
  );
}
