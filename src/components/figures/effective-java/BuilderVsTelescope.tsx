"use client";

import { useState } from "react";
import { Java } from "./kit";

// item 2. pick the options you care about. a telescoping constructor makes you pass
// every positional argument up to the last one you want, including ones you don't care
// about (dead). a builder only mentions what you chose.

type Opt = { k: string; mine: string; dflt: string };

const OPTS: Opt[] = [
  { k: "shots", mine: "2", dflt: "1" },
  { k: "milk", mine: '"oat"', dflt: '"none"' },
  { k: "sugar", mine: "1", dflt: "0" },
  { k: "iced", mine: "true", dflt: "false" },
  { k: "decaf", mine: "true", dflt: "false" },
];

export function BuilderVsTelescope() {
  const [on, setOn] = useState<Set<string>>(() => new Set(["iced"]));
  const toggle = (k: string) =>
    setOn((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const last = OPTS.reduce((acc, o, i) => (on.has(o.k) ? i : acc), -1);
  const args = OPTS.slice(0, last + 1);
  const wasted = args.filter((o) => !on.has(o.k)).length;

  return (
    <div className="@container grid gap-5">
      <div className="grid grid-cols-[11ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3 text-13">
        <span className="text-12 text-faint">you want =</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="options you care about">
          <span className="word" aria-pressed="true" aria-disabled title="required">
            350ml
          </span>
          {OPTS.map((o) => (
            <button key={o.k} className="word" aria-pressed={on.has(o.k)} onClick={() => toggle(o.k)}>
              {o.k}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 @[640px]:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-12">
            <span className="text-dead">telescoping constructor</span>
            <span className="text-faint tabular">{args.length + 1} args</span>
          </div>
          <div className="min-h-[92px] overflow-x-auto rounded-md bg-bg px-4 py-3 text-13 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line-2)]">
            <span className="whitespace-nowrap">
              <Java code="new Coffee(" />
              <span className="text-hi">350</span>
              {args.map((o) => (
                <span key={o.k}>
                  <Java code=", " />
                  {on.has(o.k) ? (
                    <span className="text-hi">{o.mine}</span>
                  ) : (
                    <span
                      className="rounded-[1px] px-0.5 text-dead"
                      style={{ background: "color-mix(in srgb, var(--dead) 14%, transparent)" }}
                      title={`${o.k}: you didn't ask for this`}
                    >
                      {o.dflt}
                    </span>
                  )}
                </span>
              ))}
              <Java code=")" />
            </span>
            <div className="mt-2 font-serif text-[0.98rem] leading-[1.5] text-mute" aria-live="polite">
              {wasted === 0 ? (
                last < 0 ? (
                  "just the size. this one is fine."
                ) : (
                  "every argument is one you asked for. lucky ordering."
                )
              ) : (
                <>
                  <span className="text-dead">{wasted}</span> value{wasted > 1 ? "s" : ""} you had to pass anyway, in exactly the
                  right order. the compiler only checks the types.
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-12">
            <span className="text-live">builder</span>
            <span className="text-faint tabular">
              {on.size} call{on.size === 1 ? "" : "s"}
            </span>
          </div>
          <div className="min-h-[92px] overflow-x-auto rounded-md bg-bg px-4 py-3 text-13 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="whitespace-pre">
              <Java code="Coffee.ofSize(350)" />
            </div>
            {OPTS.filter((o) => on.has(o.k)).map((o) => (
              <div key={o.k} className="whitespace-pre">
                <Java code={`    .${o.k}(${o.k === "iced" || o.k === "decaf" ? "" : o.mine})`} />
              </div>
            ))}
            <div className="whitespace-pre">
              <Java code="    .build();" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
