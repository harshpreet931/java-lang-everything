"use client";

import { useState, type ReactNode } from "react";
import { PANEL, Words } from "./kit";

// two real doc comments from com.acme.money.Money, and (simplified) what javadoc 25
// generated for them. the generated HTML was checked by reading docs/com/acme/money/Money.html.

type Part = "summary" | "body" | "code" | "link" | "param" | "return" | "throws" | "fence";

const NOTE: Record<Part, string> = {
  summary: "the first sentence. it's also what shows up in the summary table at the top of the page, so make it stand on its own.",
  body: "everything after the first sentence and before the first block tag. the main description.",
  code: "inline tag (or `backticks` in markdown): code font, and no html escaping headaches.",
  link: "a cross-reference. javadoc resolves it, and links into the JDK's own docs for JDK types.",
  param: "block tag: one per parameter, in order. doclint warns if you skip one.",
  return: "block tag: what comes back.",
  throws: "block tag: which exception, and when. only the ones a caller can actually act on.",
  fence: "a fenced code block. in markdown comments this just works, no <pre>{@code ...}</pre> dance.",
};

type Seg = { t: string; p?: Part };

const CLASSIC: Seg[][] = [
  [{ t: "/**" }],
  [{ t: " * " }, { t: "Creates an amount from whole cents.", p: "summary" }],
  [{ t: " *" }],
  [{ t: " * " }, { t: "@param cents the amount, for example ", p: "param" }, { t: "{@code 1999}", p: "code" }, { t: " for $19.99", p: "param" }],
  [{ t: " * " }, { t: "@return a new ", p: "return" }, { t: "{@code Money}", p: "code" }],
  [{ t: " * " }, { t: "@throws IllegalArgumentException if ", p: "throws" }, { t: "{@code cents}", p: "code" }, { t: " is", p: "throws" }],
  [{ t: " *         " }, { t: "{@link Long#MIN_VALUE}", p: "link" }, { t: ", which can't be negated", p: "throws" }],
  [{ t: " */" }],
  [{ t: "public static Money ofCents(long cents)" }],
];

const MARKDOWN: Seg[][] = [
  [{ t: "/// " }, { t: "Adds two amounts.", p: "summary" }],
  [{ t: "///" }],
  [{ t: "/// " }, { t: "The result is **exact**: no rounding, no floating point.", p: "body" }],
  [{ t: "/// " }, { t: "See ", p: "body" }, { t: "[#ofCents(long)]", p: "link" }, { t: " for creating amounts, and", p: "body" }],
  [{ t: "/// " }, { t: "[java.math.BigDecimal]", p: "link" }, { t: " if you need fractions of a cent.", p: "body" }],
  [{ t: "///" }],
  [{ t: "/// " }, { t: "```java", p: "fence" }],
  [{ t: "/// " }, { t: "Money.ofCents(150).plus(Money.ofCents(50)); // 200 cents", p: "fence" }],
  [{ t: "/// " }, { t: "```", p: "fence" }],
  [{ t: "///" }],
  [{ t: "/// " }, { t: "@param other the amount to add", p: "param" }],
  [{ t: "/// " }, { t: "@return the sum", p: "return" }],
  [{ t: "public Money plus(Money other)" }],
];

