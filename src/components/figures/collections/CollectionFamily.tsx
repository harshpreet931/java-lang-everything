"use client";

import Link from "next/link";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useWidth } from "./kit";

// the java.util interface family, as a graph you can click.
// every edge is a real `extends` (checked with reflection on jdk 25), every method list
// is what that interface itself declares, every "implemented by" is real.

type Iface = { id: string; since: string; blurb: string; adds: string[]; parents: string[] };

const IFACES: Iface[] = [
  { id: "Iterable", since: "5", blurb: "anything you can for-each over. one method: hand out an iterator.", adds: ["iterator()", "forEach(action)", "spliterator()"], parents: [] },
  { id: "Collection", since: "1.2", blurb: "a bag of elements. no order promised, no index, no keys.", adds: ["add(e)", "remove(o)", "contains(o)", "size()", "isEmpty()", "addAll(c)", "removeIf(p)", "stream()", "toArray()", "clear()"], parents: ["Iterable"] },
  { id: "SequencedCollection", since: "21", blurb: "has a first element, a last element, and a fixed order in between.", adds: ["getFirst()", "getLast()", "addFirst(e)", "addLast(e)", "removeFirst()", "removeLast()", "reversed()"], parents: ["Collection"] },
  { id: "List", since: "1.2", blurb: "ordered by index. duplicates welcome.", adds: ["get(i)", "set(i, e)", "add(i, e)", "remove(i)", "indexOf(o)", "subList(a, b)", "sort(cmp)", "listIterator()"], parents: ["SequencedCollection"] },
  { id: "Set", since: "1.2", blurb: "no duplicates, where duplicate means equals(). same methods as Collection, stricter contract.", adds: ["add(e) returns false on a duplicate"], parents: ["Collection"] },
  { id: "SequencedSet", since: "21", blurb: "a set that also has a first, a last and an order.", adds: ["reversed() → SequencedSet"], parents: ["SequencedCollection", "Set"] },
  { id: "SortedSet", since: "1.2", blurb: "a set kept in sorted order, by compareTo or a Comparator.", adds: ["first()", "last()", "headSet(to)", "tailSet(from)", "subSet(a, b)", "comparator()"], parents: ["Set", "SequencedSet"] },
  { id: "NavigableSet", since: "6", blurb: "a sorted set you can search around: nearest below, nearest above.", adds: ["floor(e)", "ceiling(e)", "lower(e)", "higher(e)", "pollFirst()", "pollLast()", "descendingSet()"], parents: ["SortedSet"] },
  { id: "Queue", since: "5", blurb: "a line. elements go in one end and come out the other (or by priority).", adds: ["offer(e)", "poll()", "peek()", "add(e) / remove() / element()  (throwing versions)"], parents: ["Collection"] },
  { id: "Deque", since: "6", blurb: "a double-ended queue. push and pop at both ends. also your stack.", adds: ["offerFirst(e)", "offerLast(e)", "pollFirst()", "pollLast()", "peekFirst()", "peekLast()", "push(e)", "pop()"], parents: ["Queue", "SequencedCollection"] },
  { id: "Map", since: "1.2", blurb: "keys to values. not a Collection: it holds pairs, not elements.", adds: ["put(k, v)", "get(k)", "remove(k)", "containsKey(k)", "getOrDefault(k, d)", "merge(k, v, f)", "computeIfAbsent(k, f)", "entrySet()", "keySet()", "values()"], parents: [] },
  { id: "SequencedMap", since: "21", blurb: "a map with a first entry, a last entry and an order.", adds: ["firstEntry()", "lastEntry()", "pollFirstEntry()", "pollLastEntry()", "putFirst(k, v)", "putLast(k, v)", "reversed()", "sequencedKeySet()"], parents: ["Map"] },
  { id: "SortedMap", since: "1.2", blurb: "a map kept sorted by key.", adds: ["firstKey()", "lastKey()", "headMap(to)", "tailMap(from)", "subMap(a, b)", "comparator()"], parents: ["SequencedMap"] },
  { id: "NavigableMap", since: "6", blurb: "a sorted map you can search around.", adds: ["floorKey(k)", "ceilingKey(k)", "lowerKey(k)", "higherKey(k)", "floorEntry(k)", "descendingMap()", "pollFirstEntry()"], parents: ["SortedMap"] },
];

