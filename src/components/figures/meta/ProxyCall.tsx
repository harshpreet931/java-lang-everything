"use client";

import { useEffect, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Row, Words } from "./kit";

// one call through a JDK dynamic proxy, as a sequence diagram. the generated method body
// ($Proxy0.greet: getfield h, getstatic m3, anewarray, invokeinterface InvocationHandler.invoke,
// checkcast String) is from javap on the class jdk 25 generated for the chapter's Greeter.
// the console lines are the real output of the chapter's program.

const LANES = ["main", "$Proxy0", "handler", "RealGreeter"] as const;

type Msg = { from: number; to: number; label: string; back?: boolean; tone?: "ref" | "dead" | "meta" | "live"; out?: string; note: string };

const FLOWS: Record<string, Msg[]> = {
  greet: [
    { from: 0, to: 1, label: 'g.greet("ada")', tone: "ref", note: "main calls greet on a Greeter. it has no idea the object is a $Proxy0, a class the JVM generated at runtime that implements Greeter." },
    { from: 1, to: 2, label: "h.invoke(this, m3, {\"ada\"})", tone: "meta", note: "every method of the proxy has the same body: box the arguments into an Object[], and hand them to the InvocationHandler together with a cached Method object (m3 is Greeter.greet)." },
    { from: 2, to: 2, label: "log it", out: "→ greet [ada]", note: "the handler is your code. it can log, check permissions, start a transaction, retry, time the call, or decide never to call anything at all." },
    { from: 2, to: 3, label: "method.invoke(real, args)", tone: "ref", note: "to actually do the work, the handler forwards the call to the real object, by reflection." },
    { from: 3, to: 2, label: '"hi ada"', back: true, note: "RealGreeter returns normally. the handler gets it back as an Object." },
    { from: 2, to: 2, label: "log it", out: "← hi ada", note: "after-advice: the handler sees the result too, and could replace it." },
    { from: 2, to: 1, label: "return result", back: true, note: "the handler returns an Object. it has to be the right type: return a String from greet, or an Integer from count, or the cast in the next step fails." },
    { from: 1, to: 0, label: "(String) result", back: true, tone: "live", note: "the generated method casts the Object back to String (checkcast) and returns it. main got its answer and never saw any of this." },
  ],
  tostr: [
    { from: 0, to: 1, label: "g.toString()", tone: "ref", note: "toString isn't in Greeter. surely it skips the handler?" },
    { from: 1, to: 2, label: "h.invoke(this, m2, null)", tone: "meta", note: "nope. the proxy also routes equals, hashCode and toString through the handler (m0, m1, m2 in the generated class). no arguments means args is null, not an empty array." },
    { from: 2, to: 2, label: "log it", out: "→ toString null", note: "a handler that assumes it only sees interface methods gets surprised here. one that returns null for unknown methods makes toString() return null, and a hashCode() that returns null throws a NullPointerException when unboxed." },
    { from: 2, to: 3, label: "method.invoke(real, null)", tone: "ref", note: "this handler forwards everything, so the real object's toString runs." },
    { from: 3, to: 2, label: '"Main$RealGreeter@…"', back: true, note: "Object.toString on the target." },
    { from: 2, to: 1, label: "return result", back: true, note: "back through the handler." },
    { from: 1, to: 0, label: "(String) result", back: true, tone: "live", note: "printing a proxy prints the target. handy for debugging, surprising the first time." },
  ],
  throws: [
    { from: 0, to: 1, label: 'g.greet(null)', tone: "ref", note: "suppose RealGreeter.greet throws IllegalArgumentException for a null name." },
    { from: 1, to: 2, label: "h.invoke(this, m3, {null})", tone: "meta", note: "same path in." },
    { from: 2, to: 3, label: "method.invoke(real, args)", tone: "ref", note: "the handler forwards the call." },
    { from: 3, to: 2, label: "InvocationTargetException", back: true, tone: "dead", note: "reflection wraps whatever the target threw in an InvocationTargetException. if the handler lets that escape, the caller sees the wrong exception." },
    { from: 2, to: 1, label: "throw e.getCause()", back: true, tone: "dead", note: "a correct handler unwraps it and rethrows the cause. (a checked exception the interface method doesn't declare would get wrapped again, in an UndeclaredThrowableException.)" },
    { from: 1, to: 0, label: "IllegalArgumentException", back: true, tone: "dead", note: "now main sees exactly what it would have seen without the proxy. transparent proxies are mostly about getting this part right." },
  ],
};

