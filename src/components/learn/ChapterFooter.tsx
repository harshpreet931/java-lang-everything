"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markDone, rememberLast, useProgress } from "@/lib/progress";
import { site } from "@/lib/site";
import { Arrow } from "@/components/site/Arrow";

type Neighbour = { href: string; title: string; num: string } | null;

/** mark-as-read + prev/next. reaching the bottom marks the chapter read. */
export function ChapterFooter({ href, prev, next }: { href: string; prev: Neighbour; next: Neighbour }) {
  const progress = useProgress();
  const done = !!progress[href];
  const sentinel = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    rememberLast(href);
  }, [href]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      // don't count a flick to the bottom as reading it
      if (e.isIntersecting) timer = setTimeout(() => markDone(href), 1500);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [href]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight" && next) router.push(next.href);
      if (e.key === "ArrowLeft" && prev) router.push(prev.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  return (
    <footer className="mx-auto mt-24 max-w-[var(--measure)] font-ui">
      <div ref={sentinel} className="flex items-center justify-between gap-4 border-t border-line pt-5 text-13">
        <button onClick={() => markDone(href, !done)} className="act" aria-pressed={done}>
          <span
            aria-hidden
            className="size-[7px] rounded-full"
            style={done ? { background: "var(--book)" } : { boxShadow: "inset 0 0 0 1.2px var(--edge)" }}
          />
          {done ? "read" : "mark as read"}
        </button>
        <span className="hidden items-center gap-1 text-faint sm:flex">
          <kbd>alt</kbd>
          <kbd aria-label="left">
            <Arrow dir="left" />
          </kbd>
          <kbd aria-label="right">
            <Arrow dir="right" />
          </kbd>
          <span className="ml-1">to turn the page</span>
        </span>
      </div>
      <p className="mt-8 font-body text-[1.0625rem] text-mute italic">
        written and drawn by{" "}
        <a href={site.author.url} className="link not-italic" target="_blank" rel="noreferrer">
          {site.author.short}
        </a>
        . spotted something wrong?{" "}
        <a href={`${site.repo}/issues`} className="link not-italic" target="_blank" rel="noreferrer">
          open an issue
        </a>
        . more at{" "}
        <a href={site.author.url} className="link not-italic" target="_blank" rel="noreferrer">
          {site.author.domain}
        </a>
        .
      </p>
      <nav aria-label="turn the page" className="mt-8 grid gap-3 sm:grid-cols-2">
        {[prev, next].map((n, i) =>
          n ? (
            <Link
              key={n.href}
              href={n.href}
              rel={i === 0 ? "prev" : "next"}
              className={`group flex min-h-[76px] flex-col justify-center gap-1 rounded-[10px] px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--line-2)] transition-[background-color,box-shadow] duration-150 hover:bg-well hover:shadow-[inset_0_0_0_1px_var(--edge)] ${
                i === 1 ? "sm:items-end sm:text-right" : ""
              }`}
            >
              <span className="flex items-center gap-1.5 text-12 text-faint tabular">
                {i === 0 && <Arrow dir="left" />}
                {i === 0 ? `previous, ${n.num}` : `next, ${n.num}`}
                {i === 1 && <Arrow dir="right" />}
              </span>
              <span className="font-body text-[1.0625rem] leading-[1.3] text-ink group-hover:text-hi">{n.title}</span>
            </Link>
          ) : (
            <div key={i} className="max-sm:hidden" />
          ),
        )}
      </nav>
    </footer>
  );
}