type Impl = { id: string; is: string[]; inside: string; href: string };

const IMPLS: Impl[] = [
  { id: "ArrayList", is: ["List"], inside: "an Object[] that grows by 1.5x", href: "/learn/collections/arraylist" },
  { id: "LinkedList", is: ["List", "Deque"], inside: "doubly linked nodes", href: "/learn/collections/linkedlist-and-arraydeque" },
  { id: "ArrayDeque", is: ["Deque"], inside: "a circular Object[]", href: "/learn/collections/linkedlist-and-arraydeque" },
  { id: "PriorityQueue", is: ["Queue"], inside: "a binary heap in an Object[]", href: "/learn/collections/priorityqueue" },
  { id: "HashSet", is: ["Set"], inside: "a HashMap with dummy values", href: "/learn/collections/sets" },
  { id: "LinkedHashSet", is: ["SequencedSet"], inside: "a LinkedHashMap with dummy values", href: "/learn/collections/sets" },
  { id: "TreeSet", is: ["NavigableSet"], inside: "a TreeMap with dummy values", href: "/learn/collections/sets" },
  { id: "EnumSet", is: ["Set"], inside: "a bit vector (one long, for small enums)", href: "/learn/collections/sets" },
  { id: "HashMap", is: ["Map"], inside: "an array of buckets", href: "/learn/collections/hashmap" },
  { id: "LinkedHashMap", is: ["SequencedMap"], inside: "a HashMap + a doubly linked list", href: "/learn/collections/linkedhashmap-and-lru" },
  { id: "TreeMap", is: ["NavigableMap"], inside: "a red-black tree", href: "/learn/collections/treemap" },
  { id: "EnumMap", is: ["Map"], inside: "an array indexed by ordinal", href: "/learn/collections/sets" },
];

const byId = Object.fromEntries(IFACES.map((i) => [i.id, i]));

function ancestors(id: string, out = new Set<string>()) {
  for (const p of byId[id].parents) {
    out.add(p);
    ancestors(p, out);
  }
  return out;
}

const implIfaces = (im: Impl) => {
  const s = new Set<string>();
  im.is.forEach((i) => {
    s.add(i);
    ancestors(i, s);
  });
  return s;
};

/* ---- layouts -------------------------------------------------------------- */

type Pos = Record<string, [cx: number, row: number]>;
type Layout = { w: number; font: number; rowH: number; top: number; pos: Pos; divider: { x?: number; y?: number }; mapLabel: [number, number] };

const WIDE: Layout = {
  w: 720,
  font: 12,
  rowH: 62,
  top: 24,
  pos: {
    Iterable: [250, 0],
    Collection: [250, 1],
    Queue: [60, 2],
    SequencedCollection: [250, 2],
    Set: [470, 2],
    Deque: [110, 3],
    List: [250, 3],
    SequencedSet: [385, 3],
    SortedSet: [470, 4],
    NavigableSet: [470, 5],
    Map: [645, 1],
    SequencedMap: [645, 2],
    SortedMap: [645, 3],
    NavigableMap: [645, 4],
  },
  divider: { x: 556 },
  mapLabel: [645, 0],
};

const NARROW: Layout = {
  w: 340,
  font: 11,
  rowH: 54,
  top: 10,
  pos: {
    Iterable: [170, 0],
    Collection: [170, 1],
    Queue: [36, 2],
    SequencedCollection: [160, 2],
    Set: [292, 2],
    Deque: [40, 3],
    List: [120, 3],
    SequencedSet: [212, 3],
    SortedSet: [292, 4],
    NavigableSet: [290, 5],
    Map: [170, 7],
    SequencedMap: [170, 8],
    SortedMap: [170, 9],
    NavigableMap: [170, 10],
  },
  divider: { y: 6 },
  mapLabel: [170, 6],
};

