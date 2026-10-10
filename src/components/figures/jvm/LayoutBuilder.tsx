"use client";

import { useState } from "react";

// field layout, the way HotSpot (jdk 15+) does it for a class with no superclass fields:
//   1. the header takes the first 8, 12 or 16 bytes
//   2. primitive fields go in by size, largest first (declaration order breaks ties)
//   3. then references
//   4. each field takes the first free, aligned gap big enough for it (so small
//      fields fill holes left by alignment)
//   5. the total is rounded up to 8 bytes
// checked against `jcmd <pid> VM.classes -verbose` (it prints every field's offset)
// on jdk 25 for Point, Mixed, OneLong, OneByte, OneRef and Empty in all four modes below.

type T = "boolean" | "byte" | "short" | "char" | "int" | "float" | "long" | "double" | "Object";
type Mode = "default" | "compact" | "nooops" | "noccp";

const SIZE: Record<Exclude<T, "Object">, number> = { boolean: 1, byte: 1, short: 2, char: 2, int: 4, float: 4, long: 8, double: 8 };
export const MODES: { id: Mode; label: string; header: number; ref: number; flag: string }[] = [
  { id: "default", label: "default", header: 12, ref: 4, flag: "jdk 25 default" },
  { id: "compact", label: "compact headers", header: 8, ref: 4, flag: "-XX:+UseCompactObjectHeaders" },
  { id: "nooops", label: "no compressed oops", header: 12, ref: 8, flag: "-XX:-UseCompressedOops (or a heap over 32 GB)" },
  { id: "noccp", label: "no compressed class ptrs", header: 16, ref: 4, flag: "-XX:-UseCompressedClassPointers (deprecated in 25)" },
];

type Field = { name: string; type: T };
const PRESETS: { label: string; fields: Field[] }[] = [
  { label: "Point", fields: [{ name: "x", type: "int" }, { name: "y", type: "int" }] },
  {
    label: "Mixed",
    fields: [
      { name: "flag", type: "boolean" },
      { name: "b", type: "byte" },
      { name: "id", type: "long" },
      { name: "count", type: "int" },
      { name: "ref", type: "Object" },
      { name: "s", type: "short" },
      { name: "c", type: "char" },
      { name: "d", type: "double" },
    ],
  },
  { label: "Long", fields: [{ name: "value", type: "long" }] },
  { label: "empty", fields: [] },
];
const NAMES = "abcdefghijklmnopqrstuvwxyz";

type Placed = { name: string; type: T; at: number; size: number };

export function layout(fields: Field[], mode: (typeof MODES)[number]) {
  const sizeOf = (f: Field) => (f.type === "Object" ? mode.ref : SIZE[f.type]);
  const order = fields
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const ra = a.f.type === "Object" ? 1 : 0;
      const rb = b.f.type === "Object" ? 1 : 0;
      if (ra !== rb) return ra - rb; // primitives first
      if (!ra) return sizeOf(b.f) - sizeOf(a.f) || a.i - b.i; // bigger first
      return a.i - b.i;
    });
  const used: [number, number][] = [[0, mode.header]];
  const free = (at: number, n: number) => used.every(([s, e]) => at + n <= s || at >= e);
  const placed: Placed[] = [];
  for (const { f } of order) {
    const n = sizeOf(f);
    let at = 0;
    // first aligned spot that fits, scanning from the start of the object
    for (let cand = 0; ; cand += n) {
      if (cand < mode.header) continue;
      if (free(cand, n)) {
        at = cand;
        break;
      }
    }
    used.push([at, at + n]);
    placed.push({ name: f.name, type: f.type, at, size: n });
  }
  const end = Math.max(mode.header, ...placed.map((p) => p.at + p.size));
  const total = Math.ceil(end / 8) * 8;
  return { placed, total, end };
}

