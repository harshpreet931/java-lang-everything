import { Children, type ReactNode } from "react";

// small server-rendered building blocks for chapters. see AUTHORING.md.

type Tone = "ref" | "live" | "dead" | "meta" | "hot" | "mute";
const GLYPHS = new Set(["ref", "live", "dead", "meta", "hot", "mute"]);
const toneVar = (t: string) => `var(--${t})`;

/** the tl;dr. every chapter opens with one. rendered as the opening paragraph, a step larger. */
export function InShort({ children }: { children: ReactNode }) {
  return <div className="inshort measure mx-auto my-12 first:mt-0">{children}</div>;
}

/** the lit dot a callout is labelled with. it wears its tone's shape, like a glyph chip. */
function Lamp({ tone }: { tone: Tone }) {
  const ring = tone === "dead" || tone === "mute";
  return (
    <span
      aria-hidden
      className={`shrink-0 self-center ${tone === "meta" ? "h-[11px] w-[5px] rounded-full" : "size-[9px] rounded-full"}`}
      style={{
        background: ring ? "transparent" : toneVar(tone),
        boxShadow: ring
          ? `inset 0 0 0 1.5px ${tone === "mute" ? "var(--edge)" : toneVar(tone)}`
          : tone === "hot"
            ? "0 0 0 3px color-mix(in oklab, var(--hot) 24%, transparent)"
            : undefined,
      }}
    />
  );
}

/** a callout is framed, and labelled by a lit dot and a word. never a coloured side bar. */
function Callout({ word, title, tone, children }: { word: ReactNode; title?: ReactNode; tone: Tone; children: ReactNode }) {
  return (
    <aside className="measure callout mx-auto my-10 rounded-[10px] px-[22px] pt-[18px] pb-5 text-[1.09rem] leading-[1.6] shadow-[inset_0_0_0_1px_var(--line-2)] max-sm:px-4 max-sm:text-[1.03rem] [&>*+*]:mt-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-hi">
        <span className="flex items-baseline gap-2.5">
          <Lamp tone={tone} />
          <span className="font-ui text-13 font-medium">{word}</span>
        </span>
        {title && <em className="text-[1.125rem] italic">{title}</em>}
      </div>
      {children}
    </aside>
  );
}

/** the thing that bites people. bugs, traps, prod incidents. */
export function Gotcha({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Callout word="gotcha" title={title} tone="dead">
      {children}
    </Callout>
  );
}

/** how this shows up in interviews, and the answer that lands. */
export function Interview({ children, q }: { children: ReactNode; q?: string }) {
  return (
    <Callout word="interview" tone="hot">
      {q && <p className="text-hi">“{q}”</p>}
      {children}
    </Callout>
  );
}

/** a pointer into effective java (3rd ed). paraphrase, never quote the book. */
export function Effective({ children, item, title }: { children?: ReactNode; item: number | string; title?: string }) {
  return (
    <Callout word={`effective java, item ${item}`} title={title} tone="meta">
      {children}
    </Callout>
  );
}

/** a neutral aside. use sparingly. */
export function Note({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Callout word="note" title={title} tone="mute">
      {children}
    </Callout>
  );
}

/** how things work in the JVM, for people who want one level deeper. collapsed by default. */
export function Deep({ children, title }: { children: ReactNode; title: string }) {
  return (
    <details className="measure deep group mx-auto my-10 rounded-[10px] px-[22px] shadow-[inset_0_0_0_1px_var(--line-2)] max-sm:px-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-ink transition-colors duration-150 hover:text-hi [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="flex items-baseline gap-2.5 text-hi">
            <Lamp tone="meta" />
            <span className="font-ui text-13 font-medium">one level deeper</span>
          </span>
          <em className="text-[1.125rem] text-hi italic">{title}</em>
        </span>
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-mute transition-transform duration-200 ease-jle group-open:rotate-45">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="pb-6 text-[1.09rem] leading-[1.6] max-sm:text-[1.03rem] [&>*+*]:mt-3">{children}</div>
    </details>
  );
}

/** end-of-chapter recap. one line each, write them like you'd say them. */
export function Keylines({ children }: { children: ReactNode }) {
  return (
    <section className="keylines measure mx-auto mt-20 border-t border-line pt-8">
      <h2 className="!mt-0 font-title text-[1.6rem] tracking-[-0.012em] text-hi">keylines</h2>
      <div className="mt-4 text-[1.09rem] text-ink [&_li]:py-2.5 [&_li+li]:!mt-0 [&_li+li]:border-t [&_li+li]:border-line [&_ul]:!max-w-none">
        {children}
      </div>
    </section>
  );
}

/**
 * colour a word so it matches a figure. k = ref | live | dead | meta | hot (| mute).
 * it renders as a glyph chip: the word wears its colour and its shape (a dotted run for ref, a ring
 * for dead, a pill for meta, a lit dot for hot and live), so colour is never the only signal.
 * the glyph and the first word never part across a line break.
 */
export function C({ k, children }: { k: Tone; children: ReactNode }) {
  if (!GLYPHS.has(k)) return <span style={{ color: toneVar(k) }}>{children}</span>;
  const items = Children.toArray(children);
  let lead: ReactNode = null;
  if (typeof items[0] === "string") {
    const m = /^(\s*\S+)([\s\S]*)$/.exec(items[0]);
    if (m) {
      lead = m[1];
      items[0] = m[2];
    }
  }
  return (
    <span className={`chip ${k}`} style={{ color: toneVar(k) }}>
      <span className="chip-lead">
        <span className="chip-dot" aria-hidden />
        {lead}
      </span>
      {items}
    </span>
  );
}

/** "java 21+" or "preview". inline. */
export function Since({ v, preview }: { v?: number; preview?: boolean }) {
  return (
    <span className="mx-0.5 inline-flex -translate-y-px items-center rounded-xs px-1.5 align-middle font-ui text-[0.6875rem] font-medium whitespace-nowrap leading-[18px] tracking-[0.01em] text-mute not-italic shadow-[inset_0_0_0_1px_var(--line-2)] tabular">
      {preview ? `preview${v ? ` in ${v}` : ""}` : `java ${v}+`}
    </span>
  );
}

/** a figure frame: a soft panel, optional caption. captions say what to click and what to notice. */
export function Figure({
  children,
  caption,
  wide,
  bare,
}: {
  children: ReactNode;
  caption?: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  return (
    <figure className={`figure my-14 ${wide ? "lg:-mx-12" : ""}`}>
      <div className={`figure-body ${bare ? "" : "ticks px-4 py-6 sm:px-8 sm:py-8"}`}>{children}</div>
      {caption && (
        <figcaption className="mx-auto mt-3.5 max-w-[34rem] text-center text-[1.03rem] leading-[1.55] text-mute italic [&_code]:not-italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** a bigger version of a definition. term on the left, meaning on the right. */
export function Defs({ children }: { children: ReactNode }) {
  return (
    <dl className="measure mx-auto my-8 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 text-[1.06rem] [&>dd]:border-b [&>dd]:border-line [&>dd]:py-2.5 [&>dd]:text-ink [&>dt]:border-b [&>dt]:border-line [&>dt]:py-2.5 [&>dt]:text-hi">
      {children}
    </dl>
  );
}
