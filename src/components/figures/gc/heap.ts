// a tiny heap, and the classic collectors run over it, one frame at a time.
//
// the heap is a row of cells (think: words of memory). objects sit at an address and
// span `size` cells. roots point into the heap. each algorithm returns a list of frames
// (full snapshots), so any figure can step through them with useStepper.
//
// used by: reachability (mark), gc-fundamentals (mark-sweep, mark-compact, copying),
// and the later collector chapters for their small diagrams.

export type HObj = { id: string; addr: number; size: number; refs: string[] };
export type HRoot = { id: string; label: string; to: string | null };
export type Heap = { cells: number; objs: HObj[]; roots: HRoot[] };

export type ObjState = "plain" | "grey" | "hot" | "live" | "dead" | "fwd" | "new";

export type ObjView = {
  id: string;
  addr: number;
  size: number;
  refs: string[];
  state: ObjState;
  /** forwarding address, shown on a moved-from copy or as "will move to" */
  fwd?: number;
};

export type RootView = { id: string; label: string; to: string | null };

export type Ptr = { label: string; at: number };

export type View = {
  label?: string;
  objs: ObjView[];
  roots: RootView[];
  /** free-list runs [addr, len]. drawn as runtime machinery */
  free?: [number, number][];
  ptrs?: Ptr[];
  /** an allocation that didn't fit, drawn floating above the heap */
  ghost?: { size: number; ok: boolean };
};

export type Frame = { views: View[]; note: string; stack?: string[]; tag?: string };

const byAddr = (a: { addr: number }, b: { addr: number }) => a.addr - b.addr;

export function mark(heap: Heap) {
  const frames: Frame[] = [];
  const marked = new Set<string>();
  const get = (id: string) => heap.objs.find((o) => o.id === id)!;
  const view = (hot: string | null, stack: string[], end = false): View => ({
    objs: heap.objs.map((o) => ({
      ...o,
      state:
        o.id === hot ? "hot" : marked.has(o.id) ? "live" : stack.includes(o.id) ? "grey" : end ? "dead" : "plain",
    })),
    roots: heap.roots,
  });

  frames.push({
    views: [view(null, [])],
    note: "the collector doesn't look for garbage. it looks for everything that's still reachable, starting at the roots. nothing is marked yet.",
    stack: [],
    tag: "mark",
  });

  const stack: string[] = [];
  for (const r of heap.roots) if (r.to && !stack.includes(r.to)) stack.push(r.to);
  stack.reverse();
  frames.push({
    views: [view(null, [...stack])],
    note: `push whatever the roots point at onto the mark stack: ${[...stack].reverse().join(", ")}.`,
    stack: [...stack],
    tag: "mark",
  });

  while (stack.length) {
    const id = stack.pop()!;
    if (marked.has(id)) {
      frames.push({
        views: [view(id, [...stack])],
        note: `${id} is already marked. skip it. (this check is also why a cycle can't make the marker loop forever.)`,
        stack: [...stack],
        tag: "mark",
      });
      continue;
    }
    marked.add(id);
    const kids = get(id).refs.filter((k) => !marked.has(k));
    for (const k of [...kids].reverse()) stack.push(k);
    frames.push({
      views: [view(id, [...stack])],
      note: kids.length
        ? `pop ${id}, mark it, push what it points at: ${kids.join(", ")}.`
        : get(id).refs.length
          ? `pop ${id} and mark it. everything it points at is already marked.`
          : `pop ${id} and mark it. it points at nothing.`,
      stack: [...stack],
      tag: "mark",
    });
  }

  const dead = heap.objs.filter((o) => !marked.has(o.id)).map((o) => o.id);
  frames.push({
    views: [view(null, [], true)],
    note: `the stack is empty, marking is done. ${dead.join(", ")} never got marked: nothing can reach them, so they're garbage. even though some of them point at each other.`,
    stack: [],
    tag: "mark",
  });
  return { frames, marked };
}

