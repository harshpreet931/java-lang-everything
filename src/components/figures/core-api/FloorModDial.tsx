"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// a % b vs Math.floorMod(a, b), on a dial with b slots (an array of length b).
// java semantics: % truncates toward zero, so the result takes the sign of a.
// floorMod rounds toward negative infinity, so for b > 0 it's always 0..b-1.
//   -7 % 3 = -1, floorMod(-7, 3) = 2   (checked on jdk 25)

const BS = [3, 5, 7, 12] as const;

const rem = (a: number, b: number) => a - b * Math.trunc(a / b);
const floorMod = (a: number, b: number) => ((a % b) + b) % b;

export function FloorModDial() {
  const [a, setA] = useState(-10);
  const [b, setB] = useState<number>(7);
  const r = rem(a, b);
  const f = floorMod(a, b);
  const bad = r < 0;

  const cx = 110;
  const cy = 110;
  const R = 78;
  const at = (i: number, rad = R) => {
    const ang = (i / b) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad] as const;
  };

  return (
    <div className="font-mono @container">
      <div className="text-13">
        <Row k="a =" w="5ch">
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="slider min-w-0 flex-1"
              min={-20}
              max={20}
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              aria-label="a, the dividend"
            />
            <span className="w-[4ch] text-right text-hi tabular">{a}</span>
          </div>
        </Row>
        <Row k="b =" w="5ch" last>
          <Words<number> label="b, the divisor" options={BS.map((x) => ({ v: x, label: String(x) }))} value={b} onChange={setB} />
        </Row>
      </div>

      <div className="mt-4 grid items-center gap-6 @[560px]:grid-cols-[220px_minmax(0,1fr)]">
        <svg viewBox="0 0 220 220" className="mx-auto block w-full max-w-[240px]" role="img" aria-label={`a dial with ${b} slots, floorMod lands on ${f}`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line-2)" />
          {Array.from({ length: b }, (_, i) => {
            const [x, y] = at(i);
            const on = i === f;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={13} fill={on ? "var(--hot)" : "var(--well)"} stroke={on ? "var(--hot)" : "var(--line-2)"} className="transition-[fill,stroke] duration-200" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontFamily="var(--font-code)" fill={on ? "var(--bg)" : "var(--mute)"}>
                  {i}
                </text>
              </g>
            );
          })}
          {(() => {
            const [x, y] = at(f, R - 22);
            return <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--hot)" strokeWidth={1.5} className="transition-all duration-200 ease-jle" />;
          })()}
          <circle cx={cx} cy={cy} r={3} fill="var(--hot)" />
        </svg>

        <div className="grid gap-2 text-13" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="text-ink">
              {a} % {b}
            </span>
            <span className="tabular" style={{ color: bad ? "var(--dead)" : "var(--hi)" }}>
              {r}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="text-ink">
              Math.floorMod({a}, {b})
            </span>
            <span className="text-hot tabular">{f}</span>
          </div>
          <div className="mt-1 min-h-[3.4em] text-12 leading-[1.6]">
            {bad ? (
              <span className="text-dead">
                slots[{a} % {b}] → ArrayIndexOutOfBoundsException: Index {r} out of bounds for length {b}
              </span>
            ) : (
              <span className="font-serif text-16 text-mute">
                {a >= 0 ? (
                  <>
                    a isn&apos;t negative, so both agree. slide <code>a</code> below zero.
                  </>
                ) : (
                  `${a} is a multiple of ${b}, so both give 0. nudge a.`
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
