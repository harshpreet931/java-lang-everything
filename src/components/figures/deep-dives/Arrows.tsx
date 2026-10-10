"use client";

import { useId, useLayoutEffect, useState, type RefObject } from "react";
import type { Tone } from "./kit";

// reference arrows between html boxes, measured from the dom (same idea as the
// MemoryStepper's arrows). mark sources with data-a="name" and targets with data-a too,
// then list the edges. dashed = a weak reference. re-measures on resize.

export type Edge = { from: string; to: string; dashed?: boolean; tone?: Tone; fade?: boolean };
type Path = { key: string; d: string; dashed?: boolean; tone: Tone; fade?: boolean };

export function useArrowPaths(root: RefObject<HTMLElement | null>, edges: Edge[], dep: unknown) {
  const [paths, setPaths] = useState<Path[]>([]);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const rb = el.getBoundingClientRect();
      const out: Path[] = [];
      for (const e of edges) {
        const a = el.querySelector<HTMLElement>(`[data-a="${e.from}"]`);
        const b = el.querySelector<HTMLElement>(`[data-a="${e.to}"]`);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rbb = b.getBoundingClientRect();
        const fx = ra.left + ra.width / 2 - rb.left;
        const fy = ra.top + ra.height / 2 - rb.top;
        let d: string;
        if (rbb.left - rb.left > fx + 12) {
          // target to the right: enter its left edge
          const tx = rbb.left - rb.left - 2;
          const ty = rbb.top + Math.min(14, rbb.height / 2) - rb.top;
          const dx = Math.max(20, (tx - fx) * 0.5);
          d = `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        } else if (rbb.right - rb.left < fx - 12) {
          // target to the left: enter its right edge
          const tx = rbb.right - rb.left + 2;
          const ty = rbb.top + Math.min(14, rbb.height / 2) - rb.top;
          const dx = Math.max(20, (fx - tx) * 0.5);
          d = `M ${fx} ${fy} C ${fx - dx} ${fy}, ${tx + dx} ${ty}, ${tx} ${ty}`;
        } else if (rbb.top - rb.top > fy + 8) {
          // target below: enter its top edge
          const tx = Math.min(Math.max(fx, rbb.left - rb.left + 14), rbb.right - rb.left - 14);
          const ty = rbb.top - rb.top - 2;
          const dy = Math.max(16, (ty - fy) * 0.5);
          d = `M ${fx} ${fy} C ${fx} ${fy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`;
        } else {
          // anything else: loop out to the right and come back into the right edge
          const tx = rbb.right - rb.left + 2;
          const ty = rbb.top + Math.min(14, rbb.height / 2) - rb.top;
          const out2 = Math.max(tx, fx) + 30;
          d = `M ${fx} ${fy} C ${out2} ${fy}, ${out2} ${ty}, ${tx} ${ty}`;
        }
        out.push({ key: `${e.from}->${e.to}`, d, dashed: e.dashed, tone: e.tone ?? "ref", fade: e.fade });
      }
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return paths;
}

export function ArrowLayer({ paths }: { paths: Path[] }) {
  const id = useId().replace(/:/g, "");
  const tones = Array.from(new Set(paths.map((p) => p.tone)));
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        {tones.map((t) => (
          <marker key={t} id={`ah-${id}-${t}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill={`var(--${t})`} />
          </marker>
        ))}
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={`var(--${p.tone})`}
          strokeWidth={1.25}
          strokeDasharray={p.dashed ? "4 3" : undefined}
          opacity={p.fade ? 0.35 : 1}
          markerEnd={`url(#ah-${id}-${p.tone})`}
          className="arrow-in"
        />
      ))}
    </svg>
  );
}
