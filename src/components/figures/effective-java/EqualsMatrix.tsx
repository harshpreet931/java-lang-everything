"use client";

import { useState } from "react";
import { CodePanel, Narration, Words } from "./kit";

// item 10. a Coin, and a RareCoin that adds a year. pick how RareCoin.equals is written
// and read the 3×3 table of a.equals(b). the contract checks are computed from the table:
// symmetric (x=y iff y=x), transitive (x=y, y=z ⇒ x=z), and "keeps the year" (two rare
// coins from different years must not be equal). dead marks the cells that break a rule.

type Strat = "inherit" | "strict" | "lenient" | "compose";
type Obj = { id: string; label: string; rare: boolean; year?: number };

const OBJS: Obj[] = [
  { id: "a", label: "Coin(50)", rare: false },
  { id: "b", label: "Rare(50, 1933)", rare: true, year: 1933 },
  { id: "c", label: "Rare(50, 2001)", rare: true, year: 2001 },
];

function eq(s: Strat, x: Obj, y: Obj): boolean {
  if (!x.rare) return s === "compose" ? !y.rare : true; // Coin.equals: cents only
  switch (s) {
    case "inherit":
      return true;
    case "strict":
    case "compose":
      return y.rare && y.year === x.year;
    case "lenient":
      return y.rare ? y.year === x.year : true;
  }
}

const CODE: Record<Strat, string> = {
  inherit: `class RareCoin extends Coin {
    final int year;
    // no equals: Coin's version
    // compares cents and nothing else
}`,
  strict: `class RareCoin extends Coin {
    final int year;
    public boolean equals(Object o) {
        return o instanceof RareCoin r
            && r.cents == cents
            && r.year == year;
    }
}`,
  lenient: `class RareCoin extends Coin {
    final int year;
    public boolean equals(Object o) {
        if (o instanceof RareCoin r)
            return r.cents == cents && r.year == year;
        return super.equals(o); // plain coin: ignore year
    }
}`,
  compose: `record RareCoin(Coin coin, int year) {}
// not a Coin anymore: it HAS one.
// record equals compares coin and year.`,
};

const WHY: Record<Strat, string> = {
  inherit: "symmetric and transitive, but wrong: two different rare coins are equal because the year is ignored.",
  strict: "symmetry breaks. the plain coin says it equals the rare one, the rare one says no. a List or Set will disagree with itself depending on which side calls equals.",
  lenient: "transitivity breaks. 1933 equals the plain coin, the plain coin equals 2001, but 1933 doesn't equal 2001.",
  compose: "every rule holds. a RareCoin isn't a Coin, so it never claims to equal one. this is the way out: there's no way to extend an instantiable class, add a value field, and keep the contract.",
};

export function EqualsMatrix() {
  const [s, setS] = useState<Strat>("strict");

  const m = OBJS.map((x) => OBJS.map((y) => eq(s, x, y)));
  const bad = new Set<string>();
  // symmetry
  let symOk = true;
  OBJS.forEach((_, i) =>
    OBJS.forEach((_, j) => {
      if (m[i][j] !== m[j][i]) {
        symOk = false;
        bad.add(`${i}${j}`);
      }
    }),
  );
  // transitivity
  let transOk = true;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        if (m[i][j] && m[j][k] && !m[i][k]) {
          transOk = false;
          bad.add(`${i}${j}`);
          bad.add(`${j}${k}`);
          bad.add(`${i}${k}`);
        }
  // the year must matter between two rare coins
  const yearOk = !m[1][2] && !m[2][1];
  if (!yearOk) {
    bad.add("12");
    bad.add("21");
  }

  const checks = [
    { k: "reflexive", ok: m.every((r, i) => r[i]) },
    { k: "symmetric", ok: symOk },
    { k: "transitive", ok: transOk },
    { k: "keeps the year", ok: yearOk },
  ];

  return (
    <div className="@container grid gap-5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-line pb-3 @[560px]:grid-cols-[17ch_minmax(0,1fr)] @[560px]:items-center">
        <span className="text-12 text-faint">RareCoin.equals =</span>
        <Words
          label="how RareCoin.equals is written"
          value={s}
          onChange={setS}
          options={[
            { v: "inherit", label: "inherit" },
            { v: "strict", label: "strict" },
            { v: "lenient", label: "lenient" },
            { v: "compose", label: "composition" },
          ]}
        />
      </div>

      <div className="grid gap-5 @[680px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2 text-12 text-faint">
            row<span className="text-ink">.equals(</span>column<span className="text-ink">)</span>
          </div>
          <div
            className="grid min-w-0 items-center gap-1 text-12"
            style={{ gridTemplateColumns: "auto repeat(3, minmax(0, 1fr))" }}
            role="table"
            aria-label="equals results"
          >
            <span role="columnheader" />
            {OBJS.map((o) => (
              <span key={o.id} role="columnheader" className="pb-1 text-center text-hi" title={o.label}>
                {o.id}
              </span>
            ))}
            {OBJS.map((x, i) => (
              <div key={x.id} role="row" className="contents">
                <span role="rowheader" className="pr-2 whitespace-nowrap text-mute">
                  <span className="text-hi">{x.id}</span> <span className="hidden @[420px]:inline">{x.label}</span>
                </span>
                {OBJS.map((y, j) => {
                  const v = m[i][j];
                  const isBad = bad.has(`${i}${j}`);
                  return (
                    <span
                      key={y.id}
                      role="cell"
                      className="flex h-9 items-center justify-center rounded-sm tabular transition-colors duration-200"
                      style={{
                        background: isBad ? "color-mix(in srgb, var(--dead) 12%, var(--bg))" : "var(--bg)",
                        boxShadow: `inset 0 0 0 1px ${isBad ? "var(--dead)" : "var(--line-2)"}`,
                        color: isBad ? "var(--dead)" : v ? "var(--hi)" : "var(--faint)",
                      }}
                    >
                      {String(v)}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-12">
            {checks.map((c) => (
              <li key={c.k} className="flex items-center gap-2">
                <span style={{ color: c.ok ? "var(--live)" : "var(--dead)" }}>{c.ok ? "✓" : "✗"}</span>
                <span className={c.ok ? "text-ink" : "text-dead"}>{c.k}</span>
              </li>
            ))}
          </ul>
        </div>
        <CodePanel file="RareCoin.java" code={CODE[s]} nolines />
      </div>

      <Narration>{WHY[s]}</Narration>
    </div>
  );
}