export function DocAnatomy() {
  const [mode, setMode] = useState<"classic" | "markdown">("classic");
  const [on, setOn] = useState<Part | null>("summary");
  const src = mode === "classic" ? CLASSIC : MARKDOWN;

  const hl = (p: Part | undefined, children: ReactNode, key?: number | string, cls = "") => {
    const active = p && p === on;
    return (
      <span
        key={key}
        onMouseEnter={() => p && setOn(p)}
        onClick={() => p && setOn(p)}
        className={`rounded-[3px] transition-[background-color,color] duration-150 ${p ? "cursor-pointer" : ""} ${cls}`}
        style={{
          background: active ? "color-mix(in srgb, var(--hot) 18%, transparent)" : undefined,
          color: active ? "var(--hi)" : undefined,
        }}
      >
        {children}
      </span>
    );
  };

  return (
    <div className="@container">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-13">
        <span className="text-faint">comment =</span>
        <Words
          label="which kind of doc comment"
          options={[
            { v: "classic" as const, label: "/** html */" },
            { v: "markdown" as const, label: "/// markdown (java 23+)" },
          ]}
          value={mode}
          onChange={(v) => (setMode(v), setOn("summary"))}
        />
      </div>

      <div className="grid gap-4 @[680px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <pre className={`overflow-x-auto px-4 py-3 text-12 leading-[1.75] text-mute ${PANEL}`}>
          {src.map((line, i) => (
            <div key={i} className="whitespace-pre">
              {line.map((s, j) => hl(s.p, s.t, j, s.p ? "text-ink" : ""))}
            </div>
          ))}
        </pre>

        {/* roughly what javadoc renders */}
        <div className={`px-4 py-3 text-13 ${PANEL}`}>
          <div className="mb-2 text-11 text-faint">what javadoc generates (simplified)</div>
          {mode === "classic" ? (
            <>
              <div className="mb-2 border-b border-line-2 pb-2 text-12">
                <span className="text-faint">summary table: </span>
                <span className="text-ref">ofCents</span>(long cents) {hl("summary", "Creates an amount from whole cents.")}
              </div>
              <div className="text-hi">
                public static Money <span className="font-medium">ofCents</span>(long cents)
              </div>
              <p className="mt-1.5 font-serif text-16 leading-[1.5] text-ink">{hl("summary", "Creates an amount from whole cents.")}</p>
              <dl className="mt-2 grid gap-1 text-12">
                <dt className="text-faint">Parameters:</dt>
                <dd className="pl-4">
                  {hl("param", <>cents - the amount, for example </>)}
                  {hl("code", <span className="text-hi">1999</span>)}
                  {hl("param", " for $19.99")}
                </dd>
                <dt className="text-faint">Returns:</dt>
                <dd className="pl-4">
                  {hl("return", "a new ")}
                  {hl("code", <span className="text-hi">Money</span>)}
                </dd>
                <dt className="text-faint">Throws:</dt>
                <dd className="pl-4">
                  {hl("throws", <><span className="text-ref">IllegalArgumentException</span> - if </>)}
                  {hl("code", <span className="text-hi">cents</span>)}
                  {hl("throws", " is ")}
                  {hl("link", <span className="text-ref underline decoration-1 underline-offset-2">Long.MIN_VALUE</span>)}
                  {hl("throws", ", which can't be negated")}
                </dd>
              </dl>
            </>
          ) : (
            <>
              <div className="text-hi">
                public Money <span className="font-medium">plus</span>(Money other)
              </div>
              <div className="mt-1.5 font-serif text-16 leading-[1.5] text-ink">
                <p>{hl("summary", "Adds two amounts.")}</p>
                <p className="mt-1.5">
                  {hl("body", <>The result is <strong>exact</strong>: no rounding, no floating point. See </>)}
                  {hl("link", <span className="font-mono text-13 text-ref underline decoration-1 underline-offset-2">ofCents(long)</span>)}
                  {hl("body", " for creating amounts, and ")}
                  {hl("link", <span className="font-mono text-13 text-ref underline decoration-1 underline-offset-2">BigDecimal</span>)}
                  {hl("body", " if you need fractions of a cent.")}
                </p>
              </div>
              {hl(
                "fence",
                <pre className="mt-2 block overflow-x-auto rounded-sm bg-well-2 px-2 py-1 text-11">Money.ofCents(150).plus(Money.ofCents(50)); // 200 cents</pre>,
              )}
              <dl className="mt-2 grid gap-1 text-12">
                <dt className="text-faint">Parameters:</dt>
                <dd className="pl-4">{hl("param", "other - the amount to add")}</dd>
                <dt className="text-faint">Returns:</dt>
                <dd className="pl-4">{hl("return", "the sum")}</dd>
              </dl>
            </>
          )}
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-17 leading-[1.55] text-ink" aria-live="polite">
        {on ? NOTE[on] : "hover a highlighted part."}
      </p>
    </div>
  );
}
