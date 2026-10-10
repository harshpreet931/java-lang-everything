"use client";

import { useEffect, useRef, useState } from "react";

// bars for measured numbers. same data shape as the shared <Bars>, but each row puts the
// label and the value on one line and the bar underneath, so long labels never squeeze the
// bar to nothing on a phone. an optional `err` prints the ± from JMH.

type Tone = "ref" | "live" | "dead" | "meta" | "hot";

export function Bench({
  data,
  unit = "",
  log,
  digits = 3,
}: {
  data: { label: string; value: number; tone?: Tone; err?: number; note?: string }[];
  unit?: string;
  log?: boolean;
  digits?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const top = Math.max(...data.map((d) => d.value));
  const scale = (v: number) => (log ? Math.log10(v + 1) / Math.log10(top + 1) : v / top);
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: digits });

  return (
    <div ref={ref} className="flex flex-col gap-3 text-12">
      {data.map((d) => (
        <div key={d.label} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-ink">
              {d.label}
              {d.note && <span className="text-faint"> {d.note}</span>}
            </span>
            <span className="shrink-0 text-mute tabular">
              {fmt(d.value)}
              {d.err !== undefined && <span className="text-faint"> ±{fmt(d.err)}</span>}
              {unit && <span className="text-faint"> {unit}</span>}
            </span>
          </div>
          <div className="mt-1 h-[10px] rounded-[2px] bg-well-2">
            <div
              className="h-full rounded-[2px] transition-[width] duration-700 ease-jle"
              style={{
                width: shown ? `${Math.max(0.6, scale(d.value) * 100)}%` : "0%",
                background: d.tone ? `var(--${d.tone})` : "var(--ink)",
              }}
            />
          </div>
        </div>
      ))}
      {log && <span className="text-11 text-faint">log scale</span>}
    </div>
  );
}
