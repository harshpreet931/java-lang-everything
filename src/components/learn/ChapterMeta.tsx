import Link from "next/link";
import type { ReactNode } from "react";
import { PartSwatch } from "@/components/learn/covers";

/**
 * the meta row under a chapter title: the chapter's address in departure mono at its native 11px
 * (below the title, never above it), then where it sits in the book and how long it takes.
 */
export function ChapterMeta({
  address,
  part,
  partHref,
  chapter,
  minutes,
  extra,
}: {
  address: { part: string; chapter: string };
  part?: string;
  partHref?: string;
  chapter?: string;
  minutes?: number | null;
  extra?: ReactNode;
}) {
  return (
    <dl
      className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-0 font-ui text-13 text-faint tabular [&_dd]:flex [&_dd]:min-h-8 [&_dd]:items-center"
      data-pagefind-ignore
    >
      <dt className="sr-only">address</dt>
      <dd className="font-addr text-[11px] leading-none text-mute [overflow-wrap:anywhere]" translate="no">
        <span>
          everything.{address.part}.<b className="font-normal text-hi">{address.chapter}</b>
        </span>
      </dd>
      {part && (
        <>
          <dt className="sr-only">part</dt>
          <dd>
            {partHref ? (
              <Link href={partHref} className="-mx-1 -my-1 flex min-h-10 items-center rounded-xs px-1 transition-colors duration-150 hover:text-hi">
                <PartSwatch part={partHref.split("/")[2]} size={14} className="mr-2" />
                {part}
              </Link>
            ) : (
              part
            )}
          </dd>
        </>
      )}
      {chapter && (
        <>
          <dt className="sr-only">chapter</dt>
          <dd>{chapter}</dd>
        </>
      )}
      {minutes ? (
        <>
          <dt className="sr-only">reading time</dt>
          <dd>{minutes} min</dd>
        </>
      ) : null}
      {extra && (
        <>
          <dt className="sr-only">version</dt>
          <dd>{extra}</dd>
        </>
      )}
    </dl>
  );
}
