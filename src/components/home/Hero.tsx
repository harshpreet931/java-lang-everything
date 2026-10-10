"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { flat, totalChapters } from "@/content/curriculum";
import { readLast } from "@/lib/progress";
import { Well } from "./Well";

/** the opener. a book's title page: illustration, title, byline, a short lede. */
export function Hero() {
  const [last, setLast] = useState<(typeof flat)[number] | null>(null);
  useEffect(() => {
    const href = readLast();
    setLast(flat.find((c) => c.href === href) ?? null);
  }, []);

  return (
    <section className="px-[var(--gutter)] pt-[clamp(48px,8vw,96px)] pb-10 text-center">
      <Well className="mx-auto w-full max-w-[380px]" />
      <span className="ornament mt-12" aria-hidden />
      <h1 className="mt-8 font-display text-[clamp(2.6rem,1.6rem+3.6vw,4.4rem)] leading-[1.02] font-light tracking-[0.01em] text-hi">
        java, all the way down
      </h1>
      <p className="mt-5 text-17 text-mute italic">
        a visual guide to java, by{" "}
        <a href="https://harshpreet.com" className="link not-italic" target="_blank" rel="noreferrer">
          harshpreet
        </a>{" "}
        <span className="not-italic text-faint">·</span>{" "}
        <a href="https://harshpreet.com" className="link not-italic" target="_blank" rel="noreferrer">
          harshpreet.com
        </a>
      </p>
      <span className="ornament mt-10" aria-hidden />
      <p className="mx-auto mt-10 max-w-[34rem] text-[1.22rem] leading-[1.75] text-ink">
        an open-source book that draws java instead of describing it. {totalChapters} chapters, from{" "}
        <code className="inline-code">int x = 5</code> to the garbage collector. every figure moves, every snippet runs,
        every number was measured. free, forever.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
        <Link href="/learn/start/what-is-java" className="act solid !min-h-11 !px-5 !text-13">
          start at the top
        </Link>
        <Link href="/learn" className="act !min-h-11 !px-5 !text-13">
          open the contents
        </Link>
      </div>
      <div className="mt-6 min-h-6 text-15 text-mute italic">
        {last ? (
          <Link href={last.href} className="link not-italic">
            continue: {last.title}
          </Link>
        ) : (
          <span>or scroll, and follow one line of java all the way down.</span>
        )}
      </div>
    </section>
  );
}
