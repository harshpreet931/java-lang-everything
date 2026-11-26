import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { parts, totalChapters } from "@/content/curriculum";
import { availableHrefs } from "@/lib/content";
import { Footer } from "@/components/site/Footer";
import { ContentsProgress } from "@/components/learn/ContentsProgress";
import { JsonLd } from "@/components/seo/JsonLd";
import { courseJsonLd } from "@/lib/seo";
import { Cover } from "@/components/learn/covers/Cover";
import { covers } from "@/components/learn/covers/spec";
import cs from "@/components/learn/covers/covers.module.css";
import s from "@/components/learn/covers/pages.module.css";

export const metadata: Metadata = {
  title: "learn java: the full contents",
  description: `a free, visual java course: all ${totalChapters} chapters in reading order, from variables and objects to concurrency, the JVM and garbage collection.`,
  alternates: { canonical: "/learn" },
  openGraph: { url: "/learn" },
};

// the first visit to /learn shelves the covers in; after that they are simply there.
// runs before the shelf paints, so no cover ever waits on js to be visible.
const shelveOnce = `(function(){try{var k='jle-shelved';if(localStorage.getItem(k))return;localStorage.setItem(k,'1');var d=document.documentElement;d.setAttribute('data-shelve','');setTimeout(function(){d.removeAttribute('data-shelve')},1200)}catch(e){}})();`;

export default function Contents() {
  const ready = new Set(availableHrefs());
  return (
    <>
      <main id="main" className={`${s.page} px-[var(--gutter)] pt-14`}>
        <JsonLd data={courseJsonLd(parts, ready)} />
        <div className="mx-auto max-w-[1180px]">
          <header className={s.head}>
            <h1 className={s.h1}>the contents</h1>
            <div>
              <p className={s.lede}>
                {parts.length} parts, {totalChapters} chapters, in the order they build on each other. the covers get
                darker as the book goes further down.
              </p>
              <ContentsProgress />
            </div>
          </header>

          <script dangerouslySetInnerHTML={{ __html: shelveOnce }} />
          <ol className={s.shelf}>
            {covers.map((spec, i) => {
              const p = parts[i];
              return (
                <li key={spec.slug} style={{ "--i": i } as CSSProperties}>
                  <Link href={`/learn/${spec.slug}`} className={`${s.vol} ${cs.host}`}>
                    <Cover spec={spec} as="h2" hrefs={p.chapters.map((c) => `/learn/${p.slug}/${c.slug}`)} />
                    <p className={s.blurb}>{spec.blurb}</p>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </main>
      <Footer />
    </>
  );
}
