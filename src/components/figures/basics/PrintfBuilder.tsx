"use client";

import { useState } from "react";
import { Row, Words } from "@/components/figures/basics/kit";
import { javaFormat, spec, type Conv, type Flag } from "@/components/figures/basics/javaFormat";

// build a format specifier piece by piece and see exactly what String.format produces,
// including the exceptions. the formatting logic is checked against jdk 25 (see javaFormat.ts).

const VALUES: { label: string; v: number | string; type: "int" | "double" | "String" }[] = [
  { label: "42", v: 42, type: "int" },
  { label: "-1234567", v: -1234567, type: "int" },
  { label: "3.14159", v: 3.14159, type: "double" },
  { label: "1234567.891", v: 1234567.891, type: "double" },
  { label: "1.005", v: 1.005, type: "double" },
  { label: '"duke"', v: "duke", type: "String" },
];

const CONVS: Record<"int" | "double" | "String", { v: Conv; label: string; what: string }[]> = {
  int: [
    { v: "d", label: "d", what: "decimal integer" },
    { v: "x", label: "x", what: "hexadecimal" },
  ],
  double: [
    { v: "f", label: "f", what: "fixed-point decimal" },
    { v: "e", label: "e", what: "scientific notation" },
  ],
  String: [{ v: "s", label: "s", what: "string" }],
};

const FLAGS: { f: Flag; what: string }[] = [
  { f: "-", what: "left-justify" },
  { f: "0", what: "pad with zeros" },
  { f: "+", what: "always show the sign" },
  { f: ",", what: "group thousands" },
];

export function PrintfBuilder() {
  const [vi, setVi] = useState(3);
  const [conv, setConv] = useState<Conv>("f");
  const [flags, setFlags] = useState<Flag[]>([","]);
  const [width, setWidth] = useState(15);
  const [prec, setPrec] = useState(2);

  const val = VALUES[vi];
  const convs = CONVS[val.type];
  const c = convs.some((x) => x.v === conv) ? conv : convs[0].v;
  const w = Math.min(width, 16);
  const r = javaFormat(val.v, c, flags, w, prec);
  const sp = spec(flags, w, prec, c);

  const toggle = (f: Flag) => setFlags((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));

  const parts = [
    { t: "%", what: "start of a specifier" },
    ...FLAGS.filter((x) => flags.includes(x.f)).map((x) => ({ t: x.f, what: x.what })),
    ...(w > 0 ? [{ t: String(w), what: `width: at least ${w} characters` }] : []),
    ...(prec >= 0 ? [{ t: `.${prec}`, what: c === "s" ? `precision: at most ${prec} characters` : `precision: ${prec} digits after the point` }] : []),
    { t: c, what: convs.find((x) => x.v === c)!.what },
  ];

  return (
    <div className="font-mono text-13">
      <Row k="value =" w="13ch">
        <Words
          options={VALUES.map((x, i) => ({ v: i, label: x.label }))}
          value={vi}
          onChange={(i) => {
            setVi(i);
            const t = VALUES[i].type;
            if (!CONVS[t].some((x) => x.v === conv)) setConv(CONVS[t][0].v);
          }}
          label="value to format"
        />
      </Row>
      <Row k="conversion =" w="13ch">
        <Words options={convs.map((x) => ({ v: x.v, label: `%${x.label}` }))} value={c} onChange={setConv} label="conversion" />
      </Row>
      <Row k="flags =" w="13ch">
        <div className="flex flex-wrap gap-1">
          {FLAGS.map((x) => (
            <button key={x.f} className="word" aria-pressed={flags.includes(x.f)} onClick={() => toggle(x.f)} title={x.what}>
              {x.f} <span className="ml-1 text-11 opacity-70">{x.what}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row k="width =" w="13ch" center>
        <div className="flex items-center gap-3">
          <input type="range" className="slider min-w-0 flex-1" min={0} max={16} value={w} onChange={(e) => setWidth(Number(e.target.value))} aria-label="width" />
          <span className="w-[6ch] text-right text-hi tabular">{w === 0 ? "none" : w}</span>
        </div>
      </Row>
      <Row k="precision =" w="13ch" last center>
        <div className="flex items-center gap-3">
          <input type="range" className="slider min-w-0 flex-1" min={-1} max={6} value={prec} onChange={(e) => setPrec(Number(e.target.value))} aria-label="precision" />
          <span className="w-[6ch] text-right text-hi tabular">{prec < 0 ? "none" : prec}</span>
        </div>
      </Row>

      <div className="mt-4 overflow-x-auto rounded-md bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div className="text-12 whitespace-nowrap text-ink">
          String.format(&quot;<span className="text-hot">{sp}</span>&quot;, {val.label})
        </div>
        {r.ok ? (
          <div className="mt-3">
            <div className="flex w-max">
              {[...r.out].map((ch, i) => (
                <span
                  key={i}
                  className="flex h-8 w-[15px] items-center justify-center text-14 sm:w-[17px]"
                  style={{ boxShadow: "inset 0 0 0 0.5px var(--line-2)", color: ch === " " ? "var(--faint)" : "var(--hi)" }}
                >
                  {ch === " " ? "·" : ch}
                </span>
              ))}
            </div>
            <div className="mt-1 text-11 whitespace-pre text-faint">
              &quot;{r.out}&quot; · {r.out.length} characters{w > 0 && r.out.length > w ? ` (wider than ${w}: width is a minimum, never a cut)` : ""}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-12 leading-[1.6] text-dead">{r.error}</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-12">
        {parts.map((p, i) => (
          <span key={i}>
            <span className="text-hot">{p.t}</span> <span className="text-faint">{p.what}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
