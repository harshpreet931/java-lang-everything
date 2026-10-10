"use client";

import Link from "next/link";
import { useState } from "react";

// a decision tree for picking a collection. questions → answers → a recommendation.
// the advice is this part's: defaults first, a specialised class only when a question demands it.

type Leaf = { pick: string; why: string; cost: string; also?: string; href: string };
type Q = { q: string; options: { label: string; next: Q | Leaf }[] };

const L = (pick: string, why: string, cost: string, href: string, also?: string): Leaf => ({ pick, why, cost, href, also });
const isLeaf = (x: Q | Leaf): x is Leaf => "pick" in x;

const concurrentMap: Q = {
  q: "do the keys need an order?",
  options: [
    { label: "no", next: L("ConcurrentHashMap", "lock-free reads, fine-grained locking on writes, atomic compute and merge.", "O(1) average", "/learn/concurrency/concurrent-collections") },
    { label: "sorted", next: L("ConcurrentSkipListMap", "a concurrent sorted map: a skip list instead of a red-black tree, so many threads can work on it at once.", "O(log n)", "/learn/concurrency/concurrent-collections") },
    {
      label: "insertion / access",
      next: L("a cache library (or synchronizedMap)", "there's no concurrent LinkedHashMap in the JDK. for an LRU cache shared by threads, use a library like Caffeine. for a small one, Collections.synchronizedMap around a LinkedHashMap.", "depends", "/learn/collections/linkedhashmap-and-lru"),
    },
  ],
};

const plainMap: Q = {
  q: "do the keys need an order?",
  options: [
    {
      label: "no",
      next: {
        q: "are the keys enum constants?",
        options: [
          { label: "no", next: L("HashMap", "the default map. hashing gets you to the right bucket in one step.", "get / put O(1) average", "/learn/collections/hashmap") },
          { label: "yes", next: L("EnumMap", "an array indexed by ordinal. faster and smaller than any hash map, iterates in declaration order.", "O(1), no hashing", "/learn/collections/sets") },
        ],
      },
    },
    { label: "insertion order", next: L("LinkedHashMap", "a HashMap plus a linked list through the entries, so iteration follows insertion order.", "O(1) average, ~8 more bytes per entry", "/learn/collections/linkedhashmap-and-lru") },
    { label: "access order (LRU)", next: L("LinkedHashMap(…, true)", "access order plus removeEldestEntry is a complete LRU cache.", "O(1) average", "/learn/collections/linkedhashmap-and-lru") },
    { label: "sorted, or ranges", next: L("TreeMap", "a red-black tree: sorted keys, floor / ceiling / headMap / subMap.", "O(log n)", "/learn/collections/treemap") },
  ],
};

const plainSet: Q = {
  q: "does the iteration order matter?",
  options: [
    {
      label: "no",
      next: {
        q: "are the elements enum constants?",
        options: [
          { label: "no", next: L("HashSet", "a HashMap with dummy values. contains in one hash lookup.", "add / contains O(1) average", "/learn/collections/sets") },
          { label: "yes", next: L("EnumSet", "a bit vector: one long for up to 64 constants. set operations are single bitwise instructions.", "O(1)", "/learn/collections/sets") },
        ],
      },
    },
    { label: "insertion order", next: L("LinkedHashSet", "a HashSet that remembers insertion order (and is a SequencedSet).", "O(1) average", "/learn/collections/sets") },
    { label: "sorted", next: L("TreeSet", "a TreeMap with dummy values: sorted, with floor / ceiling / headSet.", "O(log n)", "/learn/collections/sets") },
  ],
};

