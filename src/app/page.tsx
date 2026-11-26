import type { Metadata } from "next";
import Link from "next/link";
import { Descent } from "@/components/home/Descent";
import { Hero } from "@/components/home/Hero";
import { Wall } from "@/components/home/Wall";
import s from "@/components/home/home.module.css";
import { Footer } from "@/components/site/Footer";
import { availableHrefs } from "@/lib/content";
import { totalChapters, parts } from "@/content/curriculum";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const rules: [string, React.ReactNode][] = [
  ["figures", "they move. step through them, drag them, break them."],
  ["code", "real. every snippet runs on jdk 25, most of them right here in your browser."],
  ["numbers", "measured, and we say on what machine."],
  ["depth", "from your first variable to the JIT and the garbage collector, in one voice."],
  ["price", "free. MIT licensed. no account, no ads, no tracking."],
];

function SectionHead({ id, title, sub }: { id: string; title: string; sub: React.ReactNode }) {
  return (
    <header className={s.head}>
      <h2 id={id} className={s.h2}>
        {title}
      </h2>
      <p className={s.sub}>{sub}</p>
    </header>
  );
}

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        <Descent />

        <section className={s.section} aria-labelledby="book-title">
          <SectionHead
            id="book-title"
            title="the whole book"
            sub={`${parts.length} parts, ${totalChapters} chapters. read it in order, or jump to whatever you're stuck on. your progress stays in your browser.`}
          />
          <div className="mt-10">
            <Wall available={availableHrefs()} />
          </div>
        </section>

        <section className={s.section} aria-labelledby="rules-title">
          <SectionHead id="rules-title" title="the house rules" sub="what every page here promises." />
          <dl className={s.rules}>
            {rules.map(([k, v]) => (
              <div key={k} className={s.rule}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className={s.endActs}>
            <Link href="/learn/start/what-is-java" className={`${s.btn} ${s.solid}`}>
              start at the top
            </Link>
            <Link href="/learn/basics/stack-and-heap" className={s.btn}>
              or jump to the best picture in java
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
