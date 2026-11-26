import Link from "next/link";
import { site } from "@/lib/site";
import { Series } from "@/components/site/Series";
import { Bedrock } from "@/components/site/Bedrock";
import s from "./bedrock.module.css";

/**
 * calm paper above (author, nav, colophon, the sibling book), then the address line, then the floor:
 * the bottom of the address space, where "everything" is built from heap dots (Bedrock.tsx).
 */
export function Footer() {
  return (
    <footer className="mt-[clamp(96px,14vw,180px)] border-t border-line">
      <div className="mx-auto max-w-[1120px] px-[var(--gutter)] pt-14">
        <div className="grid grid-cols-1 items-start gap-x-12 gap-y-5 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-end">
          <div>
            <p className="m-0 font-title text-[1.6rem] leading-[1.15] tracking-[-0.012em] text-hi">
              <span className="font-mono text-[0.56em] tracking-[-0.01em] text-mute">java.lang.</span>everything, by{" "}
              <a href={site.author.url} className="link" target="_blank" rel="noreferrer">
                {site.author.short}
              </a>
            </p>
            <p className="mt-2 mb-0 font-body text-15 leading-[1.55] text-mute italic">
              written and drawn by{" "}
              <a href={site.author.url} className="link not-italic" target="_blank" rel="noreferrer">
                {site.author.name}
              </a>
              . more of my work at{" "}
              <a href={site.author.url} className="link not-italic" target="_blank" rel="noreferrer">
                {site.author.domain}
              </a>
              .
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-[22px] font-ui text-14 leading-none font-[450] [&>a]:inline-flex [&>a]:min-h-10 [&>a]:items-center"
            aria-label="footer"
          >
            <Link href="/learn" className="link">
              contents
            </Link>
            <Link href="/glossary" className="link">
              glossary
            </Link>
            <Link href="/play" className="link">
              play
            </Link>
            <a href={site.repo} className="link" target="_blank" rel="noreferrer">
              source
            </a>
            <a href={site.author.url} className="link" target="_blank" rel="noreferrer">
              {site.author.domain}
            </a>
          </nav>
        </div>
        <div className="mt-9 grid grid-cols-1 items-start gap-x-12 gap-y-4 border-t border-line pt-6 font-ui text-14 leading-[1.7] text-mute min-[760px]:grid-cols-[minmax(0,1fr)_auto]">
          <p className="m-0 max-w-[44rem]">
            MIT licensed and open source,{" "}
            <a href={site.repo} className="link" target="_blank" rel="noreferrer">
              the source is on github
            </a>
            . set in Redaction, Piazzolla, Geist, Geist Mono, Geist Pixel and Departure Mono, all under the SIL open font licence.
            written against jdk {site.jdk.lts} (lts), current through jdk {site.jdk.latest}. made by {site.author.short} after one too
            many &ldquo;java is pass-by-reference&rdquo; arguments.
          </p>
          <Series />
        </div>
        <div className="mt-11 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2 pb-3.5" aria-hidden>
          <span className="font-addr text-11 text-faint">0x00000000 · the bottom of the address space</span>
          <span className="font-body text-14 leading-[1.3] text-faint italic">
            <span className={s.hintLamp}>the floor is a heap. bring a lamp.</span>
            <span className={s.hintTap}>tap the floor.</span>
          </span>
        </div>
      </div>
      <Bedrock />
    </footer>
  );
}
