"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";
import { openSearch } from "./Search";
import { site } from "@/lib/site";

const nav = [
  { href: "/learn", label: "learn" },
  { href: "/play", label: "play" },
  { href: "/glossary", label: "glossary" },
];

const iconBtn =
  "grid size-10 shrink-0 place-items-center rounded-md text-ink transition-colors duration-150 hover:bg-well-2 hover:text-hi";

function GitHub({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** the site bar. on phones learn, play and glossary live behind the dot-grid menu at the right. */
export function Bar() {
  const path = usePathname();
  const inBook = /^\/learn\/[^/]+/.test(path);
  const isOn = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 h-[var(--bar-h)] border-b border-line bg-bg/90 backdrop-blur-[14px]">
      <div className="flex h-full items-center justify-between gap-2 pr-2 pl-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          {inBook && (
            <button
              onClick={() => window.dispatchEvent(new Event("jle-menu"))}
              className={`${iconBtn} -ml-2.5 lg:hidden`}
              aria-label="open the contents"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M3 6h14M3 10h14M3 14h9" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <Link href="/" className="flex min-h-10 min-w-0 items-center rounded-xs" aria-label="java.lang.everything, home">
            <Wordmark size={19} className="max-[379px]:!hidden" />
            <Wordmark size={19} bare className="min-[380px]:!hidden" />
          </Link>
          <a
            href={site.author.url}
            target="_blank"
            rel="noreferrer"
            className="hidden text-[0.97rem] text-mute italic transition-colors duration-150 hover:text-hi lg:inline"
          >
            by {site.author.short}
          </a>
        </div>

        <nav className="flex shrink-0 items-center gap-1" aria-label="main">
          <div className="hidden items-center gap-0.5 md:flex">
            {nav.map((n) => {
              const on = isOn(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-10 items-center rounded-sm px-2.5 font-ui text-[0.90625rem] transition-colors duration-150 hover:bg-well-2 ${
                    on
                      ? "text-hi underline decoration-book decoration-1 underline-offset-[0.3em]"
                      : "text-ink hover:text-hi"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
          <button
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center gap-2.5 rounded-md text-mute transition-[color,box-shadow,background-color] duration-150 ease-sfe hover:text-hi max-sm:hover:bg-well-2 sm:ml-2 sm:h-9 sm:w-auto sm:justify-start sm:pr-2 sm:pl-3 sm:shadow-[inset_0_0_0_1px_var(--line-2)] sm:hover:shadow-[inset_0_0_0_1px_var(--edge)]"
            aria-label="search the book (command k)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
            <span className="hidden font-ui text-14 sm:inline">search</span>
            <span className="kbd hidden sm:inline-flex">⌘K</span>
          </button>
          <span className="hidden sm:contents">
            <ThemeToggle />
          </span>
          <a href={site.repo} className={`${iconBtn} hidden md:grid`} aria-label="source on github" target="_blank" rel="noreferrer">
            <GitHub />
          </a>
          <SiteMenu isOn={isOn} />
        </nav>
      </div>
    </header>
  );
}

/** phones: one button at the right that opens learn, play, glossary, the theme and the source. */
function SiteMenu({ isOn }: { isOn: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative md:hidden">
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        className={`${iconBtn} ${open ? "bg-well-2 text-hi" : ""}`}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label="menu"
      >
        {/* the dot grid every mark is drawn on */}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
          {[3.5, 8, 12.5].flatMap((y) => [3.5, 8, 12.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" />))}
        </svg>
      </button>
      {open && (
        <div
          id="site-menu"
          className="absolute top-[calc(100%+8px)] right-0 w-[min(15rem,calc(100vw-24px))] rounded-lg bg-bg p-1.5 font-ui shadow-[var(--overlay)]"
        >
          <ul>
            {nav.map((n) => {
              const on = isOn(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.96875rem] transition-colors duration-150 hover:bg-well-2 ${
                      on ? "bg-well-2 text-hi" : "text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-[6px] rounded-full"
                      style={on ? { background: "var(--book)" } : { boxShadow: "inset 0 0 0 1px var(--edge)" }}
                    />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-1.5 flex items-center justify-between border-t border-line px-1 pt-1.5">
            <ThemeToggle withLabel />
            <a href={site.repo} className={iconBtn} aria-label="source on github" target="_blank" rel="noreferrer">
              <GitHub />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