export function LayoutBuilder() {
  const [fields, setFields] = useState<Field[]>(PRESETS[1].fields);
  const [modeId, setModeId] = useState<Mode>("default");
  const mode = MODES.find((m) => m.id === modeId)!;
  const { placed, total } = layout(fields, mode);
  const data = placed.reduce((a, p) => a + p.size, 0);
  const waste = total - mode.header - data;
  const rows = total / 8;

  const add = (t: T) =>
    setFields((fs) => (fs.length >= 12 ? fs : [...fs, { name: NAMES.split("").find((n) => !fs.some((f) => f.name === n)) ?? "z", type: t }]));

  const cell = (byte: number) => {
    if (byte < mode.header) {
      return { kind: "header" as const, label: byte < 8 ? "mark" : "class" };
    }
    const p = placed.find((q) => byte >= q.at && byte < q.at + q.size);
    if (p) return { kind: "field" as const, p };
    return { kind: "gap" as const };
  };

  return (
    <div className="@container">
      <div className="grid grid-cols-[8ch_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line pb-3 text-13">
        <span className="pt-1.5 text-faint">mode =</span>
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button key={m.id} className="word" aria-pressed={modeId === m.id} onClick={() => setModeId(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="pt-1.5 text-faint">start =</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="word"
              aria-pressed={JSON.stringify(p.fields) === JSON.stringify(fields)}
              onClick={() => setFields(p.fields)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="pt-1.5 text-faint">add =</span>
        <div className="flex flex-wrap gap-1">
          {(["boolean", "byte", "short", "char", "int", "float", "long", "double", "Object"] as T[]).map((t) => (
            <button key={t} className="act !min-h-7 !px-2 !text-12" onClick={() => add(t)} disabled={fields.length >= 12}>
              + {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 flex justify-between text-[10px] text-faint">
            <span>offset</span>
            <span>one row = 8 bytes</span>
          </div>
          <div className="flex flex-col gap-1">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="grid grid-cols-[3ch_repeat(8,minmax(0,1fr))] items-stretch gap-[2px]">
                <span className="pr-1 text-right text-[10px] leading-8 text-faint tabular">{r * 8}</span>
                {Array.from({ length: 8 }, (_, c) => {
                  const b = r * 8 + c;
                  const k = cell(b);
                  const first = k.kind === "field" && k.p.at === b;
                  const style: React.CSSProperties =
                    k.kind === "header"
                      ? { background: "color-mix(in srgb, var(--meta) 16%, transparent)", color: "var(--meta)" }
                      : k.kind === "field"
                        ? {
                            background: k.p.type === "Object" ? "color-mix(in srgb, var(--ref) 16%, transparent)" : "var(--well-2)",
                            color: k.p.type === "Object" ? "var(--ref)" : "var(--hi)",
                          }
                        : {
                            background: "repeating-linear-gradient(135deg, transparent 0 3px, var(--line-2) 3px 4px)",
                            color: "var(--faint)",
                          };
                  return (
                    <span
                      key={c}
                      className="flex h-8 min-w-0 items-center justify-center overflow-hidden rounded-[3px] text-[10px] leading-none"
                      style={style}
                      title={k.kind === "field" ? `${k.p.type} ${k.p.name} @${k.p.at}` : k.kind}
                    >
                      {k.kind === "header" && (b === 0 || (b === 8 && mode.header > 8)) ? k.label : ""}
                      {first && k.kind === "field" ? k.p.name : ""}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11">
            <span className="text-meta">header</span>
            <span className="text-hi">primitive</span>
            <span className="text-ref">reference</span>
            <span className="text-faint">gap / padding</span>
          </div>
        </div>

        <div className="min-w-0 text-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5">
            <span className="text-mute">header</span>
            <span className="text-meta tabular">{mode.header} B</span>
            <span className="text-mute">fields</span>
            <span className="text-hi tabular">{data} B</span>
            <span className="text-mute">gaps + padding</span>
            <span className={`tabular ${waste > 0 ? "text-dead" : "text-faint"}`}>{waste} B</span>
            <span className="border-t border-line pt-1.5 text-hi">instance size</span>
            <span className="border-t border-line pt-1.5 text-15 text-hi tabular">{total} B</span>
          </div>
          <div className="mt-4 text-11 text-faint">field offsets (as jcmd VM.classes -verbose prints them)</div>
          <div className="mt-1 max-h-[180px] overflow-auto rounded-md bg-well px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]">
            {placed.length === 0 && <div className="text-faint">no fields</div>}
            {[...placed]
              .sort((a, b) => a.at - b.at)
              .map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2 py-[2px]">
                  <span className={p.type === "Object" ? "text-ref" : "text-ink"}>
                    {p.type} {p.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-faint tabular">@{p.at}</span>
                    <button
                      className="text-faint hover:text-dead"
                      aria-label={`remove ${p.name}`}
                      onClick={() => setFields((fs) => fs.filter((f) => f.name !== p.name))}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-2 text-11 leading-[1.5] text-faint">{mode.flag}</div>
        </div>
      </div>
    </div>
  );
}
