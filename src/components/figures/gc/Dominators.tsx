"use client";

import { useId, useMemo, useState } from "react";
import { Heads, Row, Stat, Words, tint, useWidth } from "./kit";

// shallow vs retained size, and the dominator tree, on a tiny heap you can click.
// shallow sizes are what HotSpot uses with compressed oops (12-byte header, 4-byte refs,
// 16-byte array header, 8-byte alignment): ArrayList 24, Object[10] 56, a two-field
// record 24, byte[1024] 1,040, a one-field record 16, byte[4096] 4,112.

// x is a column (0 to 3), lvl a row
type N = { id: string; label: string; size: number; x: number; lvl: number; root?: boolean };

const NODES: N[] = [
  { id: "R1", label: "static listeners", size: 0, x: 1, lvl: 0, root: true },
  { id: "R2", label: "local config", size: 0, x: 3, lvl: 0, root: true },
  { id: "A", label: "ArrayList", size: 24, x: 1, lvl: 1 },
  { id: "B", label: "Object[10]", size: 56, x: 1, lvl: 2 },
  { id: "L1", label: "Listener", size: 24, x: 0, lvl: 3 },
  { id: "L2", label: "Listener", size: 24, x: 1, lvl: 3 },
  { id: "L3", label: "Listener", size: 24, x: 2, lvl: 3 },
  { id: "S1", label: "byte[1024]", size: 1040, x: 0, lvl: 4 },
  { id: "S2", label: "byte[1024]", size: 1040, x: 1, lvl: 4 },
  { id: "S3", label: "byte[1024]", size: 1040, x: 2, lvl: 4 },
  { id: "C", label: "Config", size: 16, x: 3, lvl: 4 },
  { id: "K", label: "byte[4096]", size: 4112, x: 3, lvl: 5 },
];
const BASE: [string, string][] = [
  ["R1", "A"], ["A", "B"], ["B", "L1"], ["B", "L2"], ["B", "L3"],
  ["L1", "S1"], ["L2", "S2"], ["L3", "S3"], ["L1", "C"], ["L2", "C"], ["C", "K"],
];

function analyze(edges: [string, string][]) {
  const ids = ["ROOT", ...NODES.map((n) => n.id)];
  const preds: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]));
  const all: [string, string][] = [...NODES.filter((n) => n.root).map((n) => ["ROOT", n.id] as [string, string]), ...edges];
  all.forEach(([a, b]) => preds[b].push(a));
  // reachable from the super-root
  const reach = new Set<string>(["ROOT"]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, b] of all) if (reach.has(a) && !reach.has(b)) (reach.add(b), (grew = true));
  }
  const live = ids.filter((i) => reach.has(i));
  // iterative dominator sets: dom(n) = {n} ∪ ⋂ dom(p) over reachable preds
  const dom: Record<string, Set<string>> = {};
  live.forEach((i) => (dom[i] = i === "ROOT" ? new Set(["ROOT"]) : new Set(live)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of live) {
      if (n === "ROOT") continue;
      const ps = preds[n].filter((p) => reach.has(p));
      let s: string[] = ps.length ? [...dom[ps[0]]] : [];
      for (const p of ps.slice(1)) s = s.filter((x) => dom[p].has(x));
      const next = new Set([...s, n]);
      if (next.size !== dom[n].size) (dom[n] = next, (changed = true));
    }
  }
  // immediate dominator: the strict dominator that every other strict dominator dominates
  const idom: Record<string, string> = {};
  for (const n of live) {
    if (n === "ROOT") continue;
    const strict = [...dom[n]].filter((d) => d !== n);
    idom[n] = strict.find((d) => strict.every((o) => dom[d].has(o))) ?? "ROOT";
  }
  const size = (i: string) => NODES.find((n) => n.id === i)?.size ?? 0;
  const retainedSet = (i: string) => live.filter((d) => dom[d]?.has(i));
  const retained = (i: string) => retainedSet(i).reduce((a, d) => a + size(d), 0);
  return { idom, retainedSet, retained, live };
}

const fmt = (b: number) => `${b.toLocaleString("en-US")} B`;

