"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration } from "./kit";

// building "hi " + name + ", you have " + n + " messages" (name = "ada", n = 3) two ways,
// following the jdk 25 source:
//   StringBuilder: starts at 16 bytes, grows to (old << 1) + 2 = 34 when ", you have "
//   doesn't fit, and toString() copies into a fresh byte[27].
//   the generated concat (java.lang.String$$StringConcat, dumped with
//   -Djava.lang.invoke.StringConcatFactory.dump=true): sums the lengths, allocates one
//   byte[27] with the suffix already in place, prepends the rest back to front, then
//   hands the array to String without copying.
// measured per call, interpreted (-Xint): 186 bytes allocated vs 74.

const FULL = "hi ada, you have 3 messages"; // 27

type Arr = { size: number; text: string; from?: number; dead?: boolean; label: string; fresh?: [number, number] };
type S = { sb: Arr[]; cc: Arr[]; ccLen?: string; note: string };

const pad = (s: string, size: number, from = 0) => {
  const a = new Array(size).fill("");
  for (let i = 0; i < s.length; i++) a[from + i] = s[i];
  return a;
};

const STEPS: S[] = [
  { sb: [], cc: [], note: "same expression, two compilations. left: what javac 8 emitted (and what -XDstringConcat=inline still emits). right: what jdk 25 generates behind the invokedynamic." },
  {
    sb: [{ size: 16, text: "", label: "byte[16]" }],
    cc: [],
    ccLen: "3 + 3 + 11 + 1 + 9 = 27",
    note: "new StringBuilder() grabs a 16-byte buffer and hopes for the best. the generated concat asks every piece for its length first: 27 bytes, exactly.",
  },
  {
    sb: [{ size: 16, text: "hi ada", label: "byte[16]", fresh: [0, 6] }],
    cc: [{ size: 27, text: " messages", from: 18, label: "byte[27]", fresh: [18, 27] }],
    ccLen: "27",
    note: "append, append. meanwhile the concat allocates its one and only array, with the last constant already copied into the end.",
  },
  {
    sb: [
      { size: 16, text: "hi ada", label: "byte[16]", dead: true },
      { size: 34, text: "hi ada, you have ", label: "byte[34]", fresh: [6, 17] },
    ],
    cc: [{ size: 27, text: "3 messages", from: 17, label: "byte[27]", fresh: [17, 18] }],
    ccLen: "27",
    note: '", you have " needs 17 bytes and there are 16. the builder allocates (16 × 2) + 2 = 34, copies the 6 it had, and the old buffer is garbage. the concat prepends "3", writing backwards from the end.',
  },
  {
    sb: [
      { size: 34, text: "hi ada, you have 3 messages", label: "byte[34]", fresh: [17, 27] },
    ],
    cc: [{ size: 27, text: ", you have 3 messages", from: 6, label: "byte[27]", fresh: [6, 17] }],
    ccLen: "27",
    note: "the builder fits the rest, with 7 bytes of slack. the concat keeps prepending, right to left, straight into the final array.",
  },
  {
    sb: [
      { size: 34, text: FULL, label: "byte[34]", dead: true },
      { size: 27, text: FULL, label: "byte[27] (toString copy)", fresh: [0, 27] },
    ],
    cc: [{ size: 27, text: FULL, label: "byte[27] → new String(buf, coder)", fresh: [0, 6] }],
    ccLen: "27",
    note: "toString() can't hand out its own buffer (you might keep appending), so it copies all 27 bytes into a new array. the concat is done: the String takes its array as is, no copy.",
  },
  {
    sb: [{ size: 27, text: FULL, label: "byte[27]" }],
    cc: [{ size: 27, text: FULL, label: "byte[27]" }],
    ccLen: "27",
    note: "same String, very different paths: three arrays and two copies versus one array and zero copies. measured per call in the interpreter, 186 bytes allocated versus 74.",
  },
];

export function ExactSize() {
  const s = useStepper(STEPS.length, { interval: 2400 });
  const st = STEPS[s.i];
  const sbAllocs = [16, 34, 27].slice(0, s.i === 0 ? 0 : s.i < 3 ? 1 : s.i < 5 ? 2 : 3);
  const ccAllocs = s.i >= 2 ? [27] : [];

  return (
    <div {...s.keys} className="@container outline-none" aria-label="StringBuilder versus the generated concat, step by step">
      <div className="mb-4 truncate text-12 text-mute">
        <span className="text-ink">&quot;hi &quot; + name + &quot;, you have &quot; + n + &quot; messages&quot;</span>
        <span className="text-faint"> · name = &quot;ada&quot;, n = 3</span>
      </div>
      <div className="grid gap-5 @[720px]:grid-cols-2">
        <Lane
          title="StringBuilder chain"
          sub="javac 8, or -XDstringConcat=inline"
          arrays={st.sb}
          allocs={sbAllocs}
          head={s.i === 0 ? undefined : <>capacity = <span className="text-hi">{s.i >= 3 ? 34 : 16}</span>, a guess</>}
        />
        <Lane
          title="generated concat"
          sub="jdk 25, behind invokedynamic"
          arrays={st.cc}
          allocs={ccAllocs}
          head={st.ccLen ? <>length = <span className="text-hi">{st.ccLen}</span></> : undefined}
        />
      </div>
      <Narration className="mt-5">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

function Lane({ title, sub, arrays, allocs, head }: { title: string; sub: string; arrays: Arr[]; allocs: number[]; head?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-bg px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-12 text-hi">{title}</span>
        <span className="text-11 text-faint">{sub}</span>
      </div>
      <div className="mt-1 min-h-[1.5em] text-11 text-mute">{head ?? <span className="text-faint">·</span>}</div>
      <div className="mt-2 grid min-h-[104px] content-start gap-2.5">
        {arrays.length === 0 && <div className="text-11 text-faint">nothing allocated yet</div>}
        {arrays.map((a, i) => (
          <div key={`${a.label}-${i}`} className="obj-in">
            <div className={`mb-0.5 text-[10px] ${a.dead ? "text-dead" : "text-faint"}`}>
              {a.label}
              {a.dead && " · garbage"}
            </div>
            <div className="flex">
              {pad(a.text, a.size, a.from ?? 0).map((c, j) => {
                const fresh = a.fresh && j >= a.fresh[0] && j < a.fresh[1];
                return (
                  <span
                    key={j}
                    className="-ml-px flex h-[18px] min-w-0 flex-1 items-center justify-center text-[9px] first:ml-0 @[400px]:text-[10px]"
                    style={{
                      maxWidth: 14,
                      boxShadow: `inset 0 0 0 1px ${a.dead ? "color-mix(in srgb, var(--dead) 45%, transparent)" : "var(--line-2)"}`,
                      background: fresh ? "color-mix(in srgb, var(--hot) 16%, transparent)" : undefined,
                      color: a.dead ? "var(--dead)" : fresh ? "var(--hot)" : c === "" ? "var(--faint)" : "var(--hi)",
                      opacity: a.dead ? 0.6 : 1,
                    }}
                  >
                    {c === " " ? "·" : c}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-2 text-11 text-faint tabular">
        arrays allocated: <span className="text-ink">{allocs.length ? allocs.map((n) => `byte[${n}]`).join(" + ") : "none"}</span>
      </div>
    </div>
  );
}
