"use client";

import { useId, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Arrowhead, NARR, ring, tint } from "./kit";

// the real 91 bytes ObjectOutputStream wrote for `new Line(p, p)` on jdk 25 (the chapter's
// runnable example prints them). grammar per the java object serialization spec, ch. 6:
// handles start at 0x7e0000 and are handed out in order: Line's class descriptor, the
// type string "LPoint;", the Line object, Point's descriptor, the Point object.

const HEX =
  "ac ed 00 05 73 72 00 04 4c 69 6e 65 b8 25 02 dd 83 0d 08 c6 02 00 02 4c 00 01 61 74 00 07 4c 50 6f 69 6e 74 3b 4c 00 01 62 71 00 7e 00 01 78 70 73 72 00 05 50 6f 69 6e 74 a8 09 4b 80 51 f2 94 15 02 00 02 49 00 01 78 49 00 01 79 78 70 00 00 00 01 00 00 00 02 71 00 7e 00 04";
const BYTES = HEX.split(" ");

type Obj = "line" | "point" | null;
type Seg = { n: number; tag: string; obj: Obj; handle?: string; refTo?: string; note: ReactNode };

const SEGS: Seg[] = [
  { n: 4, tag: "magic + version", obj: null, note: <>every stream starts with <code>ac ed</code> (the magic number) and protocol version 5.</> },
  { n: 1, tag: "TC_OBJECT", obj: "line", note: <><code>73</code>: a new object follows. before its data, the reader needs to know what class it is.</> },
  { n: 7, tag: 'TC_CLASSDESC "Line"', obj: "line", handle: "7e0000", note: <><code>72</code> + the class name. the descriptor gets handle <code>0x7e0000</code>, so it can be referred to later instead of repeated.</> },
  { n: 8, tag: "serialVersionUID", obj: "line", note: <>8 bytes: the class&apos;s version stamp. Line didn&apos;t declare one, so java hashed the class&apos;s shape to make one up. change the class and this number changes.</> },
  { n: 3, tag: "flags, 2 fields", obj: "line", note: <><code>02</code> = plain Serializable, then a field count. the stream describes the class&apos;s fields by name and type, it doesn&apos;t trust the reader to know them.</> },
  { n: 14, tag: 'field a: "LPoint;"', obj: "line", handle: "7e0001", note: <><code>L</code> means object, then the name <code>a</code> and its type as a string, <code>LPoint;</code>. that string gets a handle too.</> },
  { n: 9, tag: "field b: back-reference", obj: "line", refTo: "7e0001", note: <>field <code>b</code> has the same type, so instead of writing <code>LPoint;</code> again: <code>71</code> (TC_REFERENCE) and the handle <code>00 7e 00 01</code>.</> },
  { n: 2, tag: "end, no superclass", obj: "line", handle: "7e0002", note: <><code>78</code> ends the descriptor, <code>70</code> says no serializable superclass. now the Line object itself gets a handle, and its field values follow.</> },
  { n: 30, tag: "a = new Point, its descriptor", obj: "point", handle: "7e0003", note: <>field a&apos;s value: another <code>73</code>, and Point&apos;s whole descriptor (name, UID, two <code>I</code> fields x and y). Point&apos;s descriptor is handle <code>0x7e0003</code>.</> },
  { n: 8, tag: "Point data: x=1, y=2", obj: "point", handle: "7e0004", note: <>the Point object takes handle <code>0x7e0004</code>, then its fields as raw big-endian ints: 1 and 2. this is where your data actually is.</> },
  { n: 5, tag: "b = back-reference", obj: "point", refTo: "7e0004", note: <>field b points at the same Point. the writer has already seen it, so it writes 5 bytes: &quot;the object with handle <code>0x7e0004</code>&quot;. shared objects are written once, and cycles can&apos;t loop forever.</> },
];

const HANDLES: Record<string, string> = {
  "7e0000": "class Line",
  "7e0001": '"LPoint;"',
  "7e0002": "the Line object",
  "7e0003": "class Point",
  "7e0004": "the Point object",
};

