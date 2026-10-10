"use client";

import { Fragment, useState, type ReactNode } from "react";
import { CodePanel } from "@/components/figures/deep-dives/kit";

// the usual suspects: for each one, the code that leaks, the reference chain a heap dump
// would show you (GC root first, the memory you didn't mean to keep last), and the fix.

type Suspect = { id: string; label: string; code: string; hot: number[]; chain: string[]; fix: ReactNode };

const S: Suspect[] = [
  {
    id: "static",
    label: "static collection",
    code: `class Audit {
    static final List<Request> seen = new ArrayList<>();

    static void record(Request r) {
        seen.add(r);            // added on every request, removed never
    }
}`,
    hot: [5],
    chain: ["static Audit.seen", "ArrayList", "Object[1_234_567]", "Request × 1.2M"],
    fix: <>a <code>static</code> field lives until the class loader dies, which for your app's classes means until the JVM exits. bound it, or don't keep it.</>,
  },
  {
    id: "listener",
    label: "listener never removed",
    code: `class Screen implements AutoCloseable {
    final byte[] pixels = new byte[10_000_000];

    Screen(EventBus bus) {
        bus.subscribe(e -> redraw(e));   // captures this
    }
    public void close() { }              // forgot bus.unsubscribe(...)
}`,
    hot: [5, 7],
    chain: ["static EventBus.INSTANCE", "listeners", "lambda", "Screen", "byte[10_000_000]"],
    fix: <>unsubscribe in <code>close()</code>. the lambda calls an instance method, so it holds the whole <code>Screen</code>. long-lived publisher, short-lived subscriber: always this bug.</>,
  },
  {
    id: "cache",
    label: "cache with no eviction",
    code: `static final Map<String, Report> CACHE = new HashMap<>();

Report report(String customer, LocalDate day) {
    return CACHE.computeIfAbsent(customer + day, k -> build(customer, day));
}`,
    hot: [1],
    chain: ["static CACHE", "HashMap", "Node[]", "Node", "Report × every key ever"],
    fix: (
      <>
        a cache without a size limit or an expiry is a leak with good intentions: here, one entry per customer per day, forever. use a bounded one (a{" "}
        <a href="/learn/collections/linkedhashmap-and-lru">LinkedHashMap LRU</a>, or a library like Caffeine with a maximum size).
      </>
    ),
  },
  {
    id: "threadlocal",
    label: "ThreadLocal on a pool thread",
    code: `static final ThreadLocal<byte[]> SCRATCH =
        ThreadLocal.withInitial(() -> new byte[16 << 20]);

pool.submit(() -> {
    render(SCRATCH.get());      // 16 MB per pool thread, never remove()d
});`,
    hot: [4],
    chain: ["pool worker Thread", "threadLocals", "Entry[]", "Entry.value", "byte[16 MB]"],
    fix: (
      <>
        a live thread is a GC root, and pool threads live as long as the pool. <code>remove()</code> in a <code>finally</code>. the details are in{" "}
        <a href="/learn/deep-dives/threadlocal-internals">ThreadLocal internals</a>.
      </>
    ),
  },
  {
    id: "inner",
    label: "inner class this$0",
    code: `class Report {
    final List<Row> rows = loadMillionsOfRows();

    Runnable progress() {
        return new Runnable() {          // anonymous inner class
            public void run() { IO.println(rows.size() + " rows"); }
        };
    }
}
scheduler.scheduleAtFixedRate(report.progress(), 0, 1, SECONDS);`,
    hot: [5, 10],
    chain: ["scheduler worker Thread", "task queue", "ScheduledFutureTask", "Report$1", "this$0: Report", "rows"],
    fix: (
      <>
        the anonymous class reads <code>rows</code>, so it carries a hidden <code>this$0</code> to the whole <code>Report</code>, which lives as long as the
        scheduled task. cancel the task, or use a static nested class that takes only what it needs. see <a href="/learn/oop/nested-classes">nested classes</a>.
      </>
    ),
  },
  {
    id: "key",
    label: "mutable key",
    code: `Map<List<String>, Session> sessions = new HashMap<>();
List<String> key = new ArrayList<>(List.of("ada"));
sessions.put(key, new Session());
key.add("admin");               // hashCode changed while inside the map
sessions.remove(key);           // looks in the wrong bucket: removes nothing`,
    hot: [4, 5],
    chain: ["sessions", "HashMap", "Node[] (old bucket)", "Node", "Session"],
    fix: (
      <>
        the entry is still in the map, filed under the old hash, where neither <code>get</code> nor <code>remove</code> will ever look. only immutable keys. the
        whole story: <a href="/learn/deep-dives/equals-and-hashcode-traps">equals and hashCode traps</a>.
      </>
    ),
  },
];

export function Suspects() {
  const [id, setId] = useState(S[0].id);
  const s = S.find((x) => x.id === id)!;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="suspect">
        {S.map((x) => (
          <button key={x.id} className="word" aria-pressed={id === x.id} onClick={() => setId(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <CodePanel code={s.code} hot={s.hot} />
      <div>
        <div className="mb-1.5 text-11 text-faint">what the heap dump shows: the path from a GC root</div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-11" aria-label={`reference chain: ${s.chain.join(" to ")}`}>
          {s.chain.map((c, i) => {
            const first = i === 0;
            const last = i === s.chain.length - 1;
            return (
              <Fragment key={c}>
                {i > 0 && (
                  <span className="text-ref" aria-hidden>
                    →
                  </span>
                )}
                <span
                  className="rounded-[4px] px-1.5 py-0.5 whitespace-nowrap"
                  style={{
                    color: first ? "var(--ref)" : last ? "var(--dead)" : "var(--ink)",
                    background: last ? "color-mix(in srgb, var(--dead) 10%, transparent)" : "var(--bg)",
                    boxShadow: `inset 0 0 0 1px ${first ? "var(--ref)" : last ? "color-mix(in srgb, var(--dead) 55%, transparent)" : "var(--line-2)"}`,
                    borderStyle: first ? "dashed" : undefined,
                  }}
                >
                  {c}
                </span>
              </Fragment>
            );
          })}
        </div>
      </div>
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {s.fix}
      </p>
    </div>
  );
}
