"use client";

import { Children, createContext, isValidElement, useContext, useId, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

// interactive mdx blocks: quizzes, tabs, compare. client components.

/* ---- quiz / predict ------------------------------------------------------- */

const Revealed = createContext(false);

/**
 * a multiple-choice check. children can include a code block and an <Explain>.
 * the explanation stays hidden until you commit to an answer.
 */
export function Quiz({
  question,
  options,
  answer,
  children,
  label = "quick check",
}: {
  question?: ReactNode;
  options: string[];
  /** index into options */
  answer: number;
  children?: ReactNode;
  label?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const id = useId();
  const revealed = picked !== null;
  const right = picked === answer;

  return (
    <div className="quiz measure mx-auto my-12 rounded-[10px] px-4 pt-5 pb-6 shadow-[inset_0_0_0_1px_var(--line-2)] sm:px-[22px]" role="group" aria-labelledby={id}>
      <div id={id} className="mb-3 flex items-baseline justify-between gap-4">
        <span className="flex items-baseline gap-2.5 text-hi">
          <span
            aria-hidden
            className="size-[9px] shrink-0 self-center rounded-full bg-hot shadow-[0_0_0_3px_color-mix(in_oklab,var(--hot)_24%,transparent)]"
          />
          <span className="font-ui text-13 font-medium">{label}</span>
        </span>
        {revealed && (
          <span className="text-[1.0625rem] italic" style={{ color: right ? "var(--live)" : "var(--dead)" }}>{right ? "yep." : "not quite."}</span>
        )}
      </div>
      {question && <div className="mb-4 text-[1.12rem] leading-[1.6] text-hi">{question}</div>}
      <Revealed.Provider value={revealed}>
        <div className="[&_.code-frame]:my-4">{children}</div>
      </Revealed.Provider>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup">
        {options.map((o, i) => {
          const isAnswer = revealed && i === answer;
          const isWrongPick = revealed && i === picked && !right;
          return (
            <button
              key={i}
              role="radio"
              aria-checked={picked === i}
              disabled={revealed}
              onClick={() => {
                setPicked(i);
                track("quiz_answered", { correct: i === answer, kind: label });
              }}
              className="act !h-auto !min-h-10 max-w-full min-w-0 !py-2 text-left [overflow-wrap:anywhere] !font-mono !text-13 !leading-[1.4] !whitespace-normal disabled:!pointer-events-none disabled:!opacity-100"
              style={
                isAnswer
                  ? { borderColor: "var(--live)", color: "var(--live)" }
                  : isWrongPick
                    ? { borderColor: "var(--dead)", color: "var(--dead)", textDecoration: "line-through" }
                    : revealed
                      ? { opacity: 0.45 }
                      : undefined
              }
            >
              {o}
            </button>
          );
        })}
        {revealed && (
          <button onClick={() => setPicked(null)} className="word ml-auto">
            try again
          </button>
        )}
      </div>
    </div>
  );
}

/** quiz preset for "what does this print?" */
export function Predict(props: Omit<Parameters<typeof Quiz>[0], "label">) {
  return <Quiz {...props} label="predict the output" />;
}

/** explanation inside a <Quiz>/<Predict>. hidden until answered. */
export function Explain({ children }: { children: ReactNode }) {
  const revealed = useContext(Revealed);
  if (!revealed) return null;
  return <div className="mt-5 border-t border-line pt-5 text-[1.05rem] leading-[1.75] text-ink [&>*+*]:mt-3">{children}</div>;
}

/* ---- tabs ------------------------------------------------------------------- */

export function Tab({ children }: { label: string; children: ReactNode }) {
  return <>{children}</>;
}

export function Tabs({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ label: string; children: ReactNode }>[];
  const [i, setI] = useState(0);
  const id = useId();
  return (
    <div className="tabs my-8">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line pb-2">
        {tabs.map((t, j) => (
          <button
            key={j}
            role="tab"
            id={`${id}-t${j}`}
            aria-selected={i === j}
            aria-controls={`${id}-p${j}`}
            onClick={() => setI(j)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setI((i + 1) % tabs.length);
              if (e.key === "ArrowLeft") setI((i - 1 + tabs.length) % tabs.length);
            }}
            className="word"
          >
            {t.props.label}
          </button>
        ))}
      </div>
      {tabs.map((t, j) => (
        <div
          key={j}
          role="tabpanel"
          id={`${id}-p${j}`}
          aria-labelledby={`${id}-t${j}`}
          hidden={i !== j}
          className="[&>.code-frame:first-child]:mt-4 [&>*+*]:mt-4 [&>p:first-child]:mt-4"
        >
          {t.props.children}
        </div>
      ))}
    </div>
  );
}

/* ---- compare --------------------------------------------------------------- */

function Side({ children, label, tone }: { children: ReactNode; label?: string; tone: "dead" | "live" }) {
  return (
    <div className="min-w-0 [&_.code-frame]:my-0 [&_.code-frame]:mt-3">
      <div className="flex items-baseline gap-2.5">
        <span className="flex items-baseline gap-2" style={{ color: `var(--${tone})` }}>
          <span
            aria-hidden
            className="size-[9px] shrink-0 self-center rounded-full"
            style={tone === "dead" ? { boxShadow: "inset 0 0 0 1.5px var(--dead)" } : { background: "var(--live)" }}
          />
          <span className="font-ui text-13 font-medium">{tone === "dead" ? "don't" : "do"}</span>
        </span>
        {label && <span className="text-[1.0625rem] text-mute italic">{label}</span>}
      </div>
      <div className="text-[1.06rem] leading-[1.6] [&>p]:mt-3">{children}</div>
    </div>
  );
}

export function Bad(props: { children: ReactNode; label?: string }) {
  return <Side {...props} tone="dead" />;
}
export function Good(props: { children: ReactNode; label?: string }) {
  return <Side {...props} tone="live" />;
}

/** <Compare><Bad label="…">…</Bad><Good label="…">…</Good></Compare> */
export function Compare({ children }: { children: ReactNode }) {
  return <div className="compare my-10 grid gap-8 lg:grid-cols-2 lg:gap-6">{children}</div>;
}
