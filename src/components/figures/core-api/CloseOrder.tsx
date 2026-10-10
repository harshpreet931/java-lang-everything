"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Narr } from "./kit";

// try (var a = new Res("A"); var b = new Res("B"); var c = new Res("C")) { body } catch ... finally ...
// every event list below is the real stdout of that program on jdk 25, one scenario per run.

type Ev = { text: string; kind?: "open" | "close" | "body" | "throw" | "catch" | "finally"; res?: "A" | "B" | "C" };
type Sc = { id: string; label: string; events: Ev[]; primary?: string; suppressed?: string[] };

const o = (r: "A" | "B" | "C"): Ev => ({ text: `open ${r}`, kind: "open", res: r });
const c = (r: "A" | "B" | "C"): Ev => ({ text: `close ${r}`, kind: "close", res: r });
const BODY: Ev = { text: "body", kind: "body" };
const FIN: Ev = { text: "finally", kind: "finally" };

const SCENARIOS: Sc[] = [
  { id: "ok", label: "all good", events: [o("A"), o("B"), o("C"), BODY, c("C"), c("B"), c("A"), FIN] },
  {
    id: "body",
    label: "body throws",
    events: [o("A"), o("B"), o("C"), BODY, { text: "body → throws", kind: "throw" }, c("C"), c("B"), c("A"), { text: "catch: body", kind: "catch" }, FIN],
    primary: "body",
  },
  {
    id: "both",
    label: "body throws, then B.close() throws",
    events: [
      o("A"),
      o("B"),
      o("C"),
      BODY,
      { text: "body → throws", kind: "throw" },
      c("C"),
      { text: "close B → throws", kind: "throw", res: "B" },
      c("A"),
      { text: "catch: body, suppressed [close B]", kind: "catch" },
      FIN,
    ],
    primary: "body",
    suppressed: ["close B"],
  },
  {
    id: "open",
    label: "C's constructor throws",
    events: [o("A"), o("B"), { text: "open C → throws", kind: "throw", res: "C" }, c("B"), c("A"), { text: "catch: open C", kind: "catch" }, FIN],
    primary: "open C",
  },
];

const CODE = `try (var a = new Res("A");
     var b = new Res("B");
     var c = new Res("C")) {
    body();
} catch (IllegalStateException e) {
    log(e);
} finally {
    IO.println("finally");
}`;

const lineFor = (e: Ev): number => {
  if (e.kind === "open" || (e.kind === "throw" && e.text.startsWith("open"))) return e.res === "A" ? 1 : e.res === "B" ? 2 : 3;
  if (e.kind === "body" || (e.kind === "throw" && e.text.startsWith("body"))) return 4;
  if (e.kind === "close" || (e.kind === "throw" && e.text.startsWith("close"))) return 5;
  if (e.kind === "catch") return 6;
  return 8;
};

export function CloseOrder() {
  const [id, setId] = useState("both");
  const sc = SCENARIOS.find((s) => s.id === id)!;
  const s = useStepper(sc.events.length, { interval: 900 });
  useEffect(() => {
    s.go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const i = Math.min(s.i, sc.events.length - 1);
  const done = sc.events.slice(0, i + 1);

  // resource state after the events so far
  const state = (r: "A" | "B" | "C") => {
    let st: "idle" | "open" | "closed" | "failed" = "idle";
    for (const e of done) {
      if (e.res !== r) continue;
      if (e.kind === "open") st = "open";
      else if (e.kind === "close") st = "closed";
      else if (e.kind === "throw") st = e.text.startsWith("open") ? "failed" : "closed";
    }
    return st;
  };
  const closeFailed = (r: string) => done.some((e) => e.res === r && e.kind === "throw" && e.text.startsWith("close"));
  const cur = sc.events[i];
  const end = i === sc.events.length - 1;
  const caught = done.some((e) => e.kind === "catch");

  return (
    <div {...s.keys} className="@container grid gap-4 font-mono outline-none">
      <div className="flex flex-wrap gap-1" role="group" aria-label="scenario">
        {SCENARIOS.map((x) => (
          <button key={x.id} className="word text-left" aria-pressed={x.id === id} onClick={() => setId(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <CodePanel file="Main.java" code={CODE} hot={[lineFor(cur)]} />

        <div className="grid content-start gap-3">
          {/* the resources, opened bottom-up like a stack */}
          <div className="flex flex-col-reverse gap-1.5">
            {(["A", "B", "C"] as const).map((r) => {
              const st = state(r);
              const failed = st === "failed" || closeFailed(r);
              return (
                <div
                  key={r}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-12 transition-[box-shadow,opacity] duration-200"
                  style={{
                    opacity: st === "idle" ? 0.35 : st === "closed" && !failed ? 0.55 : 1,
                    boxShadow: `inset 0 0 0 1px ${failed ? "var(--dead)" : st === "open" ? "var(--hi)" : "var(--line-2)"}`,
                  }}
                >
                  <span className={failed ? "text-dead" : "text-hi"}>Res {r}</span>
                  <span className={failed ? "text-dead" : "text-faint"}>
                    {st === "idle" ? "not opened" : st === "open" ? "open" : st === "failed" ? "constructor threw" : failed ? "close() threw" : "closed"}
                  </span>
                </div>
              );
            })}
          </div>

          <ol className="grid gap-0.5 rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)]" aria-label="stdout so far">
            {done.map((e, k) => (
              <li
                key={k}
                className={k === i ? "text-hot" : ""}
                style={{ color: k === i ? undefined : e.kind === "throw" ? "var(--dead)" : "var(--mute)" }}
              >
                {e.text}
              </li>
            ))}
          </ol>

          {caught && sc.primary && (
            <div className="rounded-md px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--dead)]">
              <div className="text-dead">e: IllegalStateException(&quot;{sc.primary}&quot;)</div>
              {sc.suppressed?.map((x) => (
                <div key={x} className="mt-1 pl-4 text-dead/80">
                  ↳ getSuppressed()[0]: IllegalStateException(&quot;{x}&quot;)
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Narr className="min-h-[3.2em]">{note(sc, cur, end)}</Narr>
      <StepControls s={s} />
    </div>
  );
}

function note(sc: Sc, e: Ev, end: boolean): string {
  if (end && sc.id === "ok") return "nothing threw. resources were closed C, B, A (reverse order of opening), then finally ran.";
  if (e.kind === "open") return `${e.res} is created and assigned. from now on, it will be closed no matter what.`;
  if (e.kind === "body") return "all three are open. the body runs.";
  if (e.kind === "throw" && e.text.startsWith("body")) return "the body throws. before any catch runs, every resource that was opened gets closed, newest first.";
  if (e.kind === "throw" && e.text.startsWith("open")) return "C's constructor throws, so there's no C to close. but A and B were opened, so they still get closed.";
  if (e.kind === "throw" && e.text.startsWith("close"))
    return sc.primary === "body"
      ? "B's close() throws too. it doesn't replace the body's exception: it's attached to it as a suppressed exception. closing carries on with A."
      : "B's close() throws. closing carries on with A anyway.";
  if (e.kind === "close") return `${e.res}.close() runs.`;
  if (e.kind === "catch")
    return sc.suppressed ? "the catch sees the body's exception, the one that matters, with B's failure tucked inside getSuppressed()." : "only now does the catch run. the resources are already closed.";
  return "finally runs last, after the resources and after the catch.";
}
