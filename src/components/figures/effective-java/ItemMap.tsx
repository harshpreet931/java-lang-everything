"use client";

import { useState } from "react";

// the chapter at a glance: one card per item, and which ones modern java changed.
// hot = "changed since the book (2018)". cards link to the item's h3 below.
//
//   <ItemMap items={[{ n: 17, t: "make things immutable", lens: "records" }, ...]} />
//
// the anchor is computed exactly like github-slugger does it for the heading
// "item 17 · make things immutable", so keep the headings and `t` in sync.

export type Item = { n: number; t: string; lens?: string };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");

export function ItemMap({ items }: { items: Item[] }) {
  const [only, setOnly] = useState(false);
  const changed = items.filter((x) => x.lens).length;
  const shown = only ? items.filter((x) => x.lens) : items;

  return (
    <div className="@container">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-12">
        <span className="text-faint tabular">
          {items.length} items · <span className="text-hot">{changed}</span> touched by modern java
        </span>
        <div className="flex gap-1" role="group" aria-label="filter items">
          <button className="word" aria-pressed={!only} onClick={() => setOnly(false)}>
            all
          </button>
          <button className="word" aria-pressed={only} onClick={() => setOnly(true)}>
            changed since 2018
          </button>
        </div>
      </div>
      <ul className="grid gap-2 @[520px]:grid-cols-2 @[760px]:grid-cols-3">
        {shown.map((x) => (
          <li key={x.n}>
            <a
              href={`#${slug(`item ${x.n} · ${x.t}`)}`}
              className="plain group flex h-full flex-col gap-1 rounded-md bg-bg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-2)] transition-[box-shadow] duration-150 hover:shadow-[inset_0_0_0_1px_var(--mute)]"
            >
              <span className="flex items-baseline justify-between gap-3 text-11 text-faint tabular">
                <span>item {x.n}</span>
                <span aria-hidden className="text-faint transition-colors duration-150 group-hover:text-hi">
                  ↓
                </span>
              </span>
              <span className="font-serif text-[1.05rem] leading-[1.35] text-hi">{x.t}</span>
              {x.lens && (
                <span className="mt-auto flex items-center gap-1.5 pt-1 text-11 leading-[1.4] text-hot">
                  <span aria-hidden className="inline-block size-[5px] shrink-0 rounded-full bg-hot" />
                  {x.lens}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
