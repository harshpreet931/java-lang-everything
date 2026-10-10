// a faithful little model of java.util.HashMap (jdk 25) for String keys.
// same hash, same index, same tail-append chaining, same resize split (lo/hi, order kept),
// same treeify rule: appending to a bin that already has 8 nodes calls treeifyBin, which
// resizes instead while the table is smaller than 64. tested against the real JDK
// (see the chapter): same table sizes, same iteration order.

export type HNode = { key: string; hash: number; value: number };
export type Bin = { nodes: HNode[]; tree: boolean };
export type HState = { table: Bin[] | null; size: number; threshold: number };

export const TREEIFY_THRESHOLD = 8;
export const UNTREEIFY_THRESHOLD = 6;
export const MIN_TREEIFY_CAPACITY = 64;

export function javaHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
export const spread = (h: number) => (h ^ (h >>> 16)) | 0;
export const indexFor = (hash: number, n: number) => (n - 1) & hash;

export const empty = (): HState => ({ table: null, size: 0, threshold: 0 });

const cloneTable = (t: Bin[]) => t.map((b) => ({ nodes: [...b.nodes], tree: b.tree }));

export type Event =
  | { kind: "alloc"; cap: number }
  | { kind: "resize"; from: number; to: number; why: "load" | "treeify"; moved: string[] }
  | { kind: "treeify"; index: number }
  | { kind: "untreeify"; index: number };

export function resize(s: HState, why: "load" | "treeify", events: Event[]): HState {
  if (!s.table) {
    events.push({ kind: "alloc", cap: 16 });
    return { ...s, table: Array.from({ length: 16 }, () => ({ nodes: [], tree: false })), threshold: 12 };
  }
  const old = s.table;
  const oldCap = old.length;
  const cap = oldCap * 2;
  const table: Bin[] = Array.from({ length: cap }, () => ({ nodes: [], tree: false }));
  const moved: string[] = [];
  old.forEach((bin, j) => {
    if (!bin.nodes.length) return;
    const lo = bin.nodes.filter((e) => (e.hash & oldCap) === 0);
    const hi = bin.nodes.filter((e) => (e.hash & oldCap) !== 0);
    hi.forEach((e) => moved.push(e.key));
    table[j] = { nodes: lo, tree: bin.tree && lo.length > UNTREEIFY_THRESHOLD };
    table[j + oldCap] = { nodes: hi, tree: bin.tree && hi.length > UNTREEIFY_THRESHOLD };
  });
  events.push({ kind: "resize", from: oldCap, to: cap, why, moved });
  return { ...s, table, threshold: s.threshold * 2 };
}

export type PutResult = { s: HState; events: Event[]; replaced?: number; index: number; chainBefore: number };

export function put(s0: HState, key: string, value: number): PutResult {
  const events: Event[] = [];
  let s = s0.table ? { ...s0, table: cloneTable(s0.table) } : resize(s0, "load", events);
  const hash = spread(javaHash(key));
  let n = s.table!.length;
  let i = indexFor(hash, n);
  const bin = s.table![i];
  const chainBefore = bin.nodes.length;
  const hit = bin.nodes.find((e) => e.hash === hash && e.key === key);
  if (hit) {
    const old = hit.value;
    hit.value = value;
    return { s, events, replaced: old, index: i, chainBefore };
  }
  bin.nodes.push({ key, hash, value });
  if (!bin.tree && chainBefore >= TREEIFY_THRESHOLD) {
    // treeifyBin
    if (n < MIN_TREEIFY_CAPACITY) s = resize(s, "treeify", events);
    else {
      bin.tree = true;
      events.push({ kind: "treeify", index: i });
    }
  }
  s = { ...s, size: s.size + 1 };
  if (s.size > s.threshold) s = resize(s, "load", events);
  n = s.table!.length;
  i = indexFor(hash, n);
  return { s, events, index: i, chainBefore };
}

export function get(s: HState, key: string) {
  if (!s.table) return { index: -1, checked: 0, found: undefined as HNode | undefined };
  const hash = spread(javaHash(key));
  const i = indexFor(hash, s.table.length);
  const bin = s.table[i];
  let checked = 0;
  for (const e of bin.nodes) {
    checked++;
    if (e.hash === hash && e.key === key) return { index: i, checked, found: e };
  }
  return { index: i, checked, found: undefined };
}

export function remove(s0: HState, key: string) {
  if (!s0.table) return { s: s0, removed: undefined as HNode | undefined, index: -1, events: [] as Event[] };
  const s = { ...s0, table: cloneTable(s0.table) };
  const hash = spread(javaHash(key));
  const i = indexFor(hash, s.table.length);
  const bin = s.table[i];
  const k = bin.nodes.findIndex((e) => e.hash === hash && e.key === key);
  const events: Event[] = [];
  if (k < 0) return { s: s0, removed: undefined, index: i, events };
  const [removed] = bin.nodes.splice(k, 1);
  if (bin.tree && bin.nodes.length <= UNTREEIFY_THRESHOLD) {
    bin.tree = false;
    events.push({ kind: "untreeify", index: i });
  }
  return { s: { ...s, size: s.size - 1 }, removed, index: i, events };
}

/** keys in HashMap iteration order: bucket 0 up, each chain front to back. */
export function order(s: HState) {
  return (s.table ?? []).flatMap((b) => b.nodes);
}
