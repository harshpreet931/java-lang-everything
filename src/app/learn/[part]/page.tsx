import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPart, parts, pad2 } from "@/content/curriculum";
import { availableHrefs } from "@/lib/content";
import { Cover } from "@/components/learn/covers/Cover";
import { PartSwatch } from "@/components/learn/covers/PartSwatch";
import { coverSpec } from "@/components/learn/covers/spec";
import cs from "@/components/learn/covers/covers.module.css";
import s from "@/components/learn/covers/pages.module.css";

type Params = { part: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return parts.map((p) => ({ part: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = getPart((await params).part);
  if (!p) return {};
  const title = /java/i.test(p.title) ? p.title : `${p.title} in java`;
  return {
    title,
    description: `${p.blurb} ${p.chapters.length} visual chapters with interactive diagrams and runnable code.`,
    alternates: { canonical: `/learn/${p.slug}` },
    openGraph: { url: `/learn/${p.slug}`, title: `${title} · java.lang.everything` },
  };
}

const camel = (slug: string) => slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export default async function PartPage({ params }: { params: Promise<Params> }) {
  const p = getPart((await params).part);
  const spec = p && coverSpec(p.slug);
  if (!p || !spec) notFound();
  const ready = new Set(availableHrefs());
  const prev = parts[p.n - 2];
  const next = parts[p.n];
  const hrefs = p.chapters.map((c) => `/learn/${p.slug}/${c.slug}`);
  const first = hrefs[0];

  return (
    <div className={`${s.page} px-[var(--gutter)] pt-10 pb-28 lg:pt-14 xl:pl-16`}>
      <main id="main" className="max-w-[900px]">
        <div className={s.opener}>
          <div className={`${s.openerCover} ${cs.host}`}>
            <Cover spec={spec} size="large" hrefs={hrefs} />
          </div>
          <div>
            <div className={s.crumb}>
              <Link href="/learn">everything</Link>.{camel(p.slug)}
            </div>
            <h1 className={s.partTitle}>{p.title}</h1>
            <p className={s.partBlurb}>{p.blurb}</p>
            <div className={s.meta}>
              <Link href={first} className="act solid">
                start part {pad2(p.n)}
              </Link>
              <span>
                part <span className={s.num}>{pad2(p.n)}</span> of {parts.length},{" "}
                <span className={s.num}>{p.chapters.length}</span> chapters
              </span>
            </div>
          </div>
        </div>

        <ol className={s.chapters}>
          {p.chapters.map((c, i) => {
            const href = hrefs[i];
            const has = ready.has(href);
            return (
              <li key={c.slug}>
                <Link href={href} className={s.row}>
                  <span className={s.rowN}>
                    {pad2(p.n)}.{pad2(i + 1)}
                  </span>
                  <span>
                    <span className={s.rowT} data-soon={!has || undefined}>
                      {c.title}
                      {!has && <span className={s.tag}>soon</span>}
                      {c.since && <span className={s.tag}>java {c.since}+</span>}
                      {c.preview && <span className={s.tag}>preview</span>}
                    </span>
                    <span className={s.rowB}>{c.blurb}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <nav className={s.parts} aria-label="parts">
          {[prev, next].map((x, i) =>
            x ? (
              <Link key={x.slug} href={`/learn/${x.slug}`} className={s.near} data-next={i ? "" : undefined}>
                <PartSwatch part={x.slug} size={18} />
                <span>
                  <span className={s.nearK}>{i ? `next part, ${pad2(x.n)} →` : `← previous part, ${pad2(x.n)}`}</span>
                  <span className={s.nearT}>{x.title}</span>
                </span>
              </Link>
            ) : (
              <div key={i} />
            ),
          )}
        </nav>
      </main>
    </div>
  );
}
