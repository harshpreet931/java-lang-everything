"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java } from "@/components/figures/basics/kit";

// the four parts of a for loop, in the order they actually run:
// init once, then (check → body → update) until the check is false.

type Part = "init" | "cond" | "body" | "update" | "exit";

const PARTS: { id: Exclude<Part, "exit">; code: string }[] = [
  { id: "init", code: "int i = 0" },
  { id: "cond", code: "i < 3" },
  { id: "update", code: "i++" },
  { id: "body", code: "sum += i;" },
];

type Step = { part: Part; i: number | null; sum: number; ok?: boolean; note: string };

function build(): Step[] {
  const s: Step[] = [{ part: "init", i: 0, sum: 0, note: "init runs exactly once, before anything else. i is born here, and it only exists inside the loop." }];
  let i = 0,
    sum = 0;
  for (;;) {
    const ok = i < 3;
    s.push({ part: "cond", i, sum, ok, note: ok ? `check: ${i} < 3 is true, so the body runs.` : `check: ${i} < 3 is false. the loop is over, nothing else in it runs.` });
    if (!ok) break;
    sum += i;
    s.push({ part: "body", i, sum, note: `body: sum += ${i}, so sum is ${sum}.` });
    i++;
    s.push({ part: "update", i, sum, note: `update: i++ runs after the body, every time. i is now ${i}. then straight back to the check.` });
  }
  s.push({ part: "exit", i: null, sum, note: `after the loop: sum is ${sum}, and i is gone (it was scoped to the loop). the check ran 4 times, the body 3.` });
  return s;
}

const STEPS = build();

export function ForAnatomy() {
  const st = useStepper(STEPS.length, { interval: 1100 });
  const cur = STEPS[st.i];
  const log = STEPS.slice(0, st.i + 1);

  const seg = (id: Exclude<Part, "exit">) => {
    const code = PARTS.find((p) => p.id === id)!.code;
    const on = cur.part === id;
    const tone = on ? (id === "cond" ? (cur.ok ? "var(--live)" : "var(--dead)") : "var(--hot)") : null;
    return (
      <span
        className="rounded-[3px] px-0.5 transition-[background-color,box-shadow] duration-150"
        style={{
          background: tone ? `color-mix(in srgb, ${tone} 16%, transparent)` : undefined,
          boxShadow: tone ? `0 0 0 1px color-mix(in srgb, ${tone} 60%, transparent)` : undefined,
        }}
      >
        <Java code={code} />
      </span>
    );
  };

  return (
    <div {...st.keys} className="font-mono text-13 outline-none" aria-label="the parts of a for loop, in order">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-13 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line)]">
          <div>
            <Java code="int sum = 0;" />
          </div>
          <div>
            <Java code="for (" />
            {seg("init")}
            <Java code="; " />
            {seg("cond")}
            <Java code="; " />
            {seg("update")}
            <Java code=") {" />
          </div>
          <div>
            {"    "}
            {seg("body")}
          </div>
          <div>
            <Java code="}" />
          </div>
          <div className={cur.part === "exit" ? "-mx-4 border-l-2 border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)] px-[14px]" : ""}>
            <Java code="IO.println(sum); // 3" />
          </div>
        </pre>
        <div className="grid content-start gap-3">
          <div className="text-12">
            <div className="flex justify-between py-[3px]">
              <span className="text-faint">i</span>
              <span className="tabular text-hi">{cur.i === null ? <span className="text-faint">out of scope</span> : cur.i}</span>
            </div>
            <div className="flex justify-between border-t border-line py-[3px]">
              <span className="text-faint">sum</span>
              <span className="tabular text-hi">{cur.sum}</span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-11 text-faint">what ran, in order</div>
            <div className="flex flex-wrap gap-1">
              {log.map((s, k) => (
                <span
                  key={k}
                  className="rounded-sm px-1.5 text-11 leading-[20px]"
                  style={{
                    color: s.part === "cond" ? (s.ok ? "var(--live)" : "var(--dead)") : k === st.i ? "var(--hot)" : "var(--mute)",
                    boxShadow: `inset 0 0 0 1px ${k === st.i ? "var(--line-2)" : "var(--line)"}`,
                  }}
                >
                  {s.part === "cond" ? (s.ok ? "check ✓" : "check ✗") : s.part}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {cur.note}
      </p>
      <StepControls s={st} className="mt-1" />
    </div>
  );
}
