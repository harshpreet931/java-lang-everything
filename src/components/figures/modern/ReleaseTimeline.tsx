"use client";

import { useState, type ReactNode } from "react";
import { RELEASES, STAGE_LABEL, TRACKS, type Kind, type Stage, type Track } from "./releases";
import { Row, Words, ring, tint, useWidth } from "../functional/kit";

// every release from 8 to 28 as columns, and the features that went through
// incubation or preview as tracks across them. data (and sources) in ./releases.ts.

const MONTH = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const fmt = (ga: string) => {
  const [y, m, d] = ga.split("-").map(Number);
  return d ? `${MONTH[m - 1]} ${d}, ${y}` : `${MONTH[m - 1]} ${y}`;
};
const KIND_LABEL: Record<Kind, string> = { lang: "language", api: "api", jvm: "jvm", tools: "tools" };

function Glyph({ s, size = 14 }: { s: Stage; size?: number }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="block">
      {s === "f" && <circle cx={c} cy={c} r={c - 2} fill="var(--live)" />}
      {s === "p" && (
        <>
          <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.25} />
          <path d={`M ${c} 2 A ${c - 2} ${c - 2} 0 0 1 ${c} ${size - 2} z`} fill="var(--ink)" />
        </>
      )}
      {s === "i" && <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--mute)" strokeWidth={1.25} strokeDasharray="2 2" />}
      {s === "e" && <rect x={2.5} y={2.5} width={size - 5} height={size - 5} rx={1} fill="var(--bg)" stroke="var(--mute)" strokeWidth={1.25} strokeDasharray="2 2" />}
      {s === "x" && (
        <g stroke="var(--dead)" strokeWidth={1.75} strokeLinecap="round">
          <line x1={3} y1={3} x2={size - 3} y2={size - 3} />
          <line x1={size - 3} y1={3} x2={3} y2={size - 3} />
        </g>
      )}
      {s === "t" && <circle cx={c} cy={c} r={c - 2} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.25} strokeDasharray="1.5 2.5" />}
    </svg>
  );
}

type Focus = { kind: "release"; v: number } | { kind: "track"; id: string };

