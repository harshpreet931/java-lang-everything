import type { Metadata } from "next";
import Link from "next/link";
import { glossary } from "@/content/glossary";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { glossaryJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "java glossary: every term in one line",
  description: "a java glossary: JVM, bytecode, heap, garbage collection, generics, lambdas, concurrency and more, each in one line and linked to a visual chapter that explains it.",
  alternates: { canonical: "/glossary" },
  openGraph: { url: "/glossary" },
};

export default function Glossary() {
  const groups = new Map<string, typeof glossary>();
  for (const t of glossary) {
    const ch = /^[a-z]/i.test(t.term) ? t.term[0].toUpperCase() : "#";
    groups.set(ch, [...(groups.get(ch) ?? []), t]);
  }
  const letters = [...groups.keys()];

  return (
    <>
      <main id="main" className="px-[var(--gutter)] pt-14">
        <JsonLd data={glossaryJsonLd(glossary)} />
        <div className="mx-auto max-w-[980px]">
          <header className="border-b border-line pb-8">
            <h1 className="font-title text-[clamp(2.375rem,1.7rem+2vw,3rem)] leading-[1.04] tracking-[-0.018em] text-hi">glossary</h1>
            <p className="mt-4 max-w-[34rem] text-[1.25rem] leading-[1.5] text-mute italic max-sm:text-[1.125rem]">
              {glossary.length} terms, one line each. every one links to the chapter that explains it properly.
            </p>
            <div className="mt-5 font-addr text-[11px] text-mute" translate="no">
              everything.<b className="font-normal text-hi">glossary</b>
            </div>
            <nav className="mt-7 flex flex-wrap gap-x-0.5 gap-y-1" aria-label="letters">
              {letters.map((l) => (
                <a key={l} href={`#letter-${l}`} className="word !min-w-9 justify-center !px-2">
                  {l.toLowerCase()}
                </a>
              ))}
            </nav>
          </header>
          {letters.map((l) => (
            <section key={l} id={`letter-${l}`} className="grid gap-x-10 border-b border-line py-8 md:grid-cols-[6ch_minmax(0,1fr)]">
              <h2 className="mb-4 font-title text-[2rem] leading-none text-hi md:mb-0">{l.toLowerCase()}</h2>
              <dl>
                {groups.get(l)!.map((t) => (
                  <div key={t.id} id={t.id} className="grid scroll-mt-28 gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                    <dt className="text-[1.0625rem] leading-[1.45] font-medium text-hi">{t.term}</dt>
                    <dd className="text-[1.0625rem] leading-[1.55] text-ink">
                      {t.short}{" "}
                      <Link href={t.href} className="link whitespace-nowrap !text-mute hover:!text-hi">
                        read more
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
