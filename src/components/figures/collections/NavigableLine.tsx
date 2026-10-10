"use client";

import { useId, useState } from "react";
import { Row, useWidth } from "./kit";

// NavigableMap's search-around methods on a number line. the semantics are TreeMap's:
//   floorKey(x)   greatest key <= x      lowerKey(x)   greatest key < x
//   ceilingKey(x) least key >= x         higherKey(x)  least key > x
//   headMap(x)    keys < x (or <= with inclusive)    tailMap(x)  keys >= x (or > when exclusive)
//   subMap(a, b)  keys >= a and < b

const KEYS = [10, 20, 30, 40, 50, 60, 70];
const MIN = 0;
const MAX = 80;

type View = "none" | "head" | "tail" | "sub";

export function NavigableLine() {
  const [x, setX] = useState(45);
  const [view, setView] = useState<View>("none");
  const [incl, setIncl] = useState(false);
  const uid = useId().replace(/:/g, "");
  const [wrap, width] = useWidth<HTMLDivElement>(640);

  const floor = [...KEYS].reverse().find((k) => k <= x) ?? null;
  const lower = [...KEYS].reverse().find((k) => k < x) ?? null;
  const ceil = KEYS.find((k) => k >= x) ?? null;
  const higher = KEYS.find((k) => k > x) ?? null;

  const inView = (k: number) => {
    if (view === "head") return incl ? k <= x : k < x;
    if (view === "tail") return incl ? k >= x : k > x;
    if (view === "sub") return k >= 20 && (incl ? k <= x : k < x);
    return false;
  };
  const viewText =
    view === "head"
      ? `headMap(${x}${incl ? ", true" : ""})`
      : view === "tail"
        ? `tailMap(${x}${incl ? "" : ", false"})`
        : view === "sub"
          ? `subMap(20, true, ${x}, ${incl})`
          : "";
  const viewKeys = KEYS.filter(inView);

  const W = width < 520 ? 360 : 640;
  const pad = 26;
  const sx = (v: number) => pad + ((v - MIN) / (MAX - MIN)) * (W - pad * 2);
  const lineY = 70;

  const marks: { label: string; k: number | null; dy: number; tone: string }[] = [
    { label: "floorKey", k: floor, dy: -1, tone: "var(--ref)" },
    { label: "ceilingKey", k: ceil, dy: -1, tone: "var(--ref)" },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="x =">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={MIN + 1}
            max={MAX - 1}
            step={1}
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
            aria-label="the query key x"
          />
          <span className="w-[4ch] text-right text-14 text-hot tabular">{x}</span>
          <button className="word" onClick={() => setX(40)}>
            try 40
          </button>
        </Row>
        <Row k="view =" last>
          {(
            [
              ["none", "just search"],
              ["head", "headMap"],
              ["tail", "tailMap"],
              ["sub", "subMap"],
            ] as [View, string][]
          ).map(([v, l]) => (
            <button key={v} className="word" aria-pressed={view === v} onClick={() => setView(v)}>
              {l}
            </button>
          ))}
          {view !== "none" && (
            <button className="word" aria-pressed={incl} onClick={() => setIncl(!incl)}>
              inclusive
            </button>
          )}
        </Row>
      </div>

      <div ref={wrap} className="min-w-0">
      <svg viewBox={`0 0 ${W} 130`} fontFamily="var(--font-code)" className="block w-full" role="img" aria-label={`keys 10 to 70. x is ${x}. floor ${floor}, ceiling ${ceil}`}>
        <defs>
          <marker id={`nl-${uid}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
          </marker>
        </defs>
        <line x1={sx(MIN)} y1={lineY} x2={sx(MAX)} y2={lineY} stroke="var(--line-2)" />
        {/* the view's range */}
        {view !== "none" && viewKeys.length > 0 && (
          <rect
            x={sx(viewKeys[0]) - 12}
            y={lineY - 13}
            width={sx(viewKeys[viewKeys.length - 1]) - sx(viewKeys[0]) + 24}
            height={26}
            rx={13}
            fill="color-mix(in srgb, var(--live) 14%, transparent)"
            stroke="var(--live)"
          />
        )}
        {KEYS.map((k) => {
          const on = inView(k);
          const isHit = k === floor || k === ceil;
          return (
            <g key={k}>
              <circle cx={sx(k)} cy={lineY} r={6} fill={on ? "var(--live)" : "var(--bg)"} stroke={on ? "var(--live)" : isHit ? "var(--ref)" : "var(--mute)"} strokeWidth={isHit ? 1.75 : 1.25} />
              <text x={sx(k)} y={lineY + 26} textAnchor="middle" fontSize={12} fill={on ? "var(--live)" : "var(--hi)"}>
                {k}
              </text>
            </g>
          );
        })}
        {/* x */}
        <line x1={sx(x)} y1={lineY - 34} x2={sx(x)} y2={lineY + 8} stroke="var(--hot)" strokeWidth={1.5} />
        <text x={sx(x)} y={lineY - 40} textAnchor="middle" fontSize={12} fill="var(--hot)">
          x = {x}
        </text>
        {/* floor / ceiling arrows */}
        {marks.map((m, i) =>
          m.k !== null && m.k !== x ? (
            <path
              key={m.label}
              d={`M${sx(x)} ${lineY - 22 - i * 0} Q ${(sx(x) + sx(m.k)) / 2} ${lineY - 40}, ${sx(m.k)} ${lineY - 10}`}
              fill="none"
              stroke={m.tone}
              strokeWidth={1.25}
              markerEnd={`url(#nl-${uid})`}
            />
          ) : null,
        )}
      </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-12 sm:grid-cols-4">
        {[
          ["floorKey(x)", floor, "greatest ≤ x"],
          ["lowerKey(x)", lower, "greatest < x"],
          ["ceilingKey(x)", ceil, "least ≥ x"],
          ["higherKey(x)", higher, "least > x"],
        ].map(([l, v, d]) => (
          <div key={l as string} className="border-t border-line pt-1.5">
            <div className="text-faint">{l}</div>
            <div className="text-14">
              <span className={v === null ? "text-faint" : "text-ref"}>{v === null ? "null" : String(v)}</span>
              <span className="ml-2 text-11 text-faint">{d}</span>
            </div>
          </div>
        ))}
      </div>
      {view !== "none" && (
        <div className="text-12 text-mute">
          <span className="text-faint">m.{viewText} → </span>
          <span className="text-live">{"{"}{viewKeys.map((k) => `${k}=v${k}`).join(", ")}{"}"}</span>
          <span className="ml-2 font-serif text-15 text-mute">a live view of the same tree, not a copy.</span>
        </div>
      )}
    </div>
  );
}