export function ReleaseTimeline() {
  const [show, setShow] = useState<"all" | Kind>("all");
  const [zoom, setZoom] = useState<number | null>(null);
  const [box, w] = useWidth<HTMLDivElement>(760);
  const [focus, setFocus] = useState<Focus>({ kind: "release", v: 25 });
  const tracks = TRACKS.filter((t) => show === "all" || t.kind === show);
  const selV = focus.kind === "release" ? focus.v : null;
  const selT = focus.kind === "track" ? focus.id : null;
  const nameW = w < 520 ? 124 : 168;
  const vs = RELEASES.map((r) => r.v);
  const fit = Math.max(24, Math.floor((w - nameW - 2) / vs.length));
  const col = zoom ?? fit;
  const idx = (v: number) => vs.indexOf(v);

  const move = (d: number) => {
    const cur = selV ?? 25;
    const i = Math.max(0, Math.min(vs.length - 1, idx(cur) + d));
    setFocus({ kind: "release", v: vs[i] });
  };

  return (
    <div className="grid gap-4">
      <div>
        <Row k="show =" w="7ch">
          <Words
            options={[
              { v: "all", label: "all" },
              { v: "lang", label: "language" },
              { v: "api", label: "api" },
              { v: "jvm", label: "jvm" },
            ]}
            value={show}
            onChange={setShow}
            label="which tracks"
          />
        </Row>
        <Row k="zoom =" w="7ch" last>
          <input
            type="range"
            className="slider w-full max-w-[260px]"
            min={Math.min(fit, 24)}
            max={64}
            value={col}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="column width"
          />
        </Row>
      </div>

      <div
        ref={box}
        className="relative min-w-0 overflow-x-auto rounded-md bg-bg/50 shadow-[inset_0_0_0_1px_var(--line)]"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") (e.preventDefault(), move(1));
          if (e.key === "ArrowLeft") (e.preventDefault(), move(-1));
        }}
        aria-label="java releases 8 to 28, with feature tracks"
      >
        <div style={{ width: nameW + col * vs.length }} className="relative">
          {/* release header */}
          <div className="flex border-b border-line-2">
            <div className="sticky left-0 z-20 flex items-end bg-well px-3 pb-1.5 text-11 text-faint" style={{ width: nameW, minWidth: nameW }}>
              release →
            </div>
            {RELEASES.map((r) => {
              const on = selV === r.v;
              return (
                <button
                  key={r.v}
                  onClick={() => setFocus({ kind: "release", v: r.v })}
                  aria-pressed={on}
                  aria-label={`java ${r.v}${r.lts ? ", LTS" : ""}${r.dev ? ", in development" : ""}`}
                  className="flex flex-col items-center gap-0.5 py-1.5 transition-colors duration-150"
                  style={{ width: col, minWidth: col, background: on ? "var(--well-2)" : undefined }}
                >
                  <span className={`text-13 tabular ${on ? "text-hot" : r.lts ? "text-hi" : r.dev ? "text-faint" : "text-ink"}`} style={{ fontWeight: r.lts ? 600 : 400 }}>
                    {r.v}
                  </span>
                  <span className="text-[10px] leading-none text-faint tabular">{r.lts ? "LTS" : r.dev ? "dev" : "'" + r.ga.slice(2, 4)}</span>
                </button>
              );
            })}
          </div>

          {/* tracks */}
          {tracks.map((t) => {
            const on = selT === t.id;
            const first = idx(t.steps[0].v);
            const last = idx(t.steps[t.steps.length - 1].v);
            return (
              <div key={t.id} className="flex border-b border-line last:border-b-0" style={{ background: on ? tint("hot", 7) : undefined }}>
                <button
                  onClick={() => setFocus({ kind: "track", id: t.id })}
                  aria-pressed={on}
                  className={`sticky left-0 z-10 truncate px-3 py-1.5 text-left text-12 transition-colors duration-150 ${on ? "text-hot" : "text-ink hover:text-hi"}`}
                  style={{ width: nameW, minWidth: nameW, background: on ? "color-mix(in srgb, var(--hot) 7%, var(--well))" : "var(--well)" }}
                  title={t.name}
                >
                  {t.short}
                </button>
                {vs.map((v, i) => {
                  const step = t.steps.find((s) => s.v === v);
                  const inLine = i >= first && i <= last;
                  return (
                    <div
                      key={v}
                      className="relative flex items-center justify-center"
                      style={{ width: col, minWidth: col, background: selV === v ? "var(--well-2)" : undefined }}
                    >
                      {inLine && (
                        <span
                          className="absolute top-1/2 h-px"
                          style={{
                            left: i === first ? "50%" : 0,
                            right: i === last ? "50%" : 0,
                            background: on ? "var(--hot)" : "var(--line-2)",
                          }}
                        />
                      )}
                      {step && (
                        <button
                          className="relative z-[1] rounded-full"
                          onClick={() => setFocus({ kind: "track", id: t.id })}
                          title={`${t.name}: ${STAGE_LABEL[step.s]} in ${v} (JEP ${step.jep})`}
                          aria-label={`${t.name}, ${STAGE_LABEL[step.s]} in java ${v}, JEP ${step.jep}`}
                        >
                          <Glyph s={step.s} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-11 text-faint">
        {(["i", "e", "p", "f", "x", "t"] as Stage[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <Glyph s={s} size={12} /> {STAGE_LABEL[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="text-12 font-semibold text-hi">21</span> LTS
        </span>
      </div>

      <div className="border-t border-line pt-4" aria-live="polite">
        {focus.kind === "release" ? <ReleasePanel v={focus.v} move={move} /> : <TrackPanel t={TRACKS.find((x) => x.id === focus.id)!} />}
      </div>
    </div>
  );
}

function ReleasePanel({ v, move }: { v: number; move: (d: number) => void }) {
  const r = RELEASES.find((x) => x.v === v)!;
  const tracksHere = TRACKS.flatMap((t) => t.steps.filter((s) => s.v === v && s.s !== "f").map((s) => ({ t, s })));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-20 text-hi tabular">java {r.v}</span>
        <span className="text-12 text-mute">{r.dev ? `planned for ${fmt(r.ga)}` : fmt(r.ga)}</span>
        {r.lts && <Tag>LTS</Tag>}
        {r.dev && <Tag>in development</Tag>}
        {r.previews !== undefined && <span className="text-11 text-faint">{r.previews} preview / incubator / experimental JEPs</span>}
        <span className="ml-auto flex gap-1.5">
          <button className="act !px-2.5" onClick={() => move(-1)} disabled={r.v === 8} aria-label="previous release">
            ←
          </button>
          <button className="act !px-2.5" onClick={() => move(1)} disabled={r.v === 28} aria-label="next release">
            →
          </button>
        </span>
      </div>
      {r.final.length > 0 ? (
        <ul className="grid gap-1.5 text-13">
          {r.final.map((f) => (
            <li key={f.t} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
              <span className="text-live">✓</span>
              <span className="font-serif text-16 leading-[1.45] text-ink">{f.t}</span>
              <span className="text-11 text-faint">
                {KIND_LABEL[f.kind]}
                {f.jep && (
                  <>
                    {" · "}
                    <a href={`https://openjdk.org/jeps/${f.jep}`} target="_blank" rel="noreferrer" className="plain text-link hover:underline">
                      JEP {f.jep}
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-serif text-16 text-ink">no final features at all. every JEP in 20 was a preview or an incubator: the release where a lot of java 21 was rehearsed.</p>
      )}
      {r.gone && (
        <ul className="grid gap-1 text-12 text-mute">
          {r.gone.map((g) => (
            <li key={g}>
              <span className="text-dead">− </span>
              {g}
            </li>
          ))}
        </ul>
      )}
      {tracksHere.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-11">
          <span className="mr-1 text-faint">also in {r.v}, not final:</span>
          {tracksHere.map(({ t, s }) => (
            <span key={t.id} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
              <Glyph s={s.s} size={11} />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackPanel({ t }: { t: Track }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-20 text-hi">{t.name}</span>
        <Tag>{KIND_LABEL[t.kind]}</Tag>
        {t.chapter && (
          <a href={t.chapter} className="plain text-12 text-link hover:underline">
            read the chapter →
          </a>
        )}
      </div>
      <p className="font-serif text-17 leading-[1.6] text-ink">{t.says}</p>
      <ol className="grid gap-1 text-12">
        {t.steps.map((s) => (
          <li key={s.v} className="grid grid-cols-[3ch_14px_12ch_minmax(0,1fr)] items-center gap-x-2.5">
            <span className="text-right text-hi tabular">{s.v}</span>
            <Glyph s={s.s} size={12} />
            <span className={s.s === "f" ? "text-live" : s.s === "x" ? "text-dead" : "text-mute"}>{STAGE_LABEL[s.s]}</span>
            <span className="text-faint">
              <a href={`https://openjdk.org/jeps/${s.jep}`} target="_blank" rel="noreferrer" className="plain text-link hover:underline">
                JEP {s.jep}
              </a>
              {s.note && <span className="text-mute"> · {s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm px-1.5 text-11 leading-[20px] text-hi" style={{ boxShadow: ring(null) }}>
      {children}
    </span>
  );
}

/* ---- what you get when you jump from one LTS to the next ---------------------- */

const LTS = RELEASES.filter((r) => r.lts).map((r) => r.v);

export function UpgradeDiff() {
  const [from, setFrom] = useState(17);
  const [to, setTo] = useState(25);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const span = RELEASES.filter((r) => r.v > lo && r.v <= hi);
  const feats = span.flatMap((r) => r.final.map((f) => ({ ...f, v: r.v })));
  const kinds: Kind[] = ["lang", "api", "jvm", "tools"];

  return (
    <div className="grid gap-4">
      <div>
        <Row k="from =" w="6ch">
          <Words options={LTS.slice(0, -1).map((v) => ({ v, label: `java ${v}` }))} value={from} onChange={(v) => (setFrom(v), v >= to && setTo(LTS[LTS.indexOf(v) + 1]))} label="upgrade from" />
        </Row>
        <Row k="to =" w="6ch" last>
          <Words options={LTS.slice(1).map((v) => ({ v, label: `java ${v}` }))} value={to} onChange={(v) => (setTo(v), v <= from && setFrom(LTS[LTS.indexOf(v) - 1]))} label="upgrade to" />
        </Row>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-12" aria-live="polite">
        <span className="text-20 text-hi tabular">{feats.length}</span>
        <span className="text-mute">
          headline final features across {span.length} releases ({lo + 1} to {hi}), {span.reduce((a, r) => a + (r.previews ?? 0), 0)} preview, incubator or experimental JEPs along the way.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {kinds.map((k) => {
          const fs = feats.filter((f) => f.kind === k);
          if (!fs.length) return null;
          return (
            <div key={k} className="min-w-0">
              <div className="mb-1.5 text-11 text-faint">
                {KIND_LABEL[k]} · {fs.length}
              </div>
              <ul className="grid gap-1">
                {fs.map((f) => (
                  <li key={f.t} className="grid grid-cols-[3ch_minmax(0,1fr)] gap-x-2 text-12 leading-[1.5]">
                    <span className="text-right text-faint tabular">{f.v}</span>
                    <span className="text-ink">{f.t}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
