import { renderOg, ogSize } from "@/lib/og";
import { getPart, parts, pad2 } from "@/content/curriculum";
// the pure spec, not the covers index: that one pulls in a client component and a css module
import { coverSpec } from "@/components/learn/covers/spec";

export const alt = "a part of java.lang.everything";
export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return parts.map((p) => ({ part: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ part: string }> }) {
  const p = getPart((await params).part)!;
  const spec = coverSpec(p.slug)!;
  return renderOg({
    address: `everything.${p.slug.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())}`,
    title: p.title,
    blurb: p.blurb,
    glyph: p.glyph,
    cover: {
      pattern: spec.pattern,
      ground: spec.ground,
      ink: spec.ink,
      deep: spec.deep,
      n: `part ${pad2(p.n)}`,
      count: `${p.chapters.length} chapters`,
      title: p.title,
    },
  });
}
