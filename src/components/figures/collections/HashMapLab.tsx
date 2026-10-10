"use client";

import { useState, type ReactNode } from "react";
import { Console, Row, bits32, useReducedMotion, useTimers, useWidth } from "./kit";
import * as H from "./hashmapSim";

// the flagship: a real HashMap<String, Integer>, simulated with hashmapSim.ts (which was
// checked against jdk 25: same table sizes, same treeify moment, same iteration order).

const WORDS = ["java", "ada", "grace", "linus", "apple", "banana", "cherry", "kiwi", "mango", "pear", "plum", "fig", "lime", "lemon", "peach", "melon", "grape", "olive", "date", "tiger", "zebra", "walrus", "squid", "raven", "quail", "hello", "world", "xenon", "vole", "urchin"];
const BLOCKS = ["Aa", "BB"];
const COLLIDERS = Array.from({ length: 16 }, (_, i) => [3, 2, 1, 0].map((b) => BLOCKS[(i >> b) & 1]).join(""));

type Focus = { key: string; index: number; mode: "put" | "get" | "remove"; checked?: number; found?: boolean; tree?: boolean } | null;

const q = (k: string) => `"${k}"`;

export function HashMapLab() {
  const [s, setS] = useState<H.HState>(H.empty());
  const [key, setKey] = useState("duke");
  const [focus, setFocus] = useState<Focus>(null);
  const [counter, setCounter] = useState(1);
  const [flash, setFlash] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ReactNode>(
    <span className="text-faint">{"Map<String, Integer> map = new HashMap<>();\n// table = null. nothing is allocated until the first put."}</span>,
  );
  const reduce = useReducedMotion();
  const t = useTimers();

  const n = s.table?.length ?? 16;

  /** apply one put, return the new state (so bulk adds can chain) */
  const doPut = (st: H.HState, k: string, v: number): H.HState => {
    const r = H.put(st, k, v);
    const lines: ReactNode[] = [];
    lines.push(<span key="c" className="text-faint">{`map.put(${q(k)}, ${v});  // → ${r.replaced ?? "null"}\n`}</span>);
    const hash = H.spread(H.javaHash(k));
    for (const e of r.events) {
      if (e.kind === "alloc") lines.push(<span key="a" className="text-hot">{"first put: table = new Node[16], threshold = 12.\n"}</span>);
    }
    if (r.replaced !== undefined) {
      lines.push(<span key="r" className="say text-ink">{`key already there (hash and equals matched). value replaced, size stays ${r.s.size}.\n`}</span>);
    } else {
      const idx0 = H.indexFor(hash, st.table?.length ?? 16);
      lines.push(
        <span key="b" className="say text-ink">
          {r.chainBefore === 0
            ? `hash ${hash} → bucket ${idx0}. empty, so the node goes straight in.\n`
            : `hash ${hash} → bucket ${idx0}, which already has ${r.chainBefore} node${r.chainBefore === 1 ? "" : "s"}. collision: appended to the end of the chain.\n`}
        </span>,
      );
    }
    let moved: string[] = [k];
    for (const e of r.events) {
      if (e.kind === "resize" && e.why === "treeify")
        lines.push(
          <span key={`t${e.to}`} className="say text-hot">
            {`that bucket already had 8 nodes, so it wants to become a tree. but the table is only ${e.from} wide (< 64), so it resizes instead: ${e.from} → ${e.to}.\n`}
          </span>,
        );
      if (e.kind === "resize" && e.why === "load")
        lines.push(
          <span key={`l${e.to}`} className="say text-hot">
            {`size ${r.s.size} > threshold ${st.table ? st.threshold : 12}: resize ${e.from} → ${e.to}. every chain splits on (hash & ${e.from}): 0 stays at j, 1 moves to j + ${e.from}. ${e.moved.length} node${e.moved.length === 1 ? "" : "s"} moved.\n`}
          </span>,
        );
      if (e.kind === "resize") moved = [...moved, ...e.moved];
      if (e.kind === "treeify")
        lines.push(
          <span key="tf" className="say text-hot">
            {`bucket ${e.index} already had 8 nodes and the table is 64 wide: the chain becomes a red-black tree. lookups in it are O(log n) now.\n`}
          </span>,
        );
    }
    if (r.events.some((e) => e.kind === "resize") && r.replaced === undefined && r.index !== H.indexFor(hash, st.table?.length ?? 16))
      lines.push(<span key="now" className="say text-mute">{`${q(k)} now lives in bucket ${r.index}.`}</span>);
    setLog(<>{lines}</>);
    setFlash(moved);
    setFocus({ key: k, index: r.index, mode: "put" });
    return r.s;
  };

  const put = (k = key) => {
    if (!k.length) return;
    t.clear();
    setBusy(false);
    setS(doPut(s, k, counter));
    setCounter(counter + 1);
  };

  const get = (k = key) => {
    t.clear();
    const r = H.get(s, k);
    setFlash([]);
    if (r.index < 0) {
      setLog(<span className="text-faint">{`map.get(${q(k)});  // → null. no table yet.`}</span>);
      return;
    }
    const tree = s.table?.[r.index]?.tree;
    if (tree) {
      const pos = s.table![r.index].nodes.findIndex((e) => e.key === k);
      setFocus({ key: k, index: r.index, mode: "get", checked: pos >= 0 ? pos + 1 : 0, found: pos >= 0, tree: true });
      setLog(
        <>
          <span className="text-faint">{`map.get(${q(k)});  // → ${r.found ? r.found.value : "null"}\n`}</span>
          <span className="say text-ink">{`hash → bucket ${r.index}, which is a red-black tree. so this is a tree search (about log₂ of the bucket size, compareTo breaking the hash tie), not a walk down a chain.\n`}</span>
          <span className="say text-mute">{r.found ? "found." : "not found."}</span>
        </>,
      );
      return;
    }
    setFocus({ key: k, index: r.index, mode: "get", checked: r.checked, found: !!r.found });
    setLog(
      <>
        <span className="text-faint">{`map.get(${q(k)});  // → ${r.found ? r.found.value : "null"}\n`}</span>
        <span className="text-ink">
          {`hash → bucket ${r.index}. ${r.checked === 0 ? "it's empty, done." : `compared ${r.checked} node${r.checked === 1 ? "" : "s"} (hash first, equals only if the hashes match).`}\n`}
        </span>
        <span className="say text-mute">{r.found ? "found. no scanning of other buckets, ever." : "not found. still only looked in one bucket."}</span>
      </>,
    );
  };

  const remove = (k = key) => {
    t.clear();
    const r = H.remove(s, k);
    setFlash([]);
    if (!r.removed) {
      setLog(<span className="text-faint">{`map.remove(${q(k)});  // → null. not in the map.`}</span>);
      setFocus(r.index >= 0 ? { key: k, index: r.index, mode: "remove" } : null);
      return;
    }
    setS(r.s);
    setFocus({ key: k, index: r.index, mode: "remove" });
    setLog(
      <>
        <span className="text-faint">{`map.remove(${q(k)});  // → ${r.removed.value}\n`}</span>
        <span className="say text-ink">{`unlinked from bucket ${r.index}. the table never shrinks.\n`}</span>
        {r.events.length > 0 && (
          <span className="say text-mute">small enough again: the tree turns back into a list (the exact moment depends on the tree&apos;s shape).</span>
        )}
      </>,
    );
  };

  const fill = () => {
    t.clear();
    const target = s.table ? s.threshold + 1 : 13;
    const words = WORDS.filter((w) => !H.get(s, w).found);
    const todo = words.slice(0, Math.max(0, target - s.size));
    if (!todo.length) return;
    let st = s;
    let c = counter;
    if (reduce) {
      todo.forEach((w) => (st = doPut(st, w, c++)));
      setS(st);
      setCounter(c);
      return;
    }
    setBusy(true);
    todo.forEach((w, i) =>
      t.after(i * 200, () => {
        st = doPut(st, w, c++);
        setS(st);
        setCounter(c);
        setKey(w);
        if (i === todo.length - 1) setBusy(false);
      }),
    );
  };

  const nextCollider = COLLIDERS.find((c) => !H.get(s, c).found);
  const collide = () => {
    if (!nextCollider) return;
    setKey(nextCollider);
    put(nextCollider);
  };

  const reset = () => {
    t.clear();
    setBusy(false);
    setS(H.empty());
    setCounter(1);
    setFocus(null);
    setFlash([]);
    setLog(<span className="text-faint">{"Map<String, Integer> map = new HashMap<>();\n// table = null. nothing is allocated until the first put."}</span>);
  };

  const ord = H.order(s);
  const anyTree = s.table?.some((b) => b.tree);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="key =">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.slice(0, 24))}
            onKeyDown={(e) => e.key === "Enter" && put()}
            className="mr-2 w-[16ch] border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
            spellCheck={false}
            aria-label="key to put, get or remove"
          />
          <button className="act solid" onClick={() => put()} disabled={busy || !key}>
            put
          </button>
          <button className="act" onClick={() => get()} disabled={busy || !key}>
            get
          </button>
          <button className="act" onClick={() => remove()} disabled={busy || !key}>
            remove
          </button>
        </Row>
        <Row k="try =">
          {["Aa", "BB", "polygenelubricants"].map((w) => (
            <button
              key={w}
              className="word !min-h-7 !px-2 !text-12"
              onClick={() => {
                setKey(w);
                put(w);
              }}
              disabled={busy}
            >
              &quot;{w}&quot;
            </button>
          ))}
          <button className="act" onClick={fill} disabled={busy}>
            fill until it resizes
          </button>
          <button className="act" onClick={collide} disabled={busy || !nextCollider}>
            add a colliding key
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </Row>
      </div>

      <HashSteps k={key} n={n} />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-12 tabular text-mute">
          <span>
            size <span className="text-hi">{s.size}</span>
          </span>
          <span>
            capacity <span className="text-hi">{s.table ? n : 0}</span>
          </span>
          <span>
            threshold <span className="text-hi">{s.threshold}</span>
            <span className="text-faint"> = {s.table ? n : 0} × 0.75</span>
          </span>
          <span>
            load <span className="text-hi">{s.table ? (s.size / n).toFixed(2) : "0.00"}</span>
          </span>
        </div>
        <Table s={s} focus={focus} flash={flash} />
        {focus && s.table && focus.index >= 0 && (
          <div className="mt-1 overflow-hidden text-12 text-ellipsis whitespace-nowrap text-mute">
            <span className="text-faint">bucket {focus.index}: </span>
            {s.table[focus.index].nodes.length ? (
              s.table[focus.index].nodes.map((e, i) => (
                <span key={e.key}>
                  {i > 0 && <span className="text-ref"> → </span>}
                  <span className={e.key === focus.key ? "text-hi" : "text-ink"}>&quot;{e.key}&quot;</span>
                </span>
              ))
            ) : (
              <span className="text-faint">empty</span>
            )}
            {s.table[focus.index].tree && <span className="text-hot"> (a red-black tree)</span>}
          </div>
        )}
      </div>

      <Console label="what HashMap just did" minH="5.4em">
        {log}
      </Console>

      <div className="overflow-hidden text-12 text-ellipsis whitespace-nowrap text-mute">
        <span className="text-faint">IO.println(map) → </span>
        <span className="text-ink">
          {"{"}
          {ord
            .slice(0, 14)
            .map((e) => `${e.key}=${e.value}`)
            .join(", ")}
          {ord.length > 14 ? ", …" : ""}
          {"}"}
        </span>
      </div>
      <div className="-mt-3 text-11 text-faint">
        that&apos;s bucket order, not insertion order.{anyTree ? " (inside a tree bucket the order depends on the tree.)" : ""}
      </div>
    </div>
  );
}

