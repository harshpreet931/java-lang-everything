import { renderOg, ogSize } from "@/lib/og";
import { totalChapters } from "@/content/curriculum";

export const alt = "java.lang.everything: java, all the way down.";
export const size = ogSize;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return renderOg({
    address: "everything",
    title: "java, all the way down",
    blurb: `a free book that draws java instead of describing it. ${totalChapters} chapters, from int x = 5 to the garbage collector.`,
    glyph: "objects",
    motif: "heap",
    big: true,
  });
}
