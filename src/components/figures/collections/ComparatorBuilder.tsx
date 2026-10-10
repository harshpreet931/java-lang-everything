"use client";

import { useState } from "react";
import { Row } from "./kit";
import { PEOPLE, codeFor, sortPeople, type Key, type Nulls } from "./comparators";

// build a comparator chain and watch the list re-sort. results come from comparators.ts,
// which reproduces java's List.sort exactly for this list (all 54 combinations were diffed
// against jdk 25, including the ones that throw NullPointerException).

const KEYS: Key[] = ["name", "age", "city"];

export function ComparatorBuilder() {
  const [primary, setPrimary] = useState<Key>("age");
  const [then, setThen] = useState<Key | "none">("name");
  const [rev, setRev] = useState(false);
  const [nulls, setNulls] = useState<Nulls>("none");
  const res = sortPeople(primary, then, rev, nulls);
  const code = codeFor(primary, then, rev, nulls);
  const usesCity = primary === "city" || then === "city";

  const setP = (k: Key) => {
    setPrimary(k);
    if (then === k) setThen("none");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="comparing =" w="12ch">
          {KEYS.map((k) => (
            <button key={k} className="word" aria-pressed={primary === k} onClick={() => setP(k)}>
              {k}
            </button>
          ))}
        </Row>
        <Row k="then =" w="12ch">
          {(["none", ...KEYS] as (Key | "none")[]).map((k) => (
            <button key={k} className="word" aria-pressed={then === k} onClick={() => setThen(k)} disabled={k === primary} style={k === primary ? { opacity: 0.35 } : undefined}>
              {k}
            </button>
          ))}
        </Row>
        <Row k="reversed =" w="12ch">
          <button className="word" aria-pressed={!rev} onClick={() => setRev(false)}>
            no
          </button>
          <button className="word" aria-pressed={rev} onClick={() => setRev(true)}>
            yes
          </button>
        </Row>
        <Row k="nulls =" w="12ch" last>
          {(["none", "first", "last"] as Nulls[]).map((n) => (
            <button key={n} className="word" aria-pressed={nulls === n} onClick={() => setNulls(n)}>
              {n === "none" ? "not handled" : n === "first" ? "nullsFirst" : "nullsLast"}
            </button>
          ))}
          <span className="ml-2 text-11 text-faint">(two people have no city)</span>
        </Row>
      </div>

      <div className="overflow-x-auto rounded-md bg-bg px-4 py-3 text-12 whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-hi">{code}</span>
      </div>

      {res === "NPE" ? (
        <div className="grid gap-2 rounded-md px-4 py-4 shadow-[inset_0_0_0_1px_var(--dead)]">
          <div className="text-13 text-dead">Exception in thread &quot;main&quot; java.lang.NullPointerException</div>
          <p className="font-serif text-16 text-ink">
            the sort compared a <code>null</code> city, and <code>String.compareTo</code> can&apos;t handle <code>null</code>. wrap the key comparator: pick{" "}
            <strong>nullsFirst</strong> or <strong>nullsLast</strong>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse font-mono text-13 [&_td]:align-middle">
            <thead>
              <tr className="text-11 text-faint">
                <th className="py-1 pr-3 text-left font-mono font-normal">#</th>
                <th className="py-1 pr-3 text-left font-mono font-normal">name</th>
                <th className="py-1 pr-3 text-left font-mono font-normal">age</th>
                <th className="py-1 pr-3 text-left font-mono font-normal">city</th>
                <th className="py-1 text-left font-mono font-normal">was at</th>
              </tr>
            </thead>
            <tbody>
              {res.map((p, j) => {
                const prev = j > 0 ? res[j - 1] : null;
                const tied = prev && primary === "age" && prev.age === p.age && then === "none";
                return (
                  <tr key={p.name} className="border-t border-line">
                    <td className="py-1.5 pr-3 text-faint tabular">{j}</td>
                    <td className="py-1.5 pr-3" style={{ color: primary === "name" ? "var(--hot)" : then === "name" ? "var(--hi)" : "var(--ink)" }}>
                      {p.name}
                    </td>
                    <td className="py-1.5 pr-3 tabular" style={{ color: primary === "age" ? "var(--hot)" : then === "age" ? "var(--hi)" : "var(--ink)" }}>
                      {p.age}
                    </td>
                    <td className="py-1.5 pr-3" style={{ color: p.city === null ? "var(--faint)" : primary === "city" ? "var(--hot)" : then === "city" ? "var(--hi)" : "var(--ink)" }}>
                      {p.city ?? "null"}
                    </td>
                    <td className="py-1.5 text-mute tabular">
                      {p.i}
                      {tied && <span className="ml-2 text-11 text-live">tie: kept input order</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="font-serif text-15 text-mute">
        the input order is {PEOPLE.map((p) => p.name).join(", ")}. the <span className="text-hot">primary key</span> column is amber.{" "}
        {usesCity && nulls === "none" ? "sorting by city without saying where nulls go is a bug waiting for the first null." : "set then to none and sort by age: equal ages keep their input order, because java's object sort is stable."}
      </p>
    </div>
  );
}