/* ---- how the key becomes an index ---------------------------------------- */

function BitRow({ v, hotLow = 0, dimHigh = false }: { v: number; hotLow?: number; dimHigh?: boolean }) {
  const b = bits32(v);
  return (
    <span className="whitespace-pre tabular">
      {b.split("").map((c, i) => {
        const fromRight = 31 - i;
        const isHot = fromRight < hotLow;
        return (
          <span key={i} className={isHot ? "text-hot" : dimHigh ? "text-faint" : c === "1" ? "text-hi" : "text-faint"}>
            {c}
            {i % 4 === 3 && i < 31 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

function HashSteps({ k, n }: { k: string; n: number }) {
  const [wrap, w] = useWidth<HTMLDivElement>(700);
  const stack = w < 600;
  const h = H.javaHash(k);
  const shifted = h >>> 16;
  const hash = H.spread(h);
  const idx = H.indexFor(hash, n);
  const lg = Math.log2(n);
  const rows: { label: ReactNode; dec: ReactNode; bits: ReactNode }[] = [
    { label: <>{`"${k.length > 12 ? k.slice(0, 11) + "…" : k}".hashCode()`}</>, dec: h, bits: <BitRow v={h} /> },
    { label: "h >>> 16", dec: shifted, bits: <BitRow v={shifted} /> },
    { label: "hash = h ^ (h >>> 16)", dec: hash, bits: <BitRow v={hash} hotLow={lg} /> },
    { label: `n - 1  (n = ${n})`, dec: n - 1, bits: <BitRow v={n - 1} hotLow={lg} /> },
  ];
  const formula =
    k.length >= 1 && k.length <= 3
      ? k
          .split("")
          .map((c, i) => `${c.charCodeAt(0)}${k.length - 1 - i > 0 ? `·31${k.length - 1 - i > 1 ? "²" : ""}` : ""}`)
          .join(" + ")
      : null;
  return (
    <div ref={wrap} className="rounded-xs bg-well px-4 py-3.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="mb-2 text-11 text-faint">key → bucket, the way HashMap does it</div>
      {rows.map((r, i) => (
        <div key={i} className={`grid gap-x-4 py-1 ${stack ? "grid-cols-[1fr_auto]" : "grid-cols-[minmax(0,22ch)_12ch_auto]"} ${i ? "border-t border-line" : ""}`}>
          <span className="truncate text-mute">{r.label}</span>
          <span className="text-right text-hi tabular">{r.dec}</span>
          <span className={stack ? "col-span-2 overflow-x-auto" : ""}>{r.bits}</span>
        </div>
      ))}
      <div className={`grid gap-x-4 border-t border-line-2 pt-2 ${stack ? "grid-cols-[1fr_auto]" : "grid-cols-[minmax(0,22ch)_12ch_auto]"}`}>
        <span className="text-ink">index = hash & (n - 1)</span>
        <span className="text-right text-14 text-hot tabular">{idx}</span>
        {!stack && <span className="text-faint">the low {lg} bits pick the bucket. same as hash mod {n}, minus the division.</span>}
      </div>
      {formula && (
        <div className="mt-2 text-11 text-faint">
          {`"${k}".hashCode() = ${formula} = ${h}`}
        </div>
      )}
    </div>
  );
}

/* ---- the table: buckets in a row, chains hanging down ---------------------- */

function Table({ s, focus, flash }: { s: H.HState; focus: Focus; flash: string[] }) {
  const [wrap, W] = useWidth<HTMLDivElement>(720);
  const n = s.table?.length ?? 16;
  const colW = W / n;
  const full = colW >= 40;
  const slotH = 24;
  const nodeH = full ? 22 : 7;
  const gap = full ? 8 : 3;
  const top = slotH + 18;
  const maxChain = Math.max(1, ...(s.table ?? []).map((b) => b.nodes.length));
  const height = top + maxChain * (nodeH + gap) + 18;
  const step = colW >= 22 ? 1 : colW >= 11 ? 4 : 8;
  const fb = focus?.index ?? -1;

  return (
    <div ref={wrap} className="relative w-full" style={{ height }} aria-label={`hash table with ${n} buckets`} role="img">
      {/* bucket index labels */}
      {Array.from({ length: n }, (_, j) =>
        j % step === 0 ? (
          <span
            key={`i${j}`}
            className="absolute text-center text-[9px] leading-3 text-faint tabular"
            style={{ left: j * colW, width: Math.max(colW, 16), top: 0 }}
          >
            {j}
          </span>
        ) : null,
      )}
      {/* slots */}
      {Array.from({ length: n }, (_, j) => {
        const bin = s.table?.[j];
        const has = !!bin?.nodes.length;
        const isF = j === fb;
        return (
          <div
            key={`s${j}`}
            className="absolute flex items-center justify-center transition-[left,width] duration-300 ease-jle"
            style={{
              left: j * colW,
              width: colW + 1,
              top: 14,
              height: slotH,
              boxShadow: `inset 0 0 0 1px ${isF ? "var(--hot)" : "var(--line-2)"}`,
              background: isF ? "color-mix(in srgb, var(--hot) 10%, transparent)" : undefined,
              opacity: s.table ? 1 : 0.4,
              zIndex: isF ? 2 : 1,
            }}
          >
            {has ? (
              <span className="size-[6px] rounded-full bg-ref" />
            ) : (
              <span className="text-[10px] text-faint">{colW > 8 ? "·" : ""}</span>
            )}
          </div>
        );
      })}
      {/* focus column tint */}
      {fb >= 0 && (
        <div
          className="pointer-events-none absolute transition-[left,width] duration-300 ease-jle"
          style={{ left: fb * colW, width: colW + 1, top: 14 + slotH, bottom: 0, background: "color-mix(in srgb, var(--hot) 5%, transparent)" }}
        />
      )}
      {/* nodes */}
      {(s.table ?? []).flatMap((bin, j) =>
        bin.nodes.map((e, k) => {
          const isFocusKey = focus?.key === e.key && j === fb;
          const checked = focus?.mode === "get" && j === fb && focus.checked !== undefined && (focus.tree ? k === focus.checked - 1 : k < focus.checked);
          const found = checked && focus?.found && k === (focus.checked ?? 0) - 1;
          const isFlash = flash.includes(e.key);
          const tone = found ? "live" : checked ? "hot" : isFocusKey && focus?.mode === "put" ? "hot" : isFlash ? "hot" : null;
          const w = full ? colW - 6 : Math.min(colW - 2, 9);
          const x = j * colW + (colW - w) / 2;
          const y = top + k * (nodeH + gap);
          return (
            <div
              key={e.key}
              className="absolute transition-[left,top,width] duration-300 ease-jle"
              style={{ left: x, top: y, width: w, height: nodeH }}
              title={`${e.key}=${e.value} (hash ${e.hash})`}
            >
              {full && (
                <span className="absolute left-1/2 w-px bg-ref" style={{ top: -gap - (k === 0 ? 4 : 0), height: gap + (k === 0 ? 4 : 0) }} />
              )}
              <div
                className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1px] text-[11px] whitespace-nowrap"
                style={{
                  boxShadow: `inset 0 0 0 1px ${tone ? `var(--${tone})` : bin.tree ? "var(--ink)" : "var(--line-2)"}`,
                  background: full ? "var(--bg)" : tone ? `var(--${tone})` : bin.tree ? "var(--ink)" : "var(--mute)",
                  color: tone ? `var(--${tone})` : "var(--hi)",
                }}
              >
                {full ? <span className="truncate px-1">{e.key}</span> : null}
              </div>
            </div>
          );
        }),
      )}
      {/* tree labels */}
      {(s.table ?? []).map((bin, j) =>
        bin.tree ? (
          <span
            key={`t${j}`}
            className="absolute text-[10px] whitespace-nowrap text-hot transition-[left,top] duration-300 ease-jle"
            style={{ left: j * colW + colW + 3, top: top + 2 }}
          >
            tree
          </span>
        ) : null,
      )}
      {!s.table && (
        <div className="absolute inset-x-0 text-center text-12 text-faint" style={{ top: top + 6 }}>
          table = null. the first put allocates 16 buckets.
        </div>
      )}
    </div>
  );
}
