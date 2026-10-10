"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";

// a real run of Shop.java on jdk 25 with -Xlog:class+load=info,class+init=info.
// the log lines are copied from that run (paths shortened). each step shows
// which phase each class has reached, and the log lines that prove it.

type Phase = 0 | 1 | 2 | 3; // not loaded, loaded, linked, initialized
type St = { line: number; shop: Phase; base: Phase; price: Phase; tax?: number; log: string[]; out: string[]; note: string; hot: ("shop" | "base" | "price")[] };



const STEPS: St[] = [
  {
    line: 11,
    shop: 3,
    base: 0,
    price: 0,
    hot: ["shop"],
    log: [
      "[0.017s] class,load  Shop source: file:.../",
      "[0.018s] class,init  Start class verification for: Shop",
      "[0.018s] class,init  End class verification for: Shop",
      "[0.018s] class,init  298 Initializing 'Shop'(no method)",
    ],
    out: [],
    note: "before main can run, Shop is loaded, verified and initialized. \"(no method)\" means it has no static initializer to run. it's the 298th class initialized: the JDK did the other 297.",
  },
  { line: 12, shop: 3, base: 0, price: 0, hot: [], log: [], out: ["main starts"], note: "Base and Price don't exist yet as far as the JVM is concerned. nothing has asked for them." },
  {
    line: 13,
    shop: 3,
    base: 1,
    price: 1,
    hot: ["base", "price"],
    log: ["[0.018s] class,load  Base source: file:.../", "[0.018s] class,load  Price source: file:.../"],
    out: [],
    note: "an array of Price needs the class Price, and Price needs its superclass, so both get loaded. Base first. neither is verified or initialized.",
  },
  { line: 14, shop: 3, base: 1, price: 1, hot: [], log: [], out: ["made an array"], note: "still not initialized. the array exists; no Price object does." },
  {
    line: 15,
    shop: 3,
    base: 2,
    price: 2,
    tax: 0,
    hot: ["base", "price"],
    log: [
      "[0.018s] class,init  Start class verification for: Base",
      "[0.018s] class,init  End class verification for: Base",
      "[0.018s] class,init  Start class verification for: Price",
      "[0.018s] class,init  End class verification for: Price",
    ],
    out: [],
    note: "getstatic Price.tax is a first active use. the JVM links both classes first: verify the bytecode, and prepare the statics (tax exists now, as 0).",
  },
  {
    line: 15,
    shop: 3,
    base: 3,
    price: 2,
    tax: 0,
    hot: ["base"],
    log: ["[0.018s] class,init  303 Initializing 'Base'"],
    out: ["Base <clinit>"],
    note: "superclass first: Base's <clinit> runs.",
  },
  {
    line: 15,
    shop: 3,
    base: 3,
    price: 3,
    tax: 18,
    hot: ["price"],
    log: ["[0.018s] class,init  304 Initializing 'Price'"],
    out: ["Price <clinit>"],
    note: "then Price's <clinit>: tax = 18, then the static block, in source order. only now can getstatic read the field.",
  },
  { line: 15, shop: 3, base: 3, price: 3, tax: 18, hot: [], log: [], out: ["tax = 18"], note: "18. every later use of Price skips all of this: initialization happens exactly once." },
];

const PHASES = ["loaded", "linked", "initialized"];

export function ClassLifecycleClient({ lines }: { lines: string[] }) {
  const s = useStepper(STEPS.length, { interval: 2000 });
  const st = STEPS[s.i];
  const log = STEPS.slice(0, s.i + 1).flatMap((x, k) => x.log.map((l) => ({ l, cur: k === s.i })));
  const out = STEPS.slice(0, s.i + 1).flatMap((x, k) => x.out.map((l) => ({ l, cur: k === s.i })));

  const row = (key: "shop" | "base" | "price", name: string, phase: Phase, extra?: React.ReactNode) => {
    const hot = st.hot.includes(key);
    return (
      <div
        className="rounded-md bg-well px-3 py-2.5 transition-[box-shadow] duration-200"
        style={{ boxShadow: `inset 0 0 0 1px ${hot ? "var(--hot)" : "var(--line-2)"}` }}
      >
        <div className="flex items-baseline justify-between gap-3 text-13">
          <span className={phase === 0 ? "text-faint" : "text-hi"}>{name}</span>
          <span className="text-11 text-faint">{extra}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {PHASES.map((p, i) => {
            const reached = phase >= i + 1;
            const done = phase === 3 && i === 2;
            return (
              <span
                key={p}
                className="rounded-md px-1.5 py-1 text-center text-11 transition-colors duration-200"
                style={{
                  boxShadow: `inset 0 0 0 1px ${reached ? (done ? "var(--live)" : "var(--ink)") : "var(--line)"}`,
                  color: reached ? (done ? "var(--live)" : "var(--hi)") : "var(--faint)",
                }}
              >
                {p}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div {...s.keys} className="@container outline-none">
      <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">Shop.java</div>
          <div className="overflow-x-auto py-2.5">
            <ol className="min-w-max text-12 leading-[1.8]">
              {lines.map((html, i) => {
                const cur = i + 1 === st.line;
                return (
                  <li
                    key={i}
                    className={`grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 transition-colors duration-200 ${
                      cur ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent"
                    }`}
                  >
                    <span className={`text-right tabular ${cur ? "text-hot" : "text-faint/60"}`}>{i + 1}</span>
                    <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html || " " }} />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="border-b border-line pb-1.5 text-11 text-faint">classes</div>
          {row("shop", "Shop", st.shop, "no <clinit>")}
          {row("base", "Base", st.base)}
          {row("price", "Price", st.price, st.tax === undefined ? "tax: doesn't exist yet" : `tax = ${st.tax}`)}
          <div className="mt-2 rounded-md bg-well px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="mb-1 text-11 text-faint">stdout</div>
            <pre className="min-h-[1.7em] text-12 leading-[1.7] whitespace-pre-wrap">
              {out.length === 0 && <span className="text-faint">·</span>}
              {out.map((o, k) => (
                <div key={k} className={o.cur ? "text-hot" : "text-ink"}>
                  {o.l}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-well px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="mb-1 text-11 text-faint">-Xlog:class+load,class+init (the program&apos;s classes only)</div>
        <pre className="min-h-[1.7em] overflow-x-auto text-11 leading-[1.7] whitespace-pre sm:text-12">
          {log.map((o, k) => (
            <div key={k} className={o.cur ? "text-hot" : "text-mute"}>
              {o.l}
            </div>
          ))}
        </pre>
      </div>
      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {st.note}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
