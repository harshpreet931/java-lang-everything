"use client";

import { useState } from "react";
import { Java, Narration } from "./kit";

// item 36. toggle styles. an int bit field and an EnumSet store exactly the same bits:
// RegularEnumSet (64 constants or fewer) is one long called `elements`, bit i = ordinal i.
// the difference is everything around the bits: types, names, and toString.

const STYLES = ["BOLD", "ITALIC", "UNDERLINE", "STRIKE", "CODE", "MARK"] as const;
const W = 8; // bits drawn

export function EnumSetBits() {
  const [on, setOn] = useState<number>(0b11);
  const [last, setLast] = useState<number | null>(null);
  const flip = (i: number) => {
    setOn((x) => x ^ (1 << i));
    setLast(i);
  };
  const chosen = STYLES.filter((_, i) => on & (1 << i));

  const bits = (
    <div className="flex" aria-hidden>
      {Array.from({ length: W }, (_, k) => {
        const i = W - 1 - k; // msb on the left
        const set = (on >> i) & 1;
        const hot = last === i;
        return (
          <div key={i} className="flex w-8 flex-col items-center">
            <span
              className="-ml-px flex h-9 w-full items-center justify-center text-13 tabular transition-[background-color,box-shadow,color] duration-200"
              style={{
                background: hot ? "color-mix(in srgb, var(--hot) 14%, var(--bg))" : "var(--bg)",
                boxShadow: `inset 0 0 0 1px ${hot ? "var(--hot)" : "var(--line-2)"}`,
                color: set ? "var(--hi)" : "var(--faint)",
                zIndex: hot ? 1 : 0,
              }}
            >
              {set}
            </span>
            <span className="mt-1 text-[10px] leading-3 text-faint tabular">{i}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="@container grid gap-5">
      <div className="grid gap-2 border-b border-line pb-3 @[560px]:grid-cols-[8ch_minmax(0,1fr)] @[560px]:items-center">
        <span className="text-12 text-faint">style =</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="styles">
          {STYLES.map((s, i) => (
            <button key={s} className="word" aria-pressed={!!(on & (1 << i))} onClick={() => flip(i)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 @[640px]:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 text-12 text-dead">int bit field</div>
          {bits}
          <div className="mt-3 overflow-x-auto rounded-md bg-bg px-3.5 py-2.5 text-12 leading-[1.8] whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div>
              <Java code={`int style = ${chosen.length ? chosen.join(" | ") : "0"};`} />
            </div>
            <div className="text-faint">
              println → <span className="text-hi">{on}</span>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-12 text-live">EnumSet (RegularEnumSet.elements)</div>
          {bits}
          <div className="mt-3 overflow-x-auto rounded-md bg-bg px-3.5 py-2.5 text-12 leading-[1.8] whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div>
              <Java code={`var style = ${chosen.length ? `EnumSet.of(${chosen.join(", ")})` : "EnumSet.noneOf(Style.class)"};`} />
            </div>
            <div className="text-faint">
              println → <span className="text-hi">[{chosen.join(", ")}]</span>
            </div>
          </div>
        </div>
      </div>

      <Narration>
        same bits, same speed: <code className="font-mono text-[0.9em]">contains</code> is a mask,{" "}
        <code className="font-mono text-[0.9em]">addAll</code> is an OR. but the int accepts any int (pass it a
        port number, it compiles), prints as {on}, and can&apos;t be iterated by name.
      </Narration>
    </div>
  );
}