const concurrentValues: Q = {
  q: "what kind of collection?",
  options: [
    { label: "a list, read far more than written", next: L("CopyOnWriteArrayList", "every write copies the array, so readers never lock and iterators never throw. listener lists, config.", "reads O(1), writes O(n)", "/learn/collections/iterators-and-fail-fast") },
    { label: "a queue between threads", next: L("ArrayBlockingQueue / LinkedBlockingQueue", "producers put, consumers take, and both block when they have to. bounded queues give you backpressure.", "O(1)", "/learn/concurrency/concurrent-collections") },
    { label: "a set", next: L("ConcurrentHashMap.newKeySet()", "a concurrent set backed by a ConcurrentHashMap. ConcurrentSkipListSet if it must be sorted.", "O(1) average", "/learn/concurrency/concurrent-collections") },
    { label: "a priority queue", next: L("PriorityBlockingQueue", "a thread-safe binary heap that blocks consumers while it's empty.", "O(log n)", "/learn/concurrency/concurrent-collections") },
  ],
};

const plainValues: Q = {
  q: "can it hold duplicates?",
  options: [
    { label: "no, each thing once", next: plainSet },
    {
      label: "yes",
      next: {
        q: "how do you mostly get things out?",
        options: [
          { label: "by index, or just iterate", next: L("ArrayList", "an array that grows. get(i) is one read, iteration is cache-friendly, and it's the default for a reason.", "get O(1), add amortized O(1), insert in the middle O(n)", "/learn/collections/arraylist") },
          { label: "from the ends (queue / stack)", next: L("ArrayDeque", "a circular buffer: O(1) at both ends, no node objects. the right stack and the right queue.", "O(1) at both ends", "/learn/collections/linkedlist-and-arraydeque") },
          { label: "smallest / highest priority first", next: L("PriorityQueue", "a binary heap in an array. always knows the best element, never sorts the rest.", "offer / poll O(log n), peek O(1)", "/learn/collections/priorityqueue") },
        ],
      },
    },
  ],
};

const ROOT: Q = {
  q: "what are you storing?",
  options: [
    {
      label: "single values",
      next: {
        q: "will several threads change it at once?",
        options: [
          { label: "no", next: plainValues },
          { label: "yes", next: concurrentValues },
        ],
      },
    },
    {
      label: "key → value pairs",
      next: {
        q: "will several threads change it at once?",
        options: [
          { label: "no", next: plainMap },
          { label: "yes", next: concurrentMap },
        ],
      },
    },
  ],
};

export function CollectionPicker() {
  const [path, setPath] = useState<number[]>([]);
  // walk the answers
  const trail: { q: string; a: string }[] = [];
  let node: Q | Leaf = ROOT;
  for (const i of path) {
    const q = node as Q;
    trail.push({ q: q.q, a: q.options[i].label });
    node = q.options[i].next;
  }
  const leaf = isLeaf(node) ? node : null;
  const cur = isLeaf(node) ? null : node;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <ol className="grid gap-0">
        {trail.map((t, k) => (
          <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2 text-13">
            <span className="text-mute">{t.q}</span>
            <button className="word !min-h-7 text-hi" aria-pressed onClick={() => setPath(path.slice(0, k))} title="change this answer">
              {t.a}
            </button>
          </li>
        ))}
      </ol>

      {cur && (
        <div className="grid gap-3" aria-live="polite">
          <div className="font-serif text-20 text-hi">{cur.q}</div>
          <div className="flex flex-wrap gap-2">
            {cur.options.map((o, i) => (
              <button key={o.label} className="act" onClick={() => setPath([...path, i])}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {leaf && (
        <div className="grid gap-3 rounded-md bg-bg px-5 py-4 shadow-[inset_0_0_0_1px_var(--live)]" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-18 text-live">{leaf.pick}</span>
            <Link href={leaf.href} className="link text-12 text-mute">
              the chapter →
            </Link>
          </div>
          <p className="font-serif text-16 leading-[1.55] text-ink">{leaf.why}</p>
          <div className="text-12 text-mute">
            cost: <span className="text-hi">{leaf.cost}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {path.length > 0 && (
          <button className="act" onClick={() => setPath([])}>
            start over
          </button>
        )}
        <span className="font-serif text-15 text-mute">
          {leaf
            ? "and if it never changes after you build it, freeze it: List.copyOf, Set.copyOf, Map.copyOf."
            : "answer a few questions. click an earlier answer to change it."}
        </span>
      </div>
    </div>
  );
}
