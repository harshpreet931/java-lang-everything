"use client";

import { useState, type ReactNode } from "react";
import { Bits } from "@/components/viz/Bits";
import { Row, Words } from "@/components/figures/basics/kit";

// the weird doubles, their bits, and how they behave. every result below was printed by jdk 25.

const VALUES: { id: string; label: string; v: number; facts: [string, string, ("hot" | "dead")?][]; note: ReactNode }[] = [
  {
    id: "nan",
    label: "NaN",
    v: NaN,
    facts: [
      ["0.0 / 0.0", "NaN"],
      ["nan == nan", "false", "hot"],
      ["Double.isNaN(nan)", "true"],
      ["Double.valueOf(nan).equals(nan)", "true"],
    ],
    note: <>not a number: every exponent bit set, a non-zero mantissa. the only value not equal to itself, so <code>==</code> can never find it. use <code>Double.isNaN</code>.</>,
  },
  {
    id: "inf",
    label: "Infinity",
    v: Infinity,
    facts: [
      ["1.0 / 0", "Infinity"],
      ["-1.0 / 0", "-Infinity"],
      ["1.0 / 0 - 1.0 / 0", "NaN"],
      ["1 / 0", "ArithmeticException", "dead"],
    ],
    note: <>every exponent bit set, mantissa all zeros. dividing a double by zero is fine and gives infinity. dividing an <em>int</em> by zero throws.</>,
  },
  {
    id: "negzero",
    label: "-0.0",
    v: -0,
    facts: [
      ["0.0 == -0.0", "true"],
      ["1 / -0.0", "-Infinity", "hot"],
      ["Double.valueOf(0.0).equals(-0.0)", "false", "hot"],
      ["Math.min(0.0, -0.0)", "-0.0"],
    ],
    note: <>only the sign bit differs from 0.0. <code>==</code> says they&apos;re equal, <code>equals</code> says they aren&apos;t, and dividing by them gives opposite infinities.</>,
  },
  {
    id: "min",
    label: "MIN_VALUE",
    v: Number.MIN_VALUE,
    facts: [
      ["Double.MIN_VALUE", "4.9E-324"],
      ["Double.MIN_VALUE / 2", "0.0", "hot"],
      ["Double.MIN_VALUE > 0", "true"],
    ],
    note: <>the smallest <em>positive</em> double: one single bit, at the very bottom. not the most negative double (that&apos;s <code>-Double.MAX_VALUE</code>).</>,
  },
  {
    id: "max",
    label: "MAX_VALUE",
    v: Number.MAX_VALUE,
    facts: [
      ["Double.MAX_VALUE", "1.7976931348623157E308"],
      ["Double.MAX_VALUE * 2", "Infinity", "hot"],
    ],
    note: <>the biggest finite double. go past it and you get infinity, not a wrap-around like ints.</>,
  },
];

export function SpecialDoubles() {
  const [id, setId] = useState("nan");
  const cur = VALUES.find((x) => x.id === id)!;
  return (
    <div className="font-mono text-13">
      <Row k="value =" last>
        <Words options={VALUES.map((x) => ({ v: x.id, label: x.label }))} value={id} onChange={setId} label="special value" />
      </Row>
      <div className="mt-4 min-w-0 overflow-x-auto">
        <Bits key={id} type="double" value={cur.v} label={`double ${cur.label}`} />
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,auto)_auto] justify-start gap-x-6 gap-y-1 text-12">
        {cur.facts.map(([expr, out, odd]) => (
          <div key={expr} className="contents">
            <span className="text-ink">{expr}</span>
            <span style={{ color: odd ? `var(--${odd})` : "var(--hi)" }}>
              <span className="text-faint">→ </span>
              {out}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 font-serif text-16 leading-[1.6] text-ink [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi" aria-live="polite">
        {cur.note}
      </p>
    </div>
  );
}
