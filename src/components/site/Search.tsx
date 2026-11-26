"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flat, pad2, parts } from "@/content/curriculum";
import { glossary } from "@/content/glossary";
import { track } from "@/lib/analytics";
import { Arrow } from "./Arrow";

// ⌘K. chapters + glossary are searched instantly in memory. full text comes
// from pagefind, which only exists after `pnpm build` (it indexes the html).

type Hit = {
  href: string;
  title: string;
  sub: string;
  kind: "chapter" | "term" | "text";
  excerpt?: string;
};

export function openSearch() {
  window.dispatchEvent(new Event("jle-search"));
}

type PagefindResult = {
  data: () => Promise<{
    url: string;
    meta: { title?: string };
    excerpt: string;
    sub_results?: { url: string; title: string; excerpt: string }[];
  }>;
};
type Pagefind = {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
  options?: (o: object) => Promise<void>;
};

let pagefind: Pagefind | null | undefined;
async function loadPagefind(): Promise<Pagefind | null> {
  if (pagefind !== undefined) return pagefind;
  try {
    // keep the bundler away from this import, the file only exists in the built site
    const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<Pagefind>;
    pagefind = await dynamicImport("/_pagefind/pagefind.js");
    await pagefind.options?.({ excerptLength: 16 });
  } catch {
    pagefind = null;
  }
  return pagefind;
}

const clean = (url: string) => url.replace(/\.html(?=$|#)/, "").replace(/\/index$/, "/");

function score(q: string, ...fields: string[]) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s = 0;
  for (const t of terms) {
    let best = 0;
    fields.forEach((f, i) => {
      const at = f.toLowerCase().indexOf(t);
      if (at >= 0) best = Math.max(best, (fields.length - i) * 10 + (at === 0 ? 5 : 0));
    });
    if (!best) return 0;
    s += best;
  }
  return s;
}

export function Search() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [text, setText] = useState<Hit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setText([]);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, [contenteditable=true], .cm-editor");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("jle-search", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("jle-search", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      input.current?.focus();
      void loadPagefind();
      document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
  }, [open]);

  const local = useMemo<Hit[]>(() => {
    if (!q.trim()) {
      return parts.map((p) => ({
        href: `/learn/${p.slug}`,
        title: `${pad2(p.n)}  ${p.title}`,
        sub: p.blurb,
        kind: "chapter" as const,
      }));
    }
    const chapters = flat
      .map((c) => ({ c, s: score(q, c.title, c.address, c.blurb, c.part.title) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(({ c }) => ({
        href: c.href,
        title: c.title,
        sub: `${pad2(c.part.n)}.${pad2(c.part.chapters.findIndex((x) => x.slug === c.slug) + 1)}  ${c.blurb}`,
        kind: "chapter" as const,
      }));
    const terms = glossary
      .map((t) => ({ t, s: score(q, t.term, t.short) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map(({ t }) => ({
        href: `/glossary#${t.id}`,
        title: t.term,
        sub: t.short,
        kind: "term" as const,
      }));
    return [...chapters, ...terms];
  }, [q]);

  // full text, debounced
  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const pf = await loadPagefind();
      if (!pf || cancelled) return;
      const res = await pf.search(q);
      const data = await Promise.all(res.results.slice(0, 6).map((r) => r.data()));
      if (cancelled) return;
      const hits: Hit[] = data.flatMap((d) => {
        const sub = d.sub_results?.[0];
        return [
          {
            href: clean(sub?.url ?? d.url),
            title: sub?.title && sub.title !== d.meta.title ? `${d.meta.title} · ${sub.title}` : (d.meta.title ?? d.url),
            sub: "",
            excerpt: sub?.excerpt ?? d.excerpt,
            kind: "text" as const,
          },
        ];
      });
      setText(hits);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const hits = useMemo(() => {
    const seen = new Set(local.map((h) => h.href));
    return [...local, ...text.filter((h) => !seen.has(h.href))];
  }, [local, text]);

  useEffect(() => setActive(0), [q]);

  // what people look for (and don't find): one event per settled query
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) return;
    const t = setTimeout(() => track("search", { q: s, results: hits.length }), 1200);
    return () => clearTimeout(t);
  }, [q, hits.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    close();
    router.push(h.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[var(--scrim)] px-3 pt-[12vh] max-sm:pt-3"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="search"
    >
      <div className="w-full max-w-[640px] overflow-hidden rounded-lg bg-bg font-ui shadow-[var(--overlay)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg className="shrink-0 text-mute" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter") go(hits[active]);
            }}
            placeholder="hashmap, volatile, records…"
            className="h-14 w-full bg-transparent font-body text-[1.125rem] text-hi outline-none placeholder:text-faint"
            spellCheck={false}
            autoComplete="off"
            aria-controls="search-results"
            aria-label="search the book"
          />
          <kbd>esc</kbd>
        </div>
        <ul ref={list} id="search-results" className="max-h-[60vh] overflow-y-auto py-1.5" role="listbox">
          {hits.length === 0 && (
            <li className="px-4 py-6 text-14 text-mute">nothing matches that. try a broader word.</li>
          )}
          {hits.map((h, i) => (
            <li key={h.href + i} data-i={i} role="option" aria-selected={i === active}>
              <button
                onMouseMove={() => setActive(i)}
                onClick={() => go(h)}
                className={`grid min-h-11 w-full grid-cols-[3.25rem_1fr] gap-x-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                  i === active ? "bg-well-2 text-hi" : "text-ink"
                }`}
              >
                <span className={`flex items-center gap-2 text-12 leading-6 ${i === active ? "text-hi" : "text-faint"}`}>
                  <span
                    aria-hidden
                    className="size-[6px] shrink-0 rounded-full"
                    style={i === active ? { background: "var(--book)" } : { boxShadow: "inset 0 0 0 1px var(--edge)" }}
                  />
                  {h.kind === "chapter" ? "page" : h.kind === "term" ? "term" : "text"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-body text-[1.0625rem]">{h.title}</span>
                  {(h.sub || h.excerpt) && (
                    <span
                      className={`mt-0.5 block truncate text-14 text-mute [&_mark]:bg-transparent [&_mark]:text-current [&_mark]:underline`}
                      dangerouslySetInnerHTML={h.excerpt ? { __html: h.excerpt } : undefined}
                    >
                      {h.excerpt ? undefined : h.sub}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-12 text-faint">
          <span className="flex items-center gap-1">
            <kbd aria-label="up">
              <Arrow dir="up" />
            </kbd>
            <kbd aria-label="down">
              <Arrow dir="down" />
            </kbd>
            <span className="ml-1">move</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd aria-label="enter">
              <Arrow dir="enter" />
            </kbd>
            <span className="ml-1">open</span>
          </span>
          <span className="ml-auto max-sm:hidden">full text search works on the built site</span>
        </div>
      </div>
    </div>
  );
}
