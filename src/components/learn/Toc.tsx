"use client";

import { useEffect, useState } from "react";

type Entry = { depth: 2 | 3; id: string; text: string };

/** "on this page", with scroll-spy and how far down you are. the lit dot is where you are. */
export function Toc({ toc }: { toc: Entry[] }) {
  const [active, setActive] = useState<string | null>(toc[0]?.id ?? null);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const heads = toc
      .map((t) => document.getElementById(t.id))
      .filter((x): x is HTMLElement => !!x);
    if (!heads.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY + window.innerHeight * 0.3;
      let cur = heads[0].id;
      for (const h of heads) if (h.offsetTop <= y) cur = h.id;
      setActive(cur);
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [toc]);

  if (!toc.length) return null;

  return (
    <nav aria-label="on this page" className="font-ui text-[0.84375rem]">
      <div className="mb-2 flex items-baseline justify-between border-b border-line pb-2.5 text-13 text-mute">
        <span>on this page</span>
        <span className="text-12 text-faint tabular" aria-label={`${pct} percent read`}>
          {pct}%
        </span>
      </div>
      <ol>
        {toc.map((t) => {
          const on = active === t.id;
          return (
            <li key={t.id} className={t.depth === 3 ? "pl-4" : ""}>
              <a
                href={`#${t.id}`}
                aria-current={on ? "true" : undefined}
                className={`flex min-h-10 items-center gap-2.5 py-1 leading-[1.3] transition-colors duration-150 ${
                  on ? "text-hi" : "text-mute hover:text-hi"
                }`}
              >
                <span
                  aria-hidden
                  className="size-[5px] shrink-0 rounded-full"
                  style={on ? { background: "var(--book)" } : { boxShadow: "inset 0 0 0 1px var(--edge)" }}
                />
                {t.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
