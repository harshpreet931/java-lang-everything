import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { flat, getChapter, pad2 } from "@/content/curriculum";
import { availableHrefs, isAvailable } from "@/lib/content";
import { chapterJsonLd, seoDescription, seoTitle } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Toc } from "@/components/learn/Toc";
import { ChapterFooter } from "@/components/learn/ChapterFooter";
import { Since } from "@/components/mdx/blocks";
import { Glyph } from "@/components/home/Glyph";

type Params = { part: string; chapter: string };

export const dynamicParams = false;

// every chapter in the curriculum gets a page. ones without an mdx file yet render as "soon".
export function generateStaticParams(): Params[] {
  return flat.map((c) => ({ part: c.part.slug, chapter: c.slug }));
}

async function load(part: string, chapter: string) {
  try {
    // relative on purpose: webpack (dev:poll) can't resolve a tsconfig alias inside a dynamic import context
    return await import(`../../../../../content/${part}/${chapter}.mdx`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  if (!c) return {};
  const title = seoTitle(c.title);
  const description = seoDescription(c.blurb);
  const written = isAvailable(part, chapter);
  return {
    title,
    description,
    alternates: { canonical: c.href },
    // unwritten chapters are a placeholder: keep them out of the index until they exist
    robots: written ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "article",
      url: c.href,
      title: `${title} · java.lang.everything`,
      description,
      section: c.part.title,
      authors: ["https://harshpreet.com"],
    },
    twitter: { card: "summary_large_image", title: `${title} · java.lang.everything`, description },
  };
}

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  if (!c) notFound();

  const mod = await load(part, chapter);
  const Body = mod?.default ?? null;
  const toc = (mod?.toc ?? []) as { depth: 2 | 3; id: string; text: string }[];
  const stats = (mod?.stats ?? { words: 0, figures: 0 }) as { words: number; figures: number };
  const minutes = Math.max(3, Math.round(stats.words / 190 + stats.figures * 0.6));

  const ready = new Set(availableHrefs());
  const list = flat.filter((x) => ready.has(x.href));
  const at = list.findIndex((x) => x.href === c.href);
  const num = (x: (typeof flat)[number]) => `${pad2(x.part.n)}.${pad2(x.part.chapters.findIndex((y) => y.slug === x.slug) + 1)}`;
  const nb = (x?: (typeof flat)[number]) => (x ? { href: x.href, title: x.title, num: num(x) } : null);

  const [, partSeg, chapterSeg] = c.address.split(".");

  return (
    <div className="flex gap-14 px-[var(--gutter)] pt-10 pb-28 lg:pt-14 xl:pl-16">
      {Body && <JsonLd data={chapterJsonLd(c)} />}
      <article id="main" className="mx-auto min-w-0 max-w-[880px] flex-1" data-pagefind-body={Body ? "" : undefined}>
        <header className="mx-auto mb-16 max-w-[40rem] text-center">
          <Glyph name={c.part.glyph} className="lineart-glyph mx-auto mb-8 size-[76px] text-ref" />
          <div className="font-mono text-12 text-faint" data-pagefind-ignore>
            <Link href="/learn" className="hover:text-hi">
              everything
            </Link>
            <span className="text-accent-2">.</span>
            <Link href={`/learn/${c.part.slug}`} className="hover:text-hi">
              {partSeg}
            </Link>
            <span className="text-accent-2">.</span>
            <span className="text-mute">{chapterSeg}</span>
          </div>
          <h1
            className="mt-5 font-display text-[clamp(2.3rem,1.6rem+2.4vw,3.2rem)] leading-[1.08] font-light tracking-[0.005em] text-hi"
            data-pagefind-meta="title"
          >
            {c.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[34rem] text-18 leading-[1.6] text-mute italic">{c.blurb}</p>
          <dl
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-14 text-faint"
            data-pagefind-ignore
          >
            <div className="flex gap-1.5">
              <dt className="sr-only">part</dt>
              <dd>
                <Link href={`/learn/${c.part.slug}`} className="hover:text-hi">
                  part {pad2(c.part.n)}, {c.part.title}
                </Link>
              </dd>
            </div>
            <span aria-hidden className="text-accent-2">·</span>
            <div className="flex gap-1.5">
              <dt className="sr-only">chapter</dt>
              <dd className="tabular">chapter {num(c)}</dd>
            </div>
            {Body && (
              <>
                <span aria-hidden className="text-accent-2">·</span>
                <div className="flex gap-1.5">
                  <dt className="sr-only">reading time</dt>
                  <dd className="tabular">{minutes} min read</dd>
                </div>
              </>
            )}
            {(c.since || c.preview) && (
              <dd>
                <Since v={c.since} preview={c.preview} />
              </dd>
            )}
          </dl>
          <span className="ornament mt-10" aria-hidden />
        </header>

        {Body ? (
          <div className="prose">
            <Body />
          </div>
        ) : (
          <div className="ticks max-w-[68ch] px-7 py-8 text-14 leading-[1.7] text-mute" data-pagefind-ignore>
            <p className="text-hi">this chapter is still being drawn.</p>
            <p className="mt-3">
              it&apos;s on the map, it just isn&apos;t written yet. if you want to help, every chapter is one mdx file in{" "}
              <code className="text-ink">content/{c.part.slug}/{c.slug}.mdx</code>. see CONTRIBUTING.md.
            </p>
          </div>
        )}

        <div data-pagefind-ignore>
          <ChapterFooter href={c.href} prev={nb(list[at - 1])} next={nb(list[at + 1])} />
        </div>
      </article>

      <aside className="hidden w-[210px] shrink-0 xl:block" data-pagefind-ignore>
        <div className="sticky top-[calc(var(--bar-h)+48px)] max-h-[calc(100dvh-var(--bar-h)-80px)] overflow-y-auto">
          <Toc toc={toc} />
        </div>
      </aside>
    </div>
  );
}
