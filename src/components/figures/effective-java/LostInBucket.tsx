"use client";

import { useId, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Narration, Words } from "./kit";

// item 11. a HashSet with 8 buckets. add(new Key("ada")), then contains(new Key("ada")).
// with Object's identity hashCode the two equal keys hash differently, land in different
// buckets, and equals never even runs. with a hashCode built from the field, they meet.
//
// the bucket is what HashMap really computes: (h ^ (h >>> 16)) & (n - 1).
// "ada".hashCode() is 96414. the two identity hashes are example values: the real ones
// are arbitrary per object (and per run).

const N = 8;
const spread = (h: number) => ((h ^ (h >>> 16)) & (N - 1)) >>> 0;
const hex = (h: number) => "0x" + (h >>> 0).toString(16);

const HASH = {
  identity: { k1: 0x1b6d3586, k2: 0x4554617c },
  fields: { k1: 96414, k2: 96414 },
} as const;

type Mode = keyof typeof HASH;

export function LostInBucket() {
  const [mode, setMode] = useState<Mode>("identity");
  const s = useStepper(4, { interval: 1600 });
  const uid = useId().replace(/:/g, "");
  const h = HASH[mode];
  const b1 = spread(h.k1);
  const b2 = spread(h.k2);
  const found = b1 === b2;
  const fmt = (x: number) => (mode === "identity" ? hex(x) : String(x));

  const notes: Record<Mode, string[]> = {
    identity: [
      "an empty HashSet: 8 buckets. Key overrides equals (same name = equal) but not hashCode.",
      `add(k1): k1.hashCode() is ${hex(h.k1)}, Object's identity hash. spread and masked, that's bucket ${b1}.`,
      `contains(k2): k2 is equal to k1, but its identity hash is ${hex(h.k2)}, so it looks in bucket ${b2}.`,
      `bucket ${b2} is empty. contains returns false, and equals was never called. the key is in the set, just not where anyone will look.`,
    ],
    fields: [
      "an empty HashSet: 8 buckets. Key overrides equals and hashCode, both from the name.",
      `add(k1): "ada".hashCode() is ${h.k1}. spread and masked, that's bucket ${b1}.`,
      `contains(k2): same name, same hash, same bucket ${b2}.`,
      "bucket 7 has an entry with the same hash, so HashMap calls k2.equals(k1): true. found.",
    ],
  };

  const BX = 20;
  const BW = 50;
  const BY = 128;
  const bx = (i: number) => BX + i * BW + BW / 2;
  const head = `lib-${uid}`;
  const k1x = 120;
  const k2x = 330;

  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-line pb-3 @container sm:grid-cols-[13ch_minmax(0,1fr)] sm:items-center">
        <span className="text-12 text-faint">Key.hashCode =</span>
        <Words
          label="which hashCode"
          value={mode}
          onChange={setMode}
          options={[
            { v: "identity", label: "Object's (not overridden)" },
            { v: "fields", label: "from the name" },
          ]}
        />
      </div>

      <svg
        viewBox="0 0 440 210"
        fontFamily="var(--font-code)"
        className="block w-full max-w-[600px]"
        role="img"
        aria-label={notes[mode][s.i]}
      >
        <defs>
          <marker id={head} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
          </marker>
        </defs>

        {/* the two keys */}
        <g opacity={s.i >= 1 ? 1 : 0.45} style={{ transition: "opacity 200ms" }}>
          <rect x={k1x - 60} y={10} width={120} height={44} rx={4} fill="var(--bg)" stroke="var(--line-2)" />
          <text x={k1x} y={28} fontSize={11} fill="var(--hi)" textAnchor="middle">
            k1 = Key(&quot;ada&quot;)
          </text>
          <text x={k1x} y={45} fontSize={10} fill="var(--mute)" textAnchor="middle">
            {s.i >= 1 ? `hash ${fmt(h.k1)}` : "add(k1)"}
          </text>
        </g>
        <g opacity={s.i >= 2 ? 1 : 0.45} style={{ transition: "opacity 200ms" }}>
          <rect x={k2x - 60} y={10} width={120} height={44} rx={4} fill="var(--bg)" stroke={s.i >= 2 ? "var(--hot)" : "var(--line-2)"} />
          <text x={k2x} y={28} fontSize={11} fill="var(--hi)" textAnchor="middle">
            k2 = Key(&quot;ada&quot;)
          </text>
          <text x={k2x} y={45} fontSize={10} fill={s.i >= 2 ? "var(--hot)" : "var(--mute)"} textAnchor="middle">
            {s.i >= 2 ? `hash ${fmt(h.k2)}` : "contains(k2)"}
          </text>
        </g>
        {s.i >= 2 && (
          <g>
            <path
              d={`M ${k2x} 56 C ${k2x} 90, ${bx(b2)} 90, ${bx(b2)} ${BY - 6}`}
              fill="none"
              stroke="var(--hot)"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            <text x={(k2x + bx(b2)) / 2 + 8} y={86} fontSize={10} fill="var(--hot)">
              looks in {b2}
            </text>
          </g>
        )}

        {/* buckets */}
        <text x={BX} y={BY - 10} fontSize={10} fill="var(--faint)">
          table[8]
        </text>
        {Array.from({ length: N }, (_, i) => {
          const hasK1 = s.i >= 1 && i === b1;
          const probed = s.i >= 2 && i === b2;
          const result = s.i >= 3 && probed;
          return (
            <g key={i}>
              <rect
                x={BX + i * BW}
                y={BY}
                width={BW}
                height={40}
                fill="var(--bg)"
                stroke={result ? (found ? "var(--live)" : "var(--dead)") : probed ? "var(--hot)" : "var(--line-2)"}
                strokeWidth={probed ? 1.5 : 1}
              />
              <text x={BX + i * BW + 6} y={BY + 12} fontSize={9} fill="var(--faint)">
                {i}
              </text>
              {hasK1 ? (
                <circle cx={bx(i)} cy={BY + 22} r={3.5} fill="var(--ref)" />
              ) : (
                <text x={bx(i)} y={BY + 26} fontSize={10} fill="var(--faint)" textAnchor="middle">
                  ·
                </text>
              )}
            </g>
          );
        })}

        {/* k1 stored: bucket → entry arrow */}
        {s.i >= 1 && (
          <path
            d={`M ${bx(b1)} ${BY + 26} L ${bx(b1)} ${BY + 54}`}
            stroke="var(--ref)"
            strokeWidth={1.25}
            markerEnd={`url(#${head})`}
          />
        )}
        {s.i >= 1 && (
          <text x={bx(b1)} y={BY + 72} fontSize={10} fill="var(--ink)" textAnchor={b1 > 5 ? "end" : "middle"}>
            k1
          </text>
        )}

        {s.i >= 3 && (
          <text x={420} y={BY + 72} fontSize={12} textAnchor="end" fill={found ? "var(--live)" : "var(--dead)"}>
            contains → {String(found)}
          </text>
        )}
      </svg>

      <Narration className="mt-3 min-h-[3.3em]">{notes[mode][s.i]}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
