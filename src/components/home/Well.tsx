"use client";

import { useEffect, useRef, useState } from "react";

/**
 * the opener: a wireframe well you look down into. rings sink slowly and
 * shrink toward the bottom, forever. java, all the way down.
 * pure svg, recomputed per frame; static when reduced motion is on.
 */

const W = 420;
const H = 290;
const CX = W / 2;
const RINGS = 13;
const MERIDIANS = 28;
const R0 = 196; // top radius
const TOP = 70;
const DEPTH = 178;

type Ring = { cy: number; rx: number; ry: number; a: number };

function rings(phase: number): Ring[] {
  const out: Ring[] = [];
  for (let i = 0; i < RINGS; i++) {
    const t = (i + phase) / RINGS; // 0 at the lip, 1 at the bottom
    const ease = 1 - Math.pow(1 - t, 2.2);
    const rx = R0 * Math.pow(1 - t, 1.35) + 6;
    out.push({
      cy: TOP + DEPTH * ease,
      rx,
      ry: rx * 0.3,
      // fade in at the lip, fade out deep down
      a: Math.min(1, t * 6) * (1 - Math.pow(t, 3) * 0.85),
    });
  }
  return out;
}

function ellipse({ cy, rx, ry }: Ring) {
  return `M ${CX - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
}

function meridian(rs: Ring[], theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return rs.map((r, i) => `${i ? "L" : "M"} ${(CX + r.rx * c).toFixed(1)} ${(r.cy + r.ry * s).toFixed(1)}`).join(" ");
}

export function Well({ className }: { className?: string }) {
  const [phase, setPhase] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    let p = 0;
    const tick = (now: number) => {
      p = (p + (now - last) / 5200) % 1;
      last = now;
      setPhase(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // the lip ring stays put so the opening reads as a fixed edge
  const lip: Ring = { cy: TOP, rx: R0 + 6, ry: (R0 + 6) * 0.3, a: 1 };
  const rs = [lip, ...rings(phase)];
  // meridians use the static ring geometry, so the walls don't swim
  const walls = [lip, ...rings(0), { cy: TOP + DEPTH, rx: 6, ry: 1.8, a: 1 }];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="a wireframe well, rings sinking into it"
      fill="none"
      stroke="var(--ref)"
      strokeWidth={0.8}
    >
      {Array.from({ length: MERIDIANS }, (_, k) => {
        const theta = (k / MERIDIANS) * Math.PI * 2;
        const front = Math.sin(theta) > 0;
        return <path key={k} d={meridian(walls, theta)} opacity={front ? 0.55 : 0.18} />;
      })}
      {rs.map((r, i) => (
        <path key={i} d={ellipse(r)} opacity={i === 0 ? 0.9 : r.a * 0.8} strokeWidth={i === 0 ? 1.1 : 0.8} />
      ))}
    </svg>
  );
}
