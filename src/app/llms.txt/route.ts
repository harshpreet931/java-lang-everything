import { flat, parts, pad2 } from "@/content/curriculum";
import { availableHrefs } from "@/lib/content";
import { site } from "@/lib/site";

export const dynamic = "force-static";

// llms.txt (llmstxt.org): a plain map of the book for AI assistants and AI search.
export function GET() {
  const ready = new Set(availableHrefs());
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.tagline} an open-source, visual-first guide to java by ${site.author.name} (${site.author.url}). ${flat.length} chapters from the basics to JVM internals and garbage collection, written against jdk ${site.jdk.lts} (lts) and current through jdk ${site.jdk.latest}. every runnable snippet is checked on a real jdk.`,
    "",
    `- [contents](${site.url}/learn): every part and chapter in reading order`,
    `- [glossary](${site.url}/glossary): java terms in one line each`,
    `- [playground](${site.url}/play): compile and run java in the browser`,
    `- [source](${site.repo})`,
    "",
  ];
  for (const p of parts) {
    const written = p.chapters.filter((c) => ready.has(`/learn/${p.slug}/${c.slug}`));
    if (!written.length) continue;
    lines.push(`## part ${pad2(p.n)}: ${p.title}`, "", p.blurb, "");
    for (const c of written) lines.push(`- [${c.title}](${site.url}/learn/${p.slug}/${c.slug}): ${c.blurb}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
