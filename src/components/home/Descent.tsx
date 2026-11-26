"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { DotArt, DotGlow } from "./DotArt";
import { layers } from "./layers";
import s from "./home.module.css";

/**
 * one line of java, followed all the way down. a quiet list: each depth has a small dot
 * drawing, a few lines of story and the real artifact. the drawings light up once as the
 * reader scrolls past them. colour only: nothing here moves.
 */
export function Descent() {
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    // anything below the fold is put back to unlit (it is offscreen, so nobody sees the switch),
    // then lit the first time it comes into view. anything already seen stays lit.
    const below = items.current.filter((el): el is HTMLLIElement => !!el && el.getBoundingClientRect().top > window.innerHeight);
    if (!below.length) return;
    for (const el of below) el.dataset.armed = "";
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          delete el.dataset.armed;
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.descent} aria-labelledby="descent-title">
      <DotGlow />
      <header className={s.head}>
        <h2 id="descent-title" className={s.h2}>
          one line of java, all the way down
        </h2>
        <p className={s.sub}>
          what actually happens when you run <code className="inline-code not-italic">IO.println(&quot;hello&quot;)</code>.
          every artifact below is real jdk 25 output, unless its label says otherwise.
        </p>
      </header>

      <ol className={s.layers}>
        {layers.map((l, i) => (
          <li
            key={l.id}
            ref={(el) => {
              items.current[i] = el;
            }}
            className={s.layer}
          >
            <div className={s.art}>
              <DotArt rows={l.art} label={l.artLabel} />
            </div>
            <div>
              <div className={s.depth}>
                depth {i} of {layers.length - 1}
              </div>
              <h3 className={s.h3}>{l.title}</h3>
              <p className={s.text}>{l.text}</p>
              <Link href={l.href} className={`link ${s.read}`}>
                read: {l.linkLabel}
              </Link>
            </div>
            <div className={s.panel}>{l.stage}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