export function Dominators() {
  const [ref, w] = useWidth();
  const W = Math.max(320, w);
  const [hold, setHold] = useState<"yes" | "no">("yes");
  const [sel, setSel] = useState("B");
  const uid = useId().replace(/:/g, "");
  const edges = useMemo<[string, string][]>(() => (hold === "yes" ? [...BASE, ["R2", "C"]] : BASE), [hold]);
  const a = useMemo(() => analyze(edges), [edges]);
  const set = new Set(a.retainedSet(sel));
  const node = NODES.find((n) => n.id === sel)!;

  const bw = Math.min(110, Math.floor((W - 3 * 8) / 4));
  const small = bw < 92;
  const colGap = (W - 4 * bw) / 3;
  const rw = Math.min(124, W / 2.4); // root pills can be wider than a column
  const bh = 34;
  const gapY = 58;
  const H = 5 * gapY + bh + 8;
  const cx = (n: N) => Math.round(n.x * (bw + colGap) + bw / 2);
  const px = (n: N) => (n.root ? Math.round(Math.min(Math.max(cx(n), rw / 2 + 1), W - rw / 2 - 1)) : cx(n));
  const py = (n: N) => 4 + n.lvl * gapY;
  const byId = (i: string) => NODES.find((n) => n.id === i)!;

  // the dominator tree, as an indented list
  const kids = (p: string) => NODES.filter((n) => a.idom[n.id] === p);
  const tree: { n: N; depth: number }[] = [];
  const walk = (p: string, depth: number) => kids(p).forEach((k) => (tree.push({ n: k, depth }), walk(k.id, depth + 1)));
  walk("ROOT", 0);
  const shown = tree.filter(({ n }) => !(n.id === "R2" && hold === "no"));

  return (
    <div className="@container grid grid-cols-[minmax(0,1fr)] gap-3">
      <Row k="main holds config" kw="20ch" last>
        <Words options={[{ v: "yes", label: "yes" }, { v: "no", label: "no, it returned" }]} value={hold} onChange={setHold} label="does main still hold config" />
      </Row>
      <div ref={ref} className="min-w-0">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" style={{ fontFamily: "var(--font-code)" }} role="img"
          aria-label={`object graph. ${node.label} retains ${fmt(a.retained(sel))}`}>
          <Heads id={uid} tones={["ref", "mute"]} />
          {edges.map(([f, t]) => {
            const s = byId(f);
            const d = byId(t);
            const inSet = set.has(t) && (set.has(f) || f === sel);
            return (
              <line
                key={f + t}
                x1={s.root ? Math.min(Math.max(px(d), px(s) - rw / 2 + 8), px(s) + rw / 2 - 8) : px(s)}
                y1={py(s) + (s.root ? 22 : bh)}
                x2={px(d)}
                y2={py(d) - 2}
                stroke={inSet ? "var(--ref)" : "var(--line-2)"}
                strokeWidth={inSet ? 1.4 : 1}
                markerEnd={`url(#${uid}-${inSet ? "ref" : "mute"})`}
                className="transition-[stroke] duration-200"
              />
            );
          })}
          {NODES.map((n) => {
            const x = px(n) - (n.root ? rw : bw) / 2;
            const y = py(n);
            const on = set.has(n.id);
            const isSel = n.id === sel;
            if (n.root)
              return (
                <g key={n.id}>
                  <rect x={x} y={y} width={rw} height={22} rx={11} fill="var(--bg)" stroke="var(--ref)" strokeDasharray="3 2"
                    opacity={n.id === "R2" && hold === "no" ? 0.35 : 1} />
                  <text x={px(n)} y={y + 14.5} textAnchor="middle" fontSize={10} fill="var(--ref)" opacity={n.id === "R2" && hold === "no" ? 0.35 : 1}>
                    {n.id === "R2" && hold === "no" ? "(gone)" : n.label}
                  </text>
                </g>
              );
            return (
              <g key={n.id} onClick={() => setSel(n.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(n.id)}
                tabIndex={0} role="button" aria-pressed={isSel} aria-label={`${n.label}, shallow ${n.size} bytes`} className="cursor-pointer outline-none">
                <rect x={x} y={y} width={bw} height={bh} rx={5} fill={on ? tint("hot", isSel ? 30 : 16) : "var(--bg)"}
                  stroke={isSel ? "var(--hot)" : on ? "color-mix(in srgb, var(--hot) 55%, transparent)" : "var(--line-2)"} strokeWidth={isSel ? 1.6 : 1}
                  className="transition-[fill,stroke] duration-200" />
                <text x={px(n)} y={y + 14} textAnchor="middle" fontSize={small ? 9.5 : 10.5} fill="var(--hi)">
                  {n.label}
                </text>
                <text x={px(n)} y={y + 27} textAnchor="middle" fontSize={small ? 8.5 : 9.5} fill="var(--mute)" className="tabular">
                  {fmt(n.size)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid gap-4 border-t border-line pt-3 @[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 text-12 text-hi">{node.label} <span className="text-faint">· click any object</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Stat k="shallow" v={fmt(node.size)} />
            <Stat k="retained" v={fmt(a.retained(sel))} tone="hot" />
          </div>
          <p className="mt-2 font-serif text-[15.5px] leading-[1.55] text-ink" aria-live="polite">
            {set.size === 1
              ? "nothing else would be freed with it: everything it points at is also reachable some other way, or it points at nothing."
              : `if nothing pointed at this ${node.label} any more, these ${set.size} objects would become garbage with it.`}
          </p>
        </div>
        <div>
          <div className="mb-1.5 text-11 text-faint">dominator tree · retained size</div>
          <div className="grid gap-px text-12">
            {shown.map(({ n, depth }) => (
              <button key={n.id} type="button" onClick={() => !n.root && setSel(n.id)}
                className={`flex justify-between gap-3 rounded-[3px] px-1.5 py-0.5 text-left ${n.id === sel ? "bg-well-2 text-hi" : n.root ? "text-ref" : "text-ink"}`}
                style={{ paddingLeft: 6 + depth * 14 }} disabled={n.root}>
                <span className="truncate">{n.label}</span>
                <span className="text-mute tabular">{n.root ? "" : fmt(a.retained(n.id))}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