export function ProxyCall() {
  const [flow, setFlow] = useState<keyof typeof FLOWS>("greet");
  const msgs = FLOWS[flow];
  const s = useStepper(msgs.length, { interval: 2200 });
  const { reset } = s;
  useEffect(() => reset(), [flow, reset]);
  const shown = msgs.slice(0, s.i + 1);
  const out = shown.filter((m) => m.out).map((m) => m.out);
  const colX = (i: number) => `${12.5 + i * 25}%`;

  return (
    <div {...s.keys} className="@container outline-none">
      <Row k="call =" w="6ch">
        <Words
          options={[
            { v: "greet", label: 'g.greet("ada")' },
            { v: "tostr", label: "g.toString()" },
            { v: "throws", label: "the target throws" },
          ]}
          value={flow}
          onChange={(v) => setFlow(v)}
          label="which call"
        />
      </Row>

      <div className="relative mt-4 overflow-hidden" role="img" aria-label={`sequence diagram, step ${s.i + 1}: ${msgs[s.i].label}`}>
        <div className="grid grid-cols-4 text-center text-11 @[520px]:text-12">
          {LANES.map((l, i) => (
            <div key={l} className="px-0.5">
              <span
                className="inline-block max-w-full truncate rounded-xs px-1.5 py-1"
                style={{
                  color: i === 1 || i === 2 ? "var(--meta)" : "var(--hi)",
                  boxShadow: "inset 0 0 0 1px var(--line-2)",
                }}
              >
                {l}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-1" style={{ height: msgs.length * 34 + 8 }}>
          {LANES.map((l, i) => (
            <div key={l} className="absolute inset-y-0 w-px bg-line-2" style={{ left: colX(i) }} />
          ))}
          {shown.map((m, k) => {
            const y = k * 34 + 18;
            const current = k === s.i;
            const c = m.tone ? `var(--${m.tone})` : "var(--ink)";
            if (m.from === m.to) {
              return (
                <div key={k} className="absolute text-[10px] @[520px]:text-11" style={{ top: y - 9, left: `calc(${colX(m.from)} + 6px)` }}>
                  <span
                    className="rounded-xs px-1 py-0.5"
                    style={{ boxShadow: `inset 0 0 0 1px ${current ? "var(--hot)" : "var(--line-2)"}`, color: current ? "var(--hot)" : "var(--mute)" }}
                  >
                    {m.label}
                  </span>
                </div>
              );
            }
            const l = Math.min(m.from, m.to);
            const r = Math.max(m.from, m.to);
            const rightward = m.to > m.from;
            return (
              <div key={k} className="absolute" style={{ top: y, left: colX(l), width: `${(r - l) * 25}%` }}>
                <div
                  className="relative h-px"
                  style={{
                    background: m.back
                      ? `repeating-linear-gradient(to right, ${current ? "var(--hot)" : c} 0 5px, transparent 5px 9px)`
                      : current
                        ? "var(--hot)"
                        : c,
                    opacity: m.back && !current ? 0.75 : 1,
                  }}
                >
                  <span
                    className="absolute -top-[6px] text-[10px] leading-none"
                    style={{ [rightward ? "right" : "left"]: -2, color: current ? "var(--hot)" : c }}
                  >
                    {rightward ? "▶" : "◀"}
                  </span>
                </div>
                <div
                  className="absolute -top-[15px] inset-x-1 truncate text-center text-[10px] @[520px]:text-11"
                  style={{ color: current ? "var(--hot)" : m.tone === "dead" ? "var(--dead)" : "var(--mute)" }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1 text-12 break-words text-hot" aria-hidden>
        {(() => {
          const m = msgs[s.i];
          if (m.from === m.to) return `${LANES[m.from]}: ${m.label}`;
          return `${LANES[m.from]} ${m.back ? "returns to" : "→"} ${LANES[m.to]}: ${m.label}`;
        })()}
      </div>
      <pre className="mt-2 min-h-[3.6em] overflow-x-auto rounded-md bg-well px-3 py-2 text-12 leading-[1.6] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">stdout{"\n"}</span>
        {out.join("\n")}
      </pre>
      <p className="mt-3 min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {msgs[s.i].note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
