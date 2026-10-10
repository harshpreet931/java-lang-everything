"use client";

import { useId, useState } from "react";
import { Row, Words } from "./kit";

// Integer.valueOf(i) in jdk 25: if low <= i <= high return IntegerCache.cache[i + 128],
// else new Integer(i). low is fixed at -128. high is 127 unless -XX:AutoBoxCacheMax=N
// (or -Djava.lang.Integer.IntegerCache.high=N) asks for more; values under 127 are
// ignored. checked on jdk 25: 128 == 128 is false by default, true with AutoBoxCacheMax=1000.

const MIN = -200;
const MAX = 1100;

export function CacheRange() {
  const [v, setV] = useState(127);
  const [high, setHigh] = useState(127);
  const id = useId().replace(/:/g, "");
  const hit = v >= -128 && v <= high;
  const pct = (x: number) => ((x - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="@container text-13">
      <Row k="value =" w="7ch">
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={MIN}
            max={MAX}
            value={v}
            onChange={(e) => setV(Number(e.target.value))}
            aria-label="the int being boxed"
          />
          <span className="w-[5ch] text-right text-hi tabular">{v}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {[-129, -128, 127, 128, 1000].map((x) => (
            <button key={x} className="word !min-h-6 !px-1.5 !text-11" aria-pressed={v === x} onClick={() => setV(x)}>
              {x}
            </button>
          ))}
        </div>
      </Row>
      <Row k="flag =" w="7ch" last>
        <Words
          label="cache upper bound"
          value={high}
          onChange={setHigh}
          options={[
            { v: 127, label: "none (high = 127)" },
            { v: 1000, label: "-XX:AutoBoxCacheMax=1000" },
          ]}
        />
      </Row>

      {/* the number line */}
      <div className="relative mt-4 h-14 border-t border-line pt-4" role="img" aria-label={`the cache covers -128 to ${high}; ${v} is ${hit ? "inside" : "outside"} it`}>
        <div className="absolute inset-x-0 top-[34px] h-px bg-line-2" />
        <div
          className="absolute top-[26px] h-4 rounded-xs transition-[left,width] duration-300 ease-jle"
          style={{
            left: `${pct(-128)}%`,
            width: `${pct(high) - pct(-128)}%`,
            background: "color-mix(in srgb, var(--meta) 16%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--meta) 60%, transparent)",
          }}
        />
        <div className="absolute top-[18px] h-6 w-[2px] -translate-x-1/2 bg-hot transition-[left] duration-150" style={{ left: `${pct(v)}%` }} />
        {[-128, 0, 127, high === 1000 ? 1000 : null].filter((x) => x !== null).map((x) => (
          <span key={x} className="absolute top-[46px] -translate-x-1/2 text-[10px] text-faint tabular" style={{ left: `${pct(x as number)}%` }}>
            {x}
          </span>
        ))}
        <span className="absolute top-[4px] text-[10px] text-meta transition-[left] duration-300" style={{ left: `${pct(-128)}%` }}>
          IntegerCache.cache · {high - -128 + 1} Integers
        </span>
      </div>

      <div className="mt-6 grid gap-4 border-t border-line pt-4 @[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="text-12 leading-[1.9]" aria-live="polite">
          <div>
            <span className="text-mute">Integer a = {v}, b = {v};</span>
          </div>
          <div>
            <span className="text-faint">→ </span>
            <span className="text-ink">Integer.valueOf({v})</span> <span className="text-faint">twice</span>
          </div>
          <div>
            <span className="text-faint">→ </span>
            {hit ? (
              <span className="text-meta">
                cache[{v} + 128] = cache[{v + 128}]
              </span>
            ) : (
              <span className="text-ink">new Integer({v}), each time</span>
            )}
          </div>
          <div className="mt-1">
            <span className="text-faint">a == b → </span>
            <span className="text-15" style={{ color: hit ? "var(--live)" : "var(--dead)" }}>
              {String(hit)}
            </span>
            <span className="text-faint"> · a.equals(b) → </span>
            <span className="text-live">true</span>
          </div>
        </div>

        <svg viewBox="0 0 300 112" className="block w-full max-w-[340px]" role="img" aria-label={hit ? "a and b point at one cached Integer" : "a and b point at two different Integers"}>
          <defs>
            <marker id={`cr-${id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
            </marker>
          </defs>
          {[
            { n: "a", y: 26 },
            { n: "b", y: 70 },
          ].map((s) => (
            <g key={s.n}>
              <rect x={6} y={s.y - 16} width={64} height={32} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
              <text x={18} y={s.y + 4} fontSize={12} fill="var(--mute)" fontFamily="var(--font-code)">
                {s.n}
              </text>
              <circle cx={56} cy={s.y} r={3.5} fill="var(--ref)" />
            </g>
          ))}
          {hit ? (
            <g key="one" className="obj-in">
              <rect x={170} y={32} width={124} height={44} rx={4} fill="var(--bg)" stroke="var(--meta)" />
              <text x={182} y={51} fontSize={12} fill="var(--hi)" fontFamily="var(--font-code)">
                Integer {v}
              </text>
              <text x={182} y={67} fontSize={10} fill="var(--meta)" fontFamily="var(--font-code)">
                cached, shared
              </text>
              <path d="M 59 26 C 115 26, 120 46, 166 50" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#cr-${id})`} />
              <path d="M 59 70 C 115 70, 120 60, 166 58" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#cr-${id})`} />
            </g>
          ) : (
            <g key="two" className="obj-in">
              {[8, 64].map((y, i) => (
                <g key={y}>
                  <rect x={170} y={y} width={124} height={40} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
                  <text x={182} y={y + 18} fontSize={12} fill="var(--hi)" fontFamily="var(--font-code)">
                    Integer {v}
                  </text>
                  <text x={182} y={y + 32} fontSize={10} fill="var(--faint)" fontFamily="var(--font-code)">
                    new object #{i + 1}
                  </text>
                </g>
              ))}
              <path d="M 59 26 C 110 26, 120 28, 166 28" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#cr-${id})`} />
              <path d="M 59 70 C 110 70, 120 84, 166 84" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd={`url(#cr-${id})`} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
