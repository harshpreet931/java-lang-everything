"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CASES, hhmm, resolve } from "./dst";
import { Java, Narr, Row } from "./kit";

// two clocks for the same night: the wall clock in the zone (top) and the UTC instant line (bottom).
// lines join each local time to the instant(s) it means. see dst.ts for where the numbers come from.

// the svg is drawn at its real pixel width (measured), so text stays 11px on a phone and on a desktop.
const L0 = 34;
const TOP = 62;
const BOT = 150;
const H = 192;

export function DstSlider() {
  const [cid, setCid] = useState("ny-spring");
  const [t, setT] = useState(150);
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pick = (id: string) => {
    const n = CASES.find((x) => x.id === id)!;
    setCid(id);
    // land in the interesting hour: the middle of the gap or the overlap
    setT(n.after > n.before ? n.at + 30 : n.at - 30);
  };
  const K = (W - 2 * L0) / 300; // px per minute, shared by both axes
  const c = CASES.find((x) => x.id === cid)!;
  const r = resolve(c, t);

  const uMin = 0 - c.before; // utc minutes (from utc midnight) of local 00:00
  const uMax = 240 - c.after;
  const xl = (l: number) => L0 + l * K;
  const xu = (u: number) => L0 + (u - uMin) * K;
  const shift = c.after - c.before;
  const gap = shift > 0 ? [c.at, c.at + shift] : null;
  const over = shift < 0 ? [c.at + shift, c.at] : null;

  // mapping lines, every 15 minutes of real (utc) time
  const maps: { l: number; u: number }[] = [];
  for (let u = uMin; u <= uMax; u += 15) {
    const tr = c.at - c.before; // utc minute of the transition
    const off = u < tr ? c.before : c.after;
    maps.push({ l: u + off, u });
  }

  const sel = [{ l: r.local, u: r.local - r.offset, later: false }];
  if (r.kind === "overlap" && r.laterOffset !== undefined) sel.push({ l: r.local, u: r.local - r.laterOffset, later: true });

  const utcHours: number[] = [];
  for (let h = Math.ceil(uMin / 60) * 60; h <= uMax; h += 60) utcHours.push(h);
  const utcLabel = (u: number) => hhmm(((u % 1440) + 1440) % 1440);

  return (
    <div className="@container grid gap-4 font-mono">
      <div className="text-13">
        <Row k="zone =" w="7ch">
          <div className="flex flex-wrap gap-1" role="group" aria-label="zone and transition">
            {CASES.map((x) => (
              <button key={x.id} className="word" aria-pressed={x.id === cid} onClick={() => pick(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </Row>
        <Row k="local =" w="7ch" last>
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="slider min-w-0 flex-1"
              min={0}
              max={240}
              step={15}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              aria-label="local wall-clock time"
            />
            <span className="w-[5ch] text-right text-hi tabular">{hhmm(t)}</span>
          </div>
        </Row>
      </div>

      <div ref={box} className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label={`${c.date} ${hhmm(t)} in ${c.zone} resolves to ${r.zdt}`}>
        <defs>
          <pattern id={`hatch-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--dead)" strokeWidth="1.5" opacity="0.55" />
          </pattern>
        </defs>

        <text x={L0} y={14} fontSize={11} fill="var(--faint)" fontFamily="var(--font-code)">
          wall clock in {c.zone} · {c.date}
        </text>
        <text x={L0} y={H - 4} fontSize={11} fill="var(--faint)" fontFamily="var(--font-code)">
          UTC instants
        </text>

        {/* gap / overlap regions on the wall clock */}
        {gap && (
          <g>
            <rect x={xl(gap[0])} y={TOP - 10} width={(gap[1] - gap[0]) * K} height={18} fill={`url(#hatch-${uid})`} stroke="var(--dead)" strokeWidth={1} />
            <text x={xl((gap[0] + gap[1]) / 2)} y={TOP - 30} textAnchor="middle" fontSize={11} fill="var(--dead)" fontFamily="var(--font-code)">
              never happens
            </text>
          </g>
        )}
        {over && (
          <g>
            <rect x={xl(over[0])} y={TOP - 10} width={(over[1] - over[0]) * K} height={18} fill="none" stroke="var(--mute)" strokeDasharray="3 3" />
            <text x={xl((over[0] + over[1]) / 2)} y={TOP - 30} textAnchor="middle" fontSize={11} fill="var(--mute)" fontFamily="var(--font-code)">
              happens twice
            </text>
          </g>
        )}

        {/* mapping lines */}
        {maps.map((m, i) => (
          <line key={i} x1={xl(m.l)} y1={TOP + 26} x2={xu(m.u)} y2={BOT - 6} stroke="var(--line-2)" strokeWidth={1} />
        ))}

        {/* axes */}
        <line x1={xl(0)} y1={TOP} x2={xl(240)} y2={TOP} stroke="var(--mute)" />
        <line x1={xu(uMin)} y1={BOT} x2={xu(uMax)} y2={BOT} stroke="var(--mute)" />
        {[0, 60, 120, 180, 240].map((l) => (
          <g key={l}>
            <line x1={xl(l)} y1={TOP - 4} x2={xl(l)} y2={TOP + 4} stroke="var(--mute)" />
            <text x={xl(l)} y={TOP + 20} textAnchor="middle" fontSize={11} fill="var(--mute)" fontFamily="var(--font-code)">
              {hhmm(l)}
            </text>
          </g>
        ))}
        {utcHours.map((u) => (
          <g key={u}>
            <line x1={xu(u)} y1={BOT - 4} x2={xu(u)} y2={BOT + 4} stroke="var(--mute)" />
            <text x={xu(u)} y={BOT + 16} textAnchor="middle" fontSize={11} fill="var(--mute)" fontFamily="var(--font-code)">
              {utcLabel(u)}Z
            </text>
          </g>
        ))}

        {/* what you asked for, and where java put it */}
        <line x1={xl(t)} y1={TOP - 10} x2={xl(t)} y2={TOP + 10} stroke={r.kind === "gap" ? "var(--dead)" : "var(--hot)"} strokeWidth={2} />
        {r.kind === "gap" && (
          <path
            d={`M ${xl(t)} ${TOP - 12} C ${xl(t)} ${TOP - 24}, ${xl(r.local)} ${TOP - 24}, ${xl(r.local)} ${TOP - 6}`}
            fill="none"
            stroke="var(--hot)"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
        )}
        {sel.map((s, i) => (
          <g key={i} opacity={s.later ? 0.6 : 1}>
            <line
              x1={xl(s.l)}
              y1={TOP + 6}
              x2={xu(s.u)}
              y2={BOT - 6}
              stroke="var(--hot)"
              strokeWidth={2}
              strokeDasharray={s.later ? "4 3" : undefined}
              className="transition-all duration-200 ease-jle"
            />
            <circle cx={xu(s.u)} cy={BOT} r={4} fill="var(--hot)" />
            <circle cx={xl(s.l)} cy={TOP} r={4} fill="var(--hot)" />
          </g>
        ))}
      </svg>
      </div>

      <div className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.8] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        <div>
          <Java code={`ZonedDateTime.of(LocalDateTime.parse("${c.date}T${hhmm(t)}"), ZoneId.of("${c.zone}"))`} />
        </div>
        <div>
          <span className="text-faint">→ </span>
          <span className="text-hot">{r.zdt}</span>
          <span className="text-faint">{"   "}= {r.instant}</span>
        </div>
        {r.kind === "overlap" && (
          <div>
            <span className="text-faint">.withLaterOffsetAtOverlap() → </span>
            <span className="text-ink">{r.zdtLater}</span>
            <span className="text-faint">{"   "}= {r.instantLater}</span>
          </div>
        )}
      </div>

      <Narr className="min-h-[3.2em]">
        {r.kind === "gap"
          ? `${hhmm(t)} never happens on this date: the clocks jump from ${hhmm(gap![0])} straight to ${hhmm(gap![1])}. java doesn't throw, it quietly moves your time forward by the length of the gap, to ${hhmm(r.local)}.`
          : r.kind === "overlap"
            ? `${hhmm(t)} happens twice: once before the clocks go back, once after. java picks the earlier one by default. ask for the later one if that's what you mean.`
            : `an ordinary time. exactly one instant matches it.`}
      </Narr>
    </div>
  );
}
