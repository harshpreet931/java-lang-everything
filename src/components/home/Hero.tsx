"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { flat, totalChapters } from "@/content/curriculum";
import { readLast } from "@/lib/progress";
import { HeapField } from "./HeapField";
import s from "./home.module.css";

/** the title page: the title on flat paper, the heap lit up beside it. */
export function Hero() {
  const [last, setLast] = useState<(typeof flat)[number] | null>(null);
  useEffect(() => {
    const href = readLast();
    setLast(flat.find((c) => c.href === href) ?? null);
  }, []);

  return (
    <section className={s.hero} aria-labelledby="home-title">
      <div>
        <h1 id="home-title" className={s.title}>
          java, all the way down
        </h1>
        <p className={s.byline}>
          a visual guide to java, by{" "}
          <a href="https://harshpreet.com" className="link" target="_blank" rel="noreferrer">
            harshpreet
          </a>
        </p>
        <p className={s.lede}>
          an open-source book that draws java instead of describing it. {totalChapters} chapters, from{" "}
          <code className="inline-code">int x = 5</code> to the garbage collector. every figure moves, every snippet
          runs, every number was measured. free, forever.
        </p>
        <div className={s.acts}>
          <Link href="/learn/start/what-is-java" className={`${s.btn} ${s.solid}`}>
            start at the top
          </Link>
          <Link href="/learn" className={s.btn}>
            open the contents
          </Link>
        </div>
        <p className={s.cont}>
          {last ? (
            <Link href={last.href} className="link">
              continue: {last.title}
            </Link>
          ) : (
            <span>or scroll, and follow one line of java all the way down.</span>
          )}
        </p>
      </div>
      <HeapField />
    </section>
  );
}