export function SerialStream() {
  const s = useStepper(SEGS.length, { interval: 2400 });
  const id = useId().replace(/:/g, "");
  const seg = SEGS[s.i];
  const start = SEGS.slice(0, s.i).reduce((a, x) => a + x.n, 0);
  const end = start + seg.n;
  const handles = SEGS.slice(0, s.i + 1)
    .filter((x) => x.handle)
    .map((x) => x.handle!);
  const lineOn = seg.obj === "line";
  const pointOn = seg.obj === "point";
  const bDone = s.i === SEGS.length - 1;
  const aDone = s.i >= 9;

  return (
    <div {...s.keys} className="@container outline-none">
      <div className="grid gap-5 @[620px]:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        {/* the object graph */}
        <div>
          <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">in memory</div>
          <svg viewBox="0 0 340 118" className="block w-full max-w-[420px]" role="img" aria-label="a Line object whose fields a and b both reference one Point object">
            <defs>
              <Arrowhead id={`${id}-a`} />
              <Arrowhead id={`${id}-h`} tone="hot" />
            </defs>
            <rect x={6} y={18} width={120} height={84} rx={6} fill="var(--well)" stroke={lineOn ? "var(--hot)" : "var(--line-2)"} />
            <text x={18} y={38} fontSize={12} fontFamily="var(--font-code)" fill={lineOn ? "var(--hot)" : "var(--hi)"}>Line</text>
            {handles.includes("7e0002") && (
              <text x={120} y={38} fontSize={9} textAnchor="end" fontFamily="var(--font-code)" fill="var(--faint)">#7e0002</text>
            )}
            <line x1={14} y1={48} x2={118} y2={48} stroke="var(--line)" />
            <text x={18} y={68} fontSize={11} fontFamily="var(--font-code)" fill="var(--mute)">a</text>
            <text x={18} y={90} fontSize={11} fontFamily="var(--font-code)" fill="var(--mute)">b</text>
            <circle cx={108} cy={64} r={3.5} fill="var(--ref)" />
            <circle cx={108} cy={86} r={3.5} fill="var(--ref)" />
            <path d="M 112 64 C 160 64, 170 50, 214 50" fill="none" stroke={s.i === 8 ? "var(--hot)" : "var(--ref)"} strokeWidth={1.3} markerEnd={`url(#${id}-${s.i === 8 ? "h" : "a"})`} />
            <path d="M 112 86 C 165 86, 172 64, 214 62" fill="none" stroke={bDone ? "var(--hot)" : "var(--ref)"} strokeWidth={1.3} markerEnd={`url(#${id}-${bDone ? "h" : "a"})`} />
            <rect x={218} y={30} width={114} height={62} rx={6} fill="var(--well)" stroke={pointOn ? "var(--hot)" : "var(--line-2)"} />
            <text x={230} y={50} fontSize={12} fontFamily="var(--font-code)" fill={pointOn ? "var(--hot)" : "var(--hi)"}>Point</text>
            {handles.includes("7e0004") && (
              <text x={326} y={50} fontSize={9} textAnchor="end" fontFamily="var(--font-code)" fill="var(--faint)">#7e0004</text>
            )}
            <text x={230} y={72} fontSize={11} fontFamily="var(--font-code)" fill="var(--mute)">x 1</text>
            <text x={230} y={86} fontSize={11} fontFamily="var(--font-code)" fill="var(--mute)">y 2</text>
            <text x={6} y={114} fontSize={10} fontFamily="var(--font-code)" fill="var(--faint)">
              {aDone ? (bDone ? "a and b: one object, written once" : "a written in full") : "two references, one object"}
            </text>
          </svg>
        </div>

        {/* the handle table */}
        <div>
          <div className="mb-2 border-b border-line pb-1.5 text-11 text-faint">handle table (writer and reader both keep one)</div>
          <ul className="grid gap-1 text-12">
            {Object.entries(HANDLES).map(([h, what]) => {
              const has = handles.includes(h);
              const isRef = seg.refTo === h;
              const isNew = seg.handle === h;
              return (
                <li
                  key={h}
                  className="flex items-baseline gap-3 rounded-xs px-2 py-0.5 transition-[background-color,opacity] duration-200"
                  style={{
                    opacity: has ? 1 : 0.3,
                    background: isRef ? tint("ref", 14) : isNew ? tint("hot", 12) : undefined,
                  }}
                >
                  <span className="tabular" style={{ color: isRef ? "var(--ref)" : isNew ? "var(--hot)" : "var(--faint)" }}>
                    0x{h}
                  </span>
                  <span className={has ? "text-ink" : "text-faint"}>{what}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* the bytes */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-1.5 text-11 text-faint">
          <span>the stream · {BYTES.length} bytes</span>
          <span className="text-hot">{seg.tag}</span>
        </div>
        <div className="flex flex-wrap gap-[3px] text-11 tabular sm:text-12">
          {BYTES.map((b, i) => {
            const cur = i >= start && i < end;
            const past = i < start;
            const tone = cur ? (seg.refTo ? "ref" : "hot") : undefined;
            return (
              <span
                key={i}
                className="inline-flex h-6 min-w-[2.4ch] items-center justify-center rounded-[2px] px-[3px] transition-[background-color,color,box-shadow] duration-200"
                style={{
                  color: tone ? `var(--${tone})` : past ? "var(--ink)" : "var(--faint)",
                  background: tone ? tint(tone, 14) : undefined,
                  boxShadow: tone ? ring(tone, 55) : "none",
                  opacity: past || cur ? 1 : 0.55,
                }}
              >
                {b}
              </span>
            );
          })}
        </div>
      </div>

      <p className={`mt-5 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {seg.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
