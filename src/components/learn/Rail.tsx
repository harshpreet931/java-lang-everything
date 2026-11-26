"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parts, pad2 } from "@/content/curriculum";
import { useProgress } from "@/lib/progress";
import { PartSwatch } from "@/components/learn/covers/PartSwatch";

/** the file-tree sidebar. one part open at a time, lamps for progress. */
export function Rail({ available }: { available: string[] }) {
  const path = usePathname();
  const progress = useProgress();
  const ready = new Set(available);
  const current = parts.find((p) => path.startsWith(`/learn/${p.slug}`))?.slug;
  const [open, setOpen] = useState<Set<string>>(() => new Set(current ? [current] : []));
  const [drawer, setDrawer] = useState(false);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (current) setOpen((o) => (o.has(current) ? o : new Set([...o, current])));
    setDrawer(false);
  }, [path, current]);

  useEffect(() => {
    const on = () => setDrawer((d) => !d);
    window.addEventListener("jle-menu", on);
    return () => window.removeEventListener("jle-menu", on);
  }, []);

  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[aria-current=page]");
    el?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const toggle = (slug: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  return (
    <>
      {drawer && (
        <div className="fixed inset-0 z-30 bg-[var(--scrim)] lg:hidden" onClick={() => setDrawer(false)} aria-hidden />
      )}
      <nav
        ref={nav}
        aria-label="contents"
        className={`fixed top-[var(--bar-h)] bottom-0 left-0 z-30 w-[min(300px,86vw)] overflow-y-auto overscroll-contain border-r border-line bg-bg pt-3 pb-24 font-ui text-14 transition-transform duration-200 ease-sfe lg:sticky lg:z-0 lg:h-[calc(100dvh-var(--bar-h))] lg:w-[264px] lg:shrink-0 lg:translate-x-0 ${
          drawer ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href="/learn"
          className="mx-2 mb-1 flex min-h-10 items-center justify-between rounded-sm px-3 text-mute transition-colors duration-150 hover:bg-well-2 hover:text-hi"
        >
          <span>contents</span>
          <span className="text-12 text-faint tabular">{Object.keys(progress).length} read</span>
        </Link>
        <ol className="border-t border-line">
          {parts.map((p) => {
            const isOpen = open.has(p.slug);
            const here = current === p.slug;
            const done = p.chapters.filter((c) => progress[`/learn/${p.slug}/${c.slug}`]).length;
            return (
              <li key={p.slug} className="border-b border-line">
                <button
                  onClick={() => toggle(p.slug)}
                  aria-expanded={isOpen}
                  className={`grid min-h-11 w-full grid-cols-[30px_1fr_auto] items-baseline gap-x-1 py-2.5 pr-4 pl-[18px] text-left leading-[1.3] transition-colors duration-150 ${
                    here || isOpen ? "font-medium text-hi" : "text-ink hover:text-hi"
                  }`}
                >
                  <span className="text-12 font-normal text-faint tabular">{pad2(p.n)}</span>
                  <span className="flex items-baseline gap-2.5">
                    <PartSwatch part={p.slug} size={14} className="shrink-0 self-center" />
                    <span>{p.title}</span>
                  </span>
                  <span className="text-12 font-normal text-faint tabular">
                    {done > 0 ? `${done}/` : ""}
                    {p.chapters.length}
                  </span>
                </button>
                {isOpen && (
                  <ol className="pb-2.5">
                    {p.chapters.map((c, i) => {
                      const href = `/learn/${p.slug}/${c.slug}`;
                      const here = path === href;
                      const has = ready.has(href);
                      const read = !!progress[href];
                      return (
                        <li key={c.slug}>
                          <Link
                            href={href}
                            aria-current={here ? "page" : undefined}
                            className={`mx-2 grid min-h-10 grid-cols-[30px_1fr_10px] items-center gap-x-1 rounded-sm py-1.5 pr-3.5 pl-2.5 leading-[1.3] transition-colors duration-120 hover:bg-well-2 ${
                              here ? "bg-well-2 text-hi" : "text-ink hover:text-hi"
                            }`}
                          >
                            <span className="text-12 text-faint tabular">{pad2(i + 1)}</span>
                            <span className={has || here ? "" : "text-mute"}>
                              {c.title}
                              {!has && !here && <span className="sr-only"> (soon)</span>}
                            </span>
                            <Lamp state={here ? "here" : !has ? "soon" : read ? "read" : "unread"} />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/** progress lamps: an unlit ring, a small filled dot once read, the book colour where you are,
 *  and a faint dash for chapters not written yet */
function Lamp({ state }: { state: "here" | "read" | "unread" | "soon" }) {
  if (state === "soon")
    return <span aria-hidden className="h-px w-[6px] justify-self-center bg-line-2" title="soon" />;
  return (
    <span
      {...(state === "read" ? { role: "img", "aria-label": "read" } : { "aria-hidden": true })}
      className={`justify-self-center rounded-full ${state === "read" ? "size-[5px] bg-faint" : "size-[6px]"}`}
      style={
        state === "here"
          ? { background: "var(--book)", boxShadow: "0 0 0 3px color-mix(in oklab, var(--book) 22%, transparent)" }
          : state === "unread"
            ? { boxShadow: "inset 0 0 0 1px var(--edge)" }
            : undefined
      }
    />
  );
}
