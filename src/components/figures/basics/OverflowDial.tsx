"use client";

import { useRef, useState } from "react";
import { Bits } from "@/components/viz/Bits";
import { Row, Words, useReducedMotion } from "@/components/figures/basics/kit";

// the integer types are not a number line, they're a circle. 0 at the top, counting up
// clockwise to MAX_VALUE at the bottom, where one more step lands on MIN_VALUE and keeps
// counting up through the negatives back to -1 and 0. two's complement, drawn.

type T = "byte" | "short" | "int";
const BITS: Record<T, number> = { byte: 8, short: 16, int: 32 };
const BIG: Record<T, number> = { byte: 10, short: 1_000, int: 100_000_000 };

const wrap = (t: T, v: number) => Number(BigInt.asIntN(BITS[t], BigInt(Math.trunc(v))));
const maxOf = (t: T) => 2 ** (BITS[t] - 1) - 1;
const minOf = (t: T) => -(2 ** (BITS[t] - 1));
const fmt = (n: number) => n.toLocaleString("en-US");

export function OverflowDial() {
  const [t, setT] = useState<T>("byte");
  const [v, setV] = useState(120);
  const [msg, setMsg] = useState<{ text: string; dead?: boolean } | null>(null);
  const reduce = useReducedMotion();
  // cumulative needle angle, so the needle always turns the short way round
  const angle = useRef(0);
  const n = 2 ** BITS[t];
  const unsigned = v < 0 ? v + n : v;
  const target = (unsigned / n) * 360;
  let delta = target - (((angle.current % 360) + 360) % 360);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  angle.current += delta;

  const add = (d: number, label: string) => {
    const raw = v + d;
    const next = wrap(t, raw);
    setV(next);
    if (raw > maxOf(t)) setMsg({ text: `${fmt(v)} ${label} = ${fmt(next)}. it went past MAX_VALUE and came out the other side. no exception, no warning.`, dead: true });
    else if (raw < minOf(t)) setMsg({ text: `${fmt(v)} ${label} = ${fmt(next)}. below MIN_VALUE wraps to the top.`, dead: true });
    else setMsg({ text: `${fmt(v)} ${label} = ${fmt(next)}.` });
  };

  const R = 104;
  const pt = (deg: number, r = R) => {
    const a = ((deg - 90) * Math.PI) / 180;
    // rounded, so the server and the browser agree on every coordinate
    return [Math.round((120 + r * Math.cos(a)) * 100) / 100, Math.round((120 + r * Math.sin(a)) * 100) / 100];
  };
  const marks = [
    { at: 0, label: "0" },
    { at: 90, label: fmt(Math.round(n / 4)) },
    { at: 180, label: "MAX | MIN" },
    { at: 270, label: "-" + fmt(Math.round(n / 4)) },
  ];

  return (
    <div className="font-mono text-13">
      <Row k="type =">
        <Words
          options={[
            { v: "byte", label: "byte" },
            { v: "short", label: "short" },
            { v: "int", label: "int" },
          ]}
          value={t}
          onChange={(x) => {
            setT(x);
            setV(maxOf(x) - 2);
            setMsg(null);
          }}
          label="integer type"
        />
      </Row>

      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[240px_minmax(0,1fr)]">
        <svg fontFamily="var(--font-code), monospace" viewBox="0 0 240 240" className="mx-auto block w-full max-w-[240px]" role="img" aria-label={`${t} value ${v} on a circle of all ${t} values`}>
          {/* positive half and negative half */}
          <path d={`M 120 ${120 - R} A ${R} ${R} 0 0 1 120 ${120 + R}`} fill="none" stroke="var(--line-2)" strokeWidth={6} />
          <path d={`M 120 ${120 + R} A ${R} ${R} 0 0 1 120 ${120 - R}`} fill="none" stroke="var(--line)" strokeWidth={6} />
          {t === "byte" &&
            Array.from({ length: 256 }, (_, i) => {
              const [x1, y1] = pt((i / 256) * 360, R - 6);
              const [x2, y2] = pt((i / 256) * 360, R - (i % 16 === 0 ? 11 : 8));
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--faint)" strokeWidth={0.6} />;
            })}
          {/* the cliff: where MAX meets MIN */}
          <line x1={120} y1={120 + R - 12} x2={120} y2={120 + R + 10} stroke="var(--dead)" strokeWidth={1.5} />
          {marks.map((m) => {
            const inside = pt(m.at, R - 30);
            return (
              <text
                key={m.at}
                x={m.at === 180 ? 120 : inside[0]}
                y={m.at === 180 ? 120 + R - 20 : inside[1] + 4}
                textAnchor="middle"
                fontSize={10}
                fill={m.at === 180 ? "var(--dead)" : "var(--faint)"}
              >
                {m.label}
              </text>
            );
          })}
          <text x={176} y={64} fontSize={10} fill="var(--mute)">
            positive
          </text>
          <text x={22} y={64} fontSize={10} fill="var(--faint)">
            negative
          </text>
          {/* needle */}
          <g
            style={{
              transform: `rotate(${angle.current}deg)`,
              transformOrigin: "120px 120px",
              transition: reduce ? "none" : "transform 380ms cubic-bezier(0.2, 0, 0, 1)",
            }}
          >
            <line x1={120} y1={120} x2={120} y2={120 - R + 14} stroke="var(--hot)" strokeWidth={1.5} />
            <circle cx={120} cy={120 - R + 3} r={4} fill="var(--hot)" />
          </g>
          <circle cx={120} cy={120} r={3} fill="var(--hot)" />
        </svg>

        <div className="min-w-0">
          <div className="text-11 text-faint">{t} value</div>
          <div className="text-28 font-light text-hi tabular">{fmt(v)}</div>
          <div className="mt-1 h-4 text-11 text-faint">
            {v === maxOf(t) ? `${t === "int" ? "Integer" : t === "byte" ? "Byte" : "Short"}.MAX_VALUE` : v === minOf(t) ? `${t === "int" ? "Integer" : t === "byte" ? "Byte" : "Short"}.MIN_VALUE` : ""}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <button className="act" onClick={() => add(-1, "- 1")}>
              − 1
            </button>
            <button className="act solid" onClick={() => add(1, "+ 1")}>
              + 1
            </button>
            <button className="act" onClick={() => add(BIG[t], `+ ${fmt(BIG[t])}`)}>
              + {fmt(BIG[t])}
            </button>
            <button
              className="act"
              onClick={() => {
                setV(maxOf(t));
                setMsg({ text: `MAX_VALUE: 0 followed by ${BITS[t] - 1} ones. the biggest a ${t} gets.` });
              }}
            >
              MAX
            </button>
          </div>
          <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi" aria-live="polite" style={{ color: msg?.dead ? "var(--dead)" : "var(--ink)" }}>
            {msg?.text ?? "press + 1 a few times."}
          </p>
        </div>
      </div>
      <div className="mt-4 min-w-0 overflow-x-auto">
        <Bits key={`${t}:${v}`} type={t} value={v} label={`${t} ${fmt(v)}, in bits`} />
      </div>
    </div>
  );
}
