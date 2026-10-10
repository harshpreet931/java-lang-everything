"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { GROUPS, HEX, LEAVES, type Kind, type Leaf } from "./pointClass";

// a hex viewer for a real class file. every byte belongs to exactly one field of the
// class file structure (see pointClass.ts, parsed from javac's output on jdk 25).
//
// colours: purple (meta) = constant pool entries, blue (ref) = an index that points
// into the constant pool, white = bytecode and the header. hover or click any byte.
// when the selected field is a pool index, the entry it points at is tinted blue.

const BYTES = HEX.match(/../g)!.map((h) => parseInt(h, 16));
const LEAF_AT: number[] = (() => {
  const a = new Array<number>(BYTES.length).fill(-1);
  LEAVES.forEach((l, i) => {
    for (let b = l.s; b < l.s + l.n; b++) a[b] = i;
  });
  return a;
})();
const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const SECTIONS = (() => {
  const out: { name: string; from: number; to: number; first: number }[] = [];
  LEAVES.forEach((l, i) => {
    const sec = GROUP[l.g].sec;
    const last = out[out.length - 1];
    if (last && last.name === sec) last.to = l.s + l.n;
    else out.push({ name: sec, from: l.s, to: l.s + l.n, first: i });
  });
  return out;
})();

const tone: Record<Kind, string> = {
  hdr: "var(--hi)",
  count: "var(--mute)",
  flags: "var(--mute)",
  cp: "var(--meta)",
  utf8: "var(--meta)",
  ref: "var(--ref)",
  code: "var(--hi)",
};

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const off = (n: number) => `0x${n.toString(16).padStart(4, "0")}`;
const printable = (b: number) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "·");

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ClassFileHex() {
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [root, width] = useWidth<HTMLDivElement>();
  const a = hover ?? sel;
  const leaf: Leaf = LEAVES[a];
  const group = GROUP[leaf.g];
  const target = leaf.to !== undefined ? `cp${leaf.to}` : undefined;
  const per = width >= 540 ? 16 : 8;
  const ascii = width >= 700;
  const side = width >= 820;

  const rows = useMemo(() => {
    const r: number[] = [];
    for (let i = 0; i < BYTES.length; i += per) r.push(i);
    return r;
  }, [per]);

  const cellStyle = (b: number) => {
    const li = LEAF_AT[b];
    const l = LEAVES[li];
    if (li === a) return { background: "color-mix(in srgb, var(--hot) 28%, transparent)", color: "var(--hi)" };
    const style: React.CSSProperties = { color: tone[l.k] };
    if (l.g === leaf.g) style.background = "color-mix(in srgb, var(--ink) 9%, transparent)";
    else if (target && l.g === target) style.background = "color-mix(in srgb, var(--ref) 32%, transparent)";
    return style;
  };

  const groupStart = (gid: string) => LEAVES.findIndex((l) => l.g === gid);
  const move = (d: number) => {
    setHover(null);
    setSel((s) => Math.max(0, Math.min(LEAVES.length - 1, s + d)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") (e.preventDefault(), move(1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), move(-1));
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const gi = GROUPS.findIndex((g) => g.id === LEAVES[sel].g);
      const ng = GROUPS[Math.max(0, Math.min(GROUPS.length - 1, gi + (e.key === "ArrowDown" ? 1 : -1)))];
      setHover(null);
      setSel(groupStart(ng.id));
    }
  };

  const curSec = SECTIONS.findIndex((s) => leaf.s >= s.from && leaf.s < s.to);

  const panel = (
    <div className="min-w-0" aria-live="polite">
      <div className="text-11 text-faint tabular">
        {off(leaf.s)}
        {leaf.n > 1 ? ` to ${off(leaf.s + leaf.n - 1)}` : ""} · {leaf.n} byte{leaf.n > 1 ? "s" : ""} · {group.sec}
      </div>
      <div className="mt-2 text-15 break-words text-hi">{group.title}</div>
      <div className="mt-3 rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">{leaf.name} = </span>
        <span style={{ color: tone[leaf.k] === "var(--mute)" ? "var(--hi)" : tone[leaf.k] }} className="break-words">
          {leaf.value}
        </span>
        {leaf.n <= 4 && (
          <div className="mt-1 text-11 text-faint tabular">
            bytes: {BYTES.slice(leaf.s, leaf.s + leaf.n).map(hex2).join(" ")}
          </div>
        )}
      </div>
      {target && (
        <button
          className="mt-2 text-left text-12 text-ref hover:text-hi"
          onClick={() => (setHover(null), setSel(groupStart(target)))}
        >
          → points at {GROUP[target].title}
        </button>
      )}
      <p className="mt-3 font-serif text-17 leading-[1.6] text-ink">{group.note}</p>
      <div className="mt-4 flex gap-1.5">
        <button className="act" onClick={() => move(-1)} disabled={sel === 0} aria-label="previous field">
          ← field
        </button>
        <button className="act" onClick={() => move(1)} disabled={sel === LEAVES.length - 1} aria-label="next field">
          field →
        </button>
      </div>
    </div>
  );

  return (
    <div ref={root} className="outline-none" tabIndex={0} onKeyDown={onKey} aria-label="hex dump of Point.class. use the arrow keys to move between fields.">
      {/* section strip: where the 224 bytes go */}
      <div className="mb-5">
        <div className="flex h-2 w-full gap-px" aria-hidden>
          {SECTIONS.map((s, i) => (
            <div
              key={s.name}
              className="h-full transition-colors duration-200"
              style={{
                flexGrow: s.to - s.from,
                background: i === curSec ? "var(--hot)" : s.name === "constant pool" ? "color-mix(in srgb, var(--meta) 55%, transparent)" : "var(--line-2)",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
          {SECTIONS.map((s, i) => (
            <button
              key={s.name}
              className="word !min-h-7 !px-2 !text-12"
              aria-pressed={i === curSec}
              onClick={() => (setHover(null), setSel(s.first))}
            >
              {s.name} <span className="ml-1.5 opacity-60 tabular">{s.to - s.from}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={side ? "grid grid-cols-[auto_minmax(0,1fr)] gap-8" : "grid gap-6"}>
        <div className="overflow-x-auto" onMouseLeave={() => setHover(null)}>
          <div className="w-max text-12 leading-[1.9] tabular sm:text-13">
            {rows.map((r) => (
              <div key={r} className="flex items-center">
                <span className="mr-3 w-[5ch] text-11 text-faint/70 select-none">{r.toString(16).padStart(4, "0")}</span>
                <span className="flex">
                  {BYTES.slice(r, r + per).map((b, j) => {
                    const i = r + j;
                    return (
                      <span
                        key={i}
                        onMouseEnter={() => setHover(LEAF_AT[i])}
                        onClick={() => (setSel(LEAF_AT[i]), setHover(null))}
                        className={`cursor-pointer px-[3px] transition-colors duration-100 ${j === 8 ? "ml-2" : ""}`}
                        style={cellStyle(i)}
                      >
                        {hex2(b)}
                      </span>
                    );
                  })}
                </span>
                {ascii && (
                  <span className="ml-4 flex text-faint">
                    {BYTES.slice(r, r + per).map((b, j) => {
                      const i = r + j;
                      const st = cellStyle(i);
                      return (
                        <span
                          key={i}
                          onMouseEnter={() => setHover(LEAF_AT[i])}
                          onClick={() => (setSel(LEAF_AT[i]), setHover(null))}
                          className="w-[1ch] cursor-pointer text-center"
                          style={{ ...st, color: LEAF_AT[i] === a ? "var(--hi)" : LEAVES[LEAF_AT[i]].k === "utf8" ? "var(--meta)" : "var(--faint)" }}
                        >
                          {printable(b)}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-11">
            <span style={{ color: "var(--meta)" }}>constant pool</span>
            <span style={{ color: "var(--ref)" }}>index into the pool</span>
            <span className="text-hi">header + bytecode</span>
            <span className="text-mute">counts + flags</span>
          </div>
        </div>
        {panel}
      </div>
    </div>
  );
}
