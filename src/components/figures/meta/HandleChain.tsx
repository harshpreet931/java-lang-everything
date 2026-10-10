"use client";

import { useState } from "react";

// a method handle built out of other method handles, stage by stage. the types and the
// final results match the chapter's Combo program on jdk 25:
//   shout.invokeExact("ada") → "HELLO, ADA", size.invokeExact("ada") → 10, size.type() → (String)int

type Stage = { name: string; code: string; type: string; run: (s: string) => string | number; note: string };

const STAGES: Stage[] = [
  {
    name: "concat",
    code: 'lookup.findVirtual(String.class, "concat", methodType(String.class, String.class))',
    type: "(String,String)String",
    run: (s) => `hello, ${s}`,
    note: "a direct handle to String.concat. it's an instance method, so the receiver becomes the first parameter: two Strings in, one out.",
  },
  {
    name: "hello",
    code: 'MethodHandles.insertArguments(concat, 0, "hello, ")',
    type: "(String)String",
    run: (s) => `hello, ${s}`,
    note: "insertArguments bakes a value into parameter 0. the receiver is now always \"hello, \", and the handle takes one String. (bindTo does the same for just the receiver.)",
  },
  {
    name: "shout",
    code: "MethodHandles.filterReturnValue(hello, upper)",
    type: "(String)String",
    run: (s) => `hello, ${s}`.toUpperCase(),
    note: "filterReturnValue pipes the result through another handle, here String.toUpperCase. the types have to line up: hello returns a String, upper takes one.",
  },
  {
    name: "size",
    code: "MethodHandles.filterReturnValue(shout, length)",
    type: "(String)int",
    run: (s) => `hello, ${s}`.length,
    note: "one more filter, String.length, and the return type changes to int. the whole chain is a single MethodHandle that the JIT can inline end to end, when it's a constant.",
  },
];

export function HandleChain() {
  const [name, setName] = useState("ada");
  const [at, setAt] = useState(3);
  const st = STAGES[at];
  const result = st.run(name);

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3 text-13">
        <label htmlFor="hc-in" className="text-12 text-faint">
          invokeExact(
        </label>
        <input
          id="hc-in"
          value={name}
          maxLength={14}
          onChange={(e) => setName(e.target.value.replace(/["\\]/g, ""))}
          className="w-[16ch] rounded-xs bg-well px-2 py-1 text-13 text-hi shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus:shadow-[inset_0_0_0_1px_var(--hot)]"
          aria-label="argument"
        />
        <span className="text-12 text-faint">)</span>
      </div>

      <ol className="mt-4 flex flex-col gap-0">
        {STAGES.map((x, i) => {
          const on = i === at;
          const reached = i <= at;
          return (
            <li key={x.name}>
              {i > 0 && (
                <div className="flex h-5 items-center pl-4 text-11 text-ref" aria-hidden>
                  ↓
                </div>
              )}
              <button
                onClick={() => setAt(i)}
                aria-pressed={on}
                className="grid w-full grid-cols-1 gap-x-4 gap-y-1 rounded-md bg-well px-3 py-2 text-left transition-[box-shadow,opacity] duration-200 ease-jle @[560px]:grid-cols-[9ch_minmax(0,1fr)_auto]"
                style={{
                  boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
                  opacity: reached ? 1 : 0.5,
                }}
              >
                <span className="text-13" style={{ color: on ? "var(--hot)" : "var(--hi)" }}>
                  {x.name}
                </span>
                <span className="min-w-0 text-11 break-words text-mute">{x.code}</span>
                <span className="text-12 text-meta tabular">{x.type}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-13">
        <span className="text-faint">
          {st.name}.invokeExact({at === 0 ? '"hello, ", ' : ""}&quot;{name}&quot;) →
        </span>
        <span className="text-live">{typeof result === "number" ? result : `"${result}"`}</span>
      </div>
      <p className="mt-3 min-h-[4.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
    </div>
  );
}
