"use client";

import { useState } from "react";
import { Row } from "./kit";
import * as H from "./hashmapSim";

// the same adds into three sets, three iteration orders.
// HashSet order is computed with the HashMap model (HashSet IS a HashMap), so it matches
// the real thing. LinkedHashSet = insertion order. TreeSet = String.compareTo order
// (utf-16 code units, which is also how js compares strings).

const POOL = ["pear", "apple", "fig", "banana", "kiwi", "mango", "cherry", "date", "lime", "Apple", "plum"];

export function SetOrders() {
  const [added, setAdded] = useState<string[]>(["pear", "apple", "fig", "banana", "kiwi"]);
  const [last, setLast] = useState<{ w: string; ok: boolean } | null>(null);

  let hs = H.empty();
  added.forEach((w, i) => (hs = H.put(hs, w, i).s));
  const hashOrder = H.order(hs).map((e) => e.key);
  const treeOrder = [...added].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const add = (w: string) => {
    const ok = !added.includes(w);
    if (ok) setAdded([...added, w]);
    setLast({ w, ok });
  };

  const rows: { name: string; order: string[]; why: string }[] = [
    { name: "HashSet", order: hashOrder, why: "bucket order. looks random, isn't, can change after a resize." },
    { name: "LinkedHashSet", order: added, why: "insertion order, kept by a linked list." },
    { name: "TreeSet", order: treeOrder, why: "sorted by compareTo. capitals sort before lowercase." },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="add =">
          {POOL.map((w) => (
            <button key={w} className="word !min-h-7 !px-2" aria-pressed={added.includes(w)} onClick={() => add(w)}>
              {w}
            </button>
          ))}
        </Row>
        <Row k="" last>
          <button className="act" onClick={() => (setAdded(["pear", "apple", "fig", "banana", "kiwi"]), setLast(null))}>
            reset
          </button>
          <span className="ml-2 text-12 text-mute" aria-live="polite">
            {last ? (
              <>
                set.add(&quot;{last.w}&quot;) → <span className={last.ok ? "text-live" : "text-dead"}>{String(last.ok)}</span>
                {!last.ok && <span className="font-serif text-15"> already there, so nothing changes.</span>}
              </>
            ) : (
              <span className="text-faint">added so far: {added.join(", ")}</span>
            )}
          </span>
        </Row>
      </div>
      <div className="grid gap-4">
        {rows.map((r) => (
          <div key={r.name} className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-13 text-hi">{r.name}</span>
              <span className="font-serif text-15 text-mute">{r.why}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.order.map((w, i) => (
                <span
                  key={w}
                  className="flex items-baseline gap-1.5 rounded-xs bg-bg px-2 py-1 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]"
                  style={last?.w === w && last.ok ? { boxShadow: "inset 0 0 0 1px var(--hot)", color: "var(--hot)" } : undefined}
                >
                  <span className="text-[9px] text-faint tabular">{i}</span>
                  {w}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
