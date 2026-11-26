import { renderOg, ogSize } from "@/lib/og";
import { flat, getChapter } from "@/content/curriculum";

export const alt = "a chapter of java.lang.everything";
export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return flat.map((c) => ({ part: c.part.slug, chapter: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ part: string; chapter: string }> }) {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter)!;
  return renderOg({ address: c.address, title: c.title, blurb: c.blurb, glyph: c.part.glyph });
}
