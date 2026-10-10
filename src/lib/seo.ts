import "server-only";
import fs from "node:fs";
import path from "node:path";
import { site } from "@/lib/site";
import type { FlatChapter, Part } from "@/content/curriculum";

// search-facing words. the page itself stays lowercase and casual; titles and descriptions
// say what people actually type into a search box ("hashmap in java", "java stack vs heap").

const abs = (p: string) => new URL(p, site.url).toString();

/** "HashMap" → "HashMap in java", "what java actually is" stays as is */
export function seoTitle(title: string) {
  return /java/i.test(title) ? title : `${title} in java`;
}

/** ~155 chars, ends on a full word */
export function seoDescription(blurb: string) {
  const s = `${blurb.replace(/\.$/, "")}. explained with interactive diagrams, runnable code and real jdk 25 output.`;
  if (s.length <= 158) return s;
  return s.slice(0, 155).replace(/\s+\S*$/, "") + "…";
}

export function chapterFile(c: FlatChapter) {
  return path.join(process.cwd(), "content", c.part.slug, `${c.slug}.mdx`);
}

export function lastModified(c: FlatChapter): Date | undefined {
  try {
    return fs.statSync(chapterFile(c)).mtime;
  } catch {
    return undefined;
  }
}

const level = (p: Part) => (p.n <= 4 ? "beginner" : p.n <= 12 ? "intermediate" : "advanced");

export const author = {
  "@type": "Person",
  name: site.author.name,
  url: site.author.url,
  sameAs: [site.author.github],
};

const course = {
  "@type": "Course",
  "@id": abs("/learn#course"),
  name: `${site.name}: ${site.tagline}`,
  url: abs("/learn"),
  description: site.description,
  inLanguage: "en",
  isAccessibleForFree: true,
  provider: { "@type": "Person", name: site.author.name, url: site.author.url },
  author,
};

/** json-ld for one chapter: an article that's part of the course, plus breadcrumbs */
export function chapterJsonLd(c: FlatChapter) {
  const modified = lastModified(c)?.toISOString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["TechArticle", "LearningResource"],
        headline: seoTitle(c.title),
        name: c.title,
        description: seoDescription(c.blurb),
        url: abs(c.href),
        image: abs(`${c.href}/opengraph-image`),
        inLanguage: "en",
        author,
        publisher: author,
        isAccessibleForFree: true,
        educationalLevel: level(c.part),
        learningResourceType: "interactive chapter",
        about: { "@type": "ComputerLanguage", name: "Java" },
        proficiencyLevel: level(c.part),
        ...(modified ? { dateModified: modified } : {}),
        isPartOf: { "@id": course["@id"] },
        articleSection: c.part.title,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: abs("/") },
          { "@type": "ListItem", position: 2, name: "contents", item: abs("/learn") },
          { "@type": "ListItem", position: 3, name: c.part.title, item: abs(`/learn/${c.part.slug}`) },
          { "@type": "ListItem", position: 4, name: c.title, item: abs(c.href) },
        ],
      },
    ],
  };
}

/** json-ld for the contents page: the whole book as a free online course */
export function courseJsonLd(parts: Part[], written: Set<string>) {
  return {
    "@context": "https://schema.org",
    ...course,
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free", url: abs("/learn") },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT60H" },
    syllabusSections: parts.map((p) => ({
      "@type": "Syllabus",
      name: p.title,
      description: p.blurb,
    })),
    hasPart: parts.flatMap((p) =>
      p.chapters
        .filter((c) => written.has(`/learn/${p.slug}/${c.slug}`))
        .map((c) => ({ "@type": "LearningResource", name: c.title, url: abs(`/learn/${p.slug}/${c.slug}`) })),
    ),
  };
}

/** json-ld for the glossary: a set of defined terms */
export function glossaryJsonLd(terms: { id: string; term: string; short: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": abs("/glossary"),
    name: `java glossary · ${site.name}`,
    url: abs("/glossary"),
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.short,
      url: abs(`/glossary#${t.id}`),
      inDefinedTermSet: abs("/glossary"),
    })),
  };
}

export { abs };
