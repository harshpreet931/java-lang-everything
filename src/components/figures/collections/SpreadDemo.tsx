"use client";

import { useState } from "react";
import { Row } from "./kit";

// why HashMap.hash() folds the high bits down. Integer.hashCode() is the int itself,
// so keys 0, 65536, 131072, ... differ only above bit 16. with a 16-bucket table,
// (n - 1) & h only looks at the low 4 bits: without the spread, every key lands in bucket 0.
// (checked on jdk 25 with reflection: with the real HashMap they land in buckets 0..11.)

const KEYS = Array.from({ length: 12 }, (_, k) => k * 65536);
const N = 16;

export function SpreadDemo() {
  const [on, setOn] = useState(false);
  const idx = (h: number) => (on ? (h ^ (h >>> 16)) & (N - 1) : h & (N - 1));
  const buckets: number[][] = Array.from({ length: N }, () => []);
  KEYS.forEach((k) => buckets[idx(k)].push(k));
  const longest = Math.max(...buckets.map((b) => b.length));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="hash =" last>
          <button className="word" aria-pressed={!on} onClick={() => setOn(false)}>
            h
          </button>
          <button className="word" aria-pressed={on} onClick={() => setOn(true)}>
            h ^ (h &gt;&gt;&gt; 16)
          </button>
        </Row>
      </div>
      <div className="text-12 text-mute">
        keys: <span className="text-ink tabular">0, 65536, 131072, 196608, ... 720896</span> (that&apos;s <code>k &lt;&lt; 16</code>, so the low 16 bits are all zero)
      </div>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-px" role="img" aria-label={`12 keys in 16 buckets. longest chain: ${longest}`}>
        {buckets.map((b, j) => (
          <div key={j} className="flex min-w-0 flex-col items-center">
            <div className="mb-1 text-[9px] text-faint tabular">{j}</div>
            <div className="flex h-[22px] w-full items-center justify-center shadow-[inset_0_0_0_1px_var(--line-2)]">
              {b.length > 0 && <span className="size-[5px] rounded-full bg-ref" />}
            </div>
            <div className="mt-1 flex w-full flex-col items-center gap-[3px]">
              {b.map((k) => (
                <span
                  key={k}
                  className="block h-[7px] w-[70%] rounded-[1px] transition-colors duration-200"
                  style={{ background: b.length > 1 ? "var(--dead)" : "var(--live)" }}
                  title={String(k)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="font-serif text-16 text-mute" aria-live="polite">
        longest chain: <span className={longest > 1 ? "text-dead" : "text-live"}>{longest}</span>.{" "}
        {on
          ? "the high bits got folded into the low ones, so each key has its own bucket. get is one comparison."
          : "the mask only sees the low 4 bits, which are all zero. twelve keys, one bucket, and every get walks the chain."}
      </div>
    </div>
  );
}