function freeRuns(cells: number, objs: { addr: number; size: number }[]): [number, number][] {
  const used = new Array(cells).fill(false);
  for (const o of objs) for (let i = o.addr; i < o.addr + o.size; i++) used[i] = true;
  const runs: [number, number][] = [];
  for (let i = 0; i < cells; ) {
    if (used[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < cells && !used[j]) j++;
    runs.push([i, j - i]);
    i = j;
  }
  return runs;
}

export function sweep(heap: Heap, marked: Set<string>, want = 3) {
  const frames: Frame[] = [];
  const objs = [...heap.objs].sort(byAddr);
  let alive = objs.map((o) => ({ ...o, state: (marked.has(o.id) ? "live" : "dead") as ObjState }));
  frames.push({
    views: [{ objs: alive, roots: heap.roots, ptrs: [{ label: "sweep", at: 0 }] }],
    note: "sweep: walk the whole heap, address by address. it has to visit every object, dead or alive, because dead ones are exactly what it's looking for.",
    tag: "sweep",
  });
  for (const o of objs) {
    if (marked.has(o.id)) continue;
    alive = alive.filter((x) => x.id !== o.id);
    const free = freeRuns(heap.cells, alive);
    frames.push({
      views: [{ objs: alive, roots: heap.roots, free, ptrs: [{ label: "sweep", at: o.addr }] }],
      note: `${o.id} is unmarked. its ${o.size} cell${o.size > 1 ? "s go" : " goes"} on the free list. nothing moves.`,
      tag: "sweep",
    });
  }
  const free = freeRuns(heap.cells, alive);
  const total = free.reduce((a, r) => a + r[1], 0);
  const biggest = Math.max(...free.map((r) => r[1]));
  frames.push({
    views: [{ objs: alive.map((o) => ({ ...o, state: "plain" })), roots: heap.roots, free, ghost: { size: want, ok: false } }],
    note: `done. ${total} cells are free, but the biggest hole is ${biggest}. now allocate a ${want}-cell object: there's nowhere to put it. that's fragmentation.`,
    tag: "sweep",
  });
  return frames;
}

export function compact(heap: Heap, marked: Set<string>, want = 3) {
  const frames: Frame[] = [];
  const objs = [...heap.objs].sort(byAddr);
  const live = objs.filter((o) => marked.has(o.id));
  const dest = new Map<string, number>();
  let top = 0;
  for (const o of live) {
    dest.set(o.id, top);
    top += o.size;
  }
  const start = objs.map((o) => ({ ...o, state: (marked.has(o.id) ? "live" : "dead") as ObjState }));
  frames.push({
    views: [{ objs: start, roots: heap.roots }],
    note: "compact: same mark as before. but instead of keeping holes, slide every live object down to the start of the heap. it takes three passes.",
    tag: "compact",
  });
  frames.push({
    views: [{ objs: start.map((o) => (marked.has(o.id) ? { ...o, fwd: dest.get(o.id) } : o)), roots: heap.roots, ptrs: [{ label: "new top", at: top }] }],
    note: `pass 1: walk the live objects in address order and work out where each one will land. ${live
      .map((o) => `${o.id} → ${dest.get(o.id)}`)
      .join(", ")}. that's its forwarding address.`,
    tag: "compact",
  });
  frames.push({
    views: [{ objs: start.map((o) => (marked.has(o.id) ? { ...o, fwd: dest.get(o.id), state: "hot" } : o)), roots: heap.roots, ptrs: [{ label: "new top", at: top }] }],
    note: "pass 2: rewrite every reference (roots and fields) to the forwarding address of its target. nothing has moved yet, but every pointer already says where things are going.",
    tag: "compact",
  });
  const moved = live.map((o) => ({ ...o, addr: dest.get(o.id)!, state: "live" as ObjState }));
  frames.push({
    views: [{ objs: moved, roots: heap.roots, free: [[top, heap.cells - top]], ptrs: [{ label: "top", at: top }] }],
    note: "pass 3: slide each object down to its new address. the order is kept (an object only ever moves left), so this is safe to do in place.",
    tag: "compact",
  });
  frames.push({
    views: [
      {
        objs: [...moved.map((o) => ({ ...o, state: "plain" as ObjState })), { id: "new", addr: top, size: want, refs: [], state: "new" as ObjState }],
        roots: heap.roots,
        free: [[top + want, heap.cells - top - want]],
        ptrs: [{ label: "top", at: top + want }],
      },
    ],
    note: `one free block of ${heap.cells - top} cells. the ${want}-cell object fits, and allocating it is a pointer bump. the price: compaction touched the live objects three times.`,
    tag: "compact",
  });
  return frames;
}

export function copy(heap: Heap) {
  const frames: Frame[] = [];
  const get = (id: string) => heap.objs.find((o) => o.id === id)!;
  const fwd = new Map<string, number>();
  const toObjs: ObjView[] = [];
  let free = 0;
  let scan = 0;
  const roots = heap.roots.map((r) => ({ ...r }));
  const rootSpace = new Map<string, "from" | "to">(heap.roots.map((r) => [r.id, "from"]));

  const snap = (note: string, opts: { hot?: string; end?: boolean } = {}): Frame => {
    const scanned = new Set(toObjs.filter((o) => o.addr < scan).map((o) => o.id));
    const fromV: View = {
      label: opts.end ? "from-space (all garbage now)" : "from-space",
      objs: heap.objs.map((o) =>
        fwd.has(o.id)
          ? { ...o, state: "fwd", fwd: fwd.get(o.id) }
          : { ...o, state: opts.end ? "dead" : "plain" },
      ),
      roots: roots.filter((r) => rootSpace.get(r.id) === "from"),
    };
    const toV: View = {
      label: "to-space",
      objs: toObjs.map((o) => ({ ...o, state: o.id === opts.hot ? "hot" : scanned.has(o.id) ? "live" : "grey" })),
      roots: roots.filter((r) => rootSpace.get(r.id) === "to"),
      ptrs: opts.end
        ? [{ label: "top", at: free }]
        : [
            { label: "scan", at: scan },
            { label: "free", at: free },
          ],
    };
    return { views: [fromV, toV], note, tag: "copy" };
  };

  const evacuate = (id: string) => {
    if (fwd.has(id)) return false;
    const o = get(id);
    fwd.set(id, free);
    toObjs.push({ ...o, addr: free, state: "grey" });
    free += o.size;
    return true;
  };

  frames.push(
    snap("copying: the heap is split into two halves. everything lives in from-space. to-space is empty, and the collector never sweeps anything."),
  );

  for (const r of roots) {
    if (!r.to) continue;
    const copied = evacuate(r.to);
    rootSpace.set(r.id, "to");
    frames.push(
      snap(
        copied
          ? `root ${r.label} → ${r.to}. copy ${r.to} to to-space at ${fwd.get(r.to)}, leave a forwarding address in the old copy, point the root at the new one.`
          : `root ${r.label} → ${r.to}, which already moved. just update the root.`,
        { hot: r.to },
      ),
    );
  }

  while (scan < free) {
    const o = toObjs.find((x) => x.addr === scan)!;
    const copiedNow: string[] = [];
    const already: string[] = [];
    for (const k of o.refs) {
      if (evacuate(k)) copiedNow.push(k);
      else already.push(k);
    }
    const parts: string[] = [];
    if (copiedNow.length) parts.push(`copy ${copiedNow.join(" and ")} to the free pointer`);
    if (already.length) parts.push(`${already.join(" and ")} already moved, so just follow ${already.length > 1 ? "their" : "its"} forwarding address`);
    const note = o.refs.length
      ? `scan ${o.id}: it points at ${o.refs.join(", ")}. ${parts.join("; ")}. update ${o.id}'s fields.`
      : `scan ${o.id}: no references. nothing to copy.`;
    frames.push(snap(note, { hot: o.id }));
    scan += o.size;
  }

  const garbage = heap.objs.filter((x) => !fwd.has(x.id)).map((x) => x.id);
  frames.push(
    snap(
      `scan caught up with free: done. the collector touched only the ${toObjs.length} live objects. ${garbage.join(", ")} were never even looked at. from-space is now pure garbage.`,
      { end: true },
    ),
  );
  frames.push({
    views: [
      { label: "to-space (the new from-space)", objs: toObjs.map((o) => ({ ...o, state: "plain" })), roots: roots, ptrs: [{ label: "top", at: free }], free: [[free, heap.cells - free]] },
      { label: "from-space (the new to-space)", objs: [], roots: [] },
    ],
    note: `throw the whole old half away in one go and swap roles. new objects bump-allocate from ${free}. the price: half the memory always sits empty.`,
    tag: "copy",
  });
  return frames;
}

/** the graph every fundamentals figure uses. 20 cells, two roots, a garbage cycle (H ↔ I). */
export const DEMO: Heap = {
  cells: 20,
  roots: [
    { id: "r1", label: "order", to: "A" },
    { id: "r2", label: "CACHE", to: "F" },
  ],
  objs: [
    { id: "A", addr: 0, size: 2, refs: ["B", "C"] },
    { id: "D", addr: 2, size: 1, refs: [] },
    { id: "B", addr: 3, size: 2, refs: ["E"] },
    { id: "H", addr: 5, size: 2, refs: ["I"] },
    { id: "C", addr: 7, size: 1, refs: [] },
    { id: "J", addr: 8, size: 2, refs: ["E"] },
    { id: "E", addr: 10, size: 2, refs: [] },
    { id: "I", addr: 12, size: 1, refs: ["H"] },
    { id: "F", addr: 13, size: 3, refs: ["G"] },
    { id: "K", addr: 16, size: 1, refs: [] },
    { id: "G", addr: 17, size: 2, refs: ["C"] },
  ],
};