const H = 30;

export function CollectionFamily() {
  const [wrap, width] = useWidth<HTMLDivElement>(720);
  const L = width < 560 ? NARROW : WIDE;
  const [sel, setSel] = useState<string>("List");
  const uid = useId().replace(/:/g, "");

  const isImpl = IMPLS.some((i) => i.id === sel);
  const impl = IMPLS.find((i) => i.id === sel);
  const iface = byId[sel] as Iface | undefined;

  const lit = useMemo(() => {
    if (impl) return implIfaces(impl);
    const s = ancestors(sel);
    s.add(sel);
    return s;
  }, [sel, impl]);
  const implementers = useMemo(() => (iface ? IMPLS.filter((im) => implIfaces(im).has(sel)).map((x) => x.id) : []), [sel, iface]);

  const cw = L.font * 0.6;
  const nodeW = (id: string) => id.length * cw + (L.font === 12 ? 22 : 16);
  const y = (row: number) => L.top + row * L.rowH;
  const maxRow = Math.max(...Object.values(L.pos).map((p) => p[1]));
  const vbH = y(maxRow) + H + 22;

  // edges: child top → parent bottom. fan multiple parents/children so lines don't stack.
  const edges = IFACES.flatMap((c) => {
    const ps = [...c.parents].sort((a, b) => L.pos[a][0] - L.pos[b][0]);
    return ps.map((p, k) => {
      const kids = IFACES.filter((x) => x.parents.includes(p)).sort((a, b) => L.pos[a.id][0] - L.pos[b.id][0]);
      const j = kids.findIndex((x) => x.id === c.id);
      const [ccx, cr] = L.pos[c.id];
      const [pcx, pr] = L.pos[p];
      const x1 = ccx + (k - (ps.length - 1) / 2) * 16;
      const x2 = pcx + (j - (kids.length - 1) / 2) * Math.min(14, nodeW(p) / (kids.length + 1));
      const on = lit.has(c.id) && lit.has(p);
      return { key: `${c.id}-${p}`, x1, y1: y(cr), x2, y2: y(pr) + H, on };
    });
  });

  const pick = (id: string) => setSel(id);
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(id);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div ref={wrap} className="min-w-0">
        <svg fontFamily="var(--font-code)"
          viewBox={`0 0 ${L.w} ${vbH}`}
          className="block w-full"
          role="group"
          aria-label="the java.util interface family. click an interface or a class."
        >
          <defs>
            <marker id={`cf-ah-${uid}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--line-2)" />
            </marker>
            <marker id={`cf-ahon-${uid}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ink)" />
            </marker>
          </defs>

          {/* Map lives apart */}
          {L.divider.x !== undefined && (
            <line x1={L.divider.x} y1={8} x2={L.divider.x} y2={vbH - 8} stroke="var(--line)" strokeDasharray="3 4" />
          )}
          {L.divider.y !== undefined && (
            <line x1={8} y1={y(L.divider.y) + 2} x2={L.w - 8} y2={y(L.divider.y) + 2} stroke="var(--line)" strokeDasharray="3 4" />
          )}
          <text
            x={L.mapLabel[0]}
            y={y(L.mapLabel[1]) + (L.divider.y !== undefined ? 26 : 18)}
            textAnchor="middle"
            fontSize={L.font - 1}
            fill="var(--faint)"
          >
            not a Collection
          </text>

          {edges.map((e) => (
            <line
              key={e.key}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2 + 1}
              stroke={e.on ? "var(--ink)" : "var(--line-2)"}
              strokeWidth={e.on ? 1.25 : 1}
              markerEnd={`url(#${e.on ? `cf-ahon-${uid}` : `cf-ah-${uid}`})`}
              style={{ transition: "stroke 200ms var(--ease)" }}
            />
          ))}

          {IFACES.map((n) => {
            const [cx, row] = L.pos[n.id];
            const w = nodeW(n.id);
            const x = cx - w / 2;
            const ny = y(row);
            const isSel = sel === n.id;
            const on = lit.has(n.id);
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${n.id}, since java ${n.since}`}
                onClick={() => pick(n.id)}
                onKeyDown={onKey(n.id)}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--hi)]"
                style={{ opacity: on ? 1 : 0.5, transition: "opacity 200ms var(--ease)" }}
              >
                <rect
                  x={x}
                  y={ny}
                  width={w}
                  height={H}
                  rx={2}
                  fill={isSel ? "var(--well-2)" : "var(--bg)"}
                  stroke={isSel ? "var(--hi)" : on ? "var(--mute)" : "var(--line-2)"}
                  strokeWidth={isSel ? 1.5 : 1}
                  style={{ transition: "fill 150ms var(--ease), stroke 150ms var(--ease)" }}
                />
                <text x={cx} y={ny + H / 2 + L.font * 0.36} textAnchor="middle" fontSize={L.font} fill="var(--hi)">
                  {n.id}
                </text>
                {n.since === "21" && (
                  <text x={x + w + 3} y={ny + 4} fontSize={9} fill="var(--faint)">
                    21
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* the classes you actually new up */}
      <div>
        <div className="mb-2 text-11 text-faint">implementations · click one to light up everything it is</div>
        <div className="flex flex-wrap gap-1.5">
          {IMPLS.map((im) => {
            const on = isImpl ? sel === im.id : implementers.includes(im.id);
            return (
              <button
                key={im.id}
                onClick={() => pick(im.id)}
                aria-pressed={sel === im.id}
                className="word !min-h-7 !px-2 !text-12"
                style={
                  sel === im.id
                    ? undefined
                    : on
                      ? { color: "var(--hi)", boxShadow: "inset 0 0 0 1px var(--ink)" }
                      : { boxShadow: "inset 0 0 0 1px var(--line)" }
                }
              >
                {im.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[9.5em] rounded-xs bg-well px-4 py-3.5 text-13 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
        {iface && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-14 text-hi">
                {iface.id}
                <span className="text-faint">{iface.id.includes("Map") ? "<K, V>" : iface.id === "Iterable" ? "<T>" : "<E>"}</span>
              </span>
              <span className="text-11 text-faint">since java {iface.since}</span>
              {iface.parents.length > 0 && <span className="text-11 text-faint">extends {iface.parents.join(", ")}</span>}
            </div>
            <p className="mt-1.5 font-serif text-16 text-mute">{iface.blurb}</p>
            <div className="mt-2.5 flex flex-wrap gap-x-1.5 gap-y-1">
              <span className="mr-1 text-12 text-faint">adds</span>
              {iface.adds.map((m) => (
                <code key={m} className="rounded-xs bg-well-2 px-1.5 text-12 text-ink">
                  {m}
                </code>
              ))}
            </div>
            <div className="mt-2 text-12 text-faint">
              implemented by{" "}
              {implementers.length ? (
                <span className="text-ink">{implementers.join(", ")}</span>
              ) : (
                <span>(nothing here, it's the top)</span>
              )}
            </div>
          </>
        )}
        {impl && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-14 text-hi">{impl.id}</span>
              <Link href={impl.href} className="link text-12 text-mute">
                chapter →
              </Link>
            </div>
            <p className="mt-1.5 font-serif text-16 text-mute">inside: {impl.inside}.</p>
            <div className="mt-2 text-12 text-faint">
              is a{" "}
              <span className="text-ink">
                {IFACES.filter((i) => lit.has(i.id))
                  .map((i) => i.id)
                  .join(", ")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
