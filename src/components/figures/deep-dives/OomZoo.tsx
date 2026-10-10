"use client";

import { useState, type ReactNode } from "react";
import { Chip } from "./kit";

// every message here was reproduced on jdk 25.0.4 (temurin, macOS aarch64) with the program
// and flags shown; the first line of the real output is quoted exactly. "dump" and "exit" say
// whether -XX:+HeapDumpOnOutOfMemoryError and -XX:+ExitOnOutOfMemoryError fired for it
// (tested one by one; for the 7 GB StringBuilder, with a plain `throw new OutOfMemoryError`):
// they only react to errors the JVM itself throws, not ones thrown by
// library code like java.nio.Bits.

type Animal = {
  id: string;
  name: string;
  message: string;
  ran: ReactNode;
  repro: string;
  code: string;
  fix: ReactNode;
  dump: boolean;
  thrower: "the JVM" | "library code";
};

const ZOO: Animal[] = [
  {
    id: "heap",
    name: "Java heap space",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: Java heap space',
    ran: <>the heap. a full GC ran and still couldn't find room for the object you asked for, within <code>-Xmx</code>.</>,
    repro: "java -Xmx16m Heap.java",
    code: "while (true) keep.add(new byte[1024 * 1024]);",
    fix: (
      <>
        either the live data really is bigger than the heap (raise <code>-Xmx</code>), or something is holding on to objects it shouldn't. if a heap dump says the second, it's a{" "}
        <a href="/learn/gc/memory-leaks">leak</a>.
      </>
    ),
    dump: true,
    thrower: "the JVM",
  },
  {
    id: "overhead",
    name: "GC overhead limit exceeded",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: GC overhead limit exceeded',
    ran: (
      <>
        patience. Parallel only: more than 98% of the time spent in GC (<code>GCTimeLimit</code>) while getting back less than 2% of the heap (<code>GCHeapFreeLimit</code>). the
        same program under G1 just says <code>Java heap space</code>.
      </>
    ),
    repro: "java -XX:+UseParallelGC -Xmx16m Overhead.java",
    code: 'for (int i = 0; ; i++) map.put(i, "value " + i);',
    fix: <>same as heap space: it's a heap that's full of live data, caught earlier. the limit is there so the app dies instead of crawling for hours.</>,
    dump: true,
    thrower: "the JVM",
  },
  {
    id: "array",
    name: "Requested array size exceeds VM limit",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: Requested array size exceeds VM limit',
    ran: (
      <>
        not memory at all: the length. on this JVM the longest array you can ask for is <code>Integer.MAX_VALUE - 2</code> elements. one more and it refuses before looking at
        the heap, even with plenty free.
      </>
    ),
    repro: "java BigArray.java",
    code: "int[] a = new int[Integer.MAX_VALUE];",
    fix: <>usually a size computed from bad input or an int overflow. if you really need more than two billion elements, split them across several arrays.</>,
    dump: true,
    thrower: "the JVM",
  },
  {
    id: "length",
    name: "Required array length ... is too large",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: Required array length 2147483639 + 9 is too large',
    ran: <>the same length limit, hit by a growing collection: <code>StringBuilder</code>, <code>ArrayList</code> and friends compute their next capacity and give up near 2³¹.</>,
    repro: "java -Xmx7g Builder.java",
    code: "while (true) sb.append(chunk);   // 1 MB chunks",
    fix: <>a 2-billion-character string is never what you wanted. stream it to a file or a socket instead of building it in memory.</>,
    dump: false,
    thrower: "library code",
  },
  {
    id: "metaspace",
    name: "Metaspace",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: Metaspace',
    ran: <>class metadata. it lives in native memory, capped only if you set <code>-XX:MaxMetaspaceSize</code> (unlimited by default).</>,
    repro: "java -XX:MaxMetaspaceSize=16m Classes.java",
    code: "while (true) kept.add(lookup.defineHiddenClass(bytes, false).lookupClass());",
    fix: (
      <>
        something keeps generating classes and never lets them go: proxies, scripting engines, and most often a redeployed app whose old class loader is still reachable. see{" "}
        <a href="/learn/deep-dives/classloader-leaks">class loader leaks</a>.
      </>
    ),
    dump: true,
    thrower: "the JVM",
  },
  {
    id: "ccs",
    name: "Compressed class space",
    message: 'Exception in thread "main" java.lang.OutOfMemoryError: Compressed class space',
    ran: (
      <>
        the part of metaspace that holds the class structures object headers point at. one contiguous range, 1 GB by default (<code>-XX:CompressedClassSpaceSize</code>, 16 MB
        at least: asking for 1 MB got a warning and 16).
      </>
    ),
    repro: "java -XX:CompressedClassSpaceSize=16m Classes.java",
    code: "// the same class-generating loop",
    fix: <>same root cause as Metaspace, a different ceiling. with the default 1 GB you'll basically only see it with a class leak.</>,
    dump: true,
    thrower: "the JVM",
  },
  {
    id: "threads",
    name: "unable to create native thread",
    message: "java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached",
    ran: (
      <>
        OS threads, usually not memory. here the 6,124th thread: macOS caps a process at 6,144. on linux it's <code>ulimit -u</code>, the container's pid limit, or address
        space for the stacks.
      </>
    ),
    repro: "java Threads.java",
    code: "while (true) new Thread(LockSupport::park).start();",
    fix: (
      <>
        don't create a thread per task. use a bounded pool, or <a href="/learn/concurrency/virtual-threads">virtual threads</a>, which aren't OS threads at all.
      </>
    ),
    dump: false,
    thrower: "the JVM",
  },
  {
    id: "direct",
    name: "Cannot reserve ... direct buffer memory",
    message: "java.lang.OutOfMemoryError: Cannot reserve 1048576 bytes of direct buffer memory (allocated: 67108864, limit: 67108864)",
    ran: (
      <>
        direct <code>ByteBuffer</code> memory, outside the heap, capped by <code>-XX:MaxDirectMemorySize</code> (defaults to the max heap size). this run kept zero buffers: it
        also had <code>-XX:+DisableExplicitGC</code>.
      </>
    ),
    repro: "java -XX:MaxDirectMemorySize=64m -XX:+DisableExplicitGC Buffers.java",
    code: "ByteBuffer.allocateDirect(1 << 20);   // in a loop, then dropped",
    fix: (
      <>
        pool and reuse buffers, raise the limit if you really need more, and never pair direct buffers with <code>DisableExplicitGC</code>. the whole story is in{" "}
        <a href="/learn/gc/native-memory">native memory</a>.
      </>
    ),
    dump: false,
    thrower: "library code",
  },
];

export function OomZoo() {
  const [id, setId] = useState(ZOO[0].id);
  const a = ZOO.find((z) => z.id === id)!;
  return (
    <div className="@container">
      <div className="grid gap-4 @[640px]:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="grid content-start gap-1" role="group" aria-label="which OutOfMemoryError">
          {ZOO.map((z) => (
            <button
              key={z.id}
              className="word text-left whitespace-normal"
              aria-pressed={id === z.id}
              onClick={() => setId(z.id)}
            >
              {z.name}
            </button>
          ))}
        </div>
        <div className="min-w-0">
          <div className="rounded-md bg-bg px-3 py-2.5 text-[11px] leading-[1.7] text-dead shadow-[inset_0_0_0_1px_var(--line)] [overflow-wrap:anywhere]">
            {a.message}
          </div>
          <div className="mt-3 grid gap-2 font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
            <p>
              <span className="mr-2 font-mono text-11 text-faint">ran out of</span>
              {a.ran}
            </p>
            <p>
              <span className="mr-2 font-mono text-11 text-faint">fix</span>
              {a.fix}
            </p>
          </div>
          <div className="mt-3 rounded-md bg-bg px-3 py-2 text-11 leading-[1.7] shadow-[inset_0_0_0_1px_var(--line)] [overflow-wrap:anywhere]">
            <div className="text-faint">reproduce</div>
            <div className="text-hi">$ {a.repro}</div>
            <div className="text-mute">{a.code}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone={a.thrower === "the JVM" ? "meta" : undefined}>thrown by {a.thrower}</Chip>
            <Chip tone={a.dump ? "live" : "dead"}>HeapDumpOnOutOfMemoryError: {a.dump ? "fires" : "silent"}</Chip>
            <Chip tone={a.dump ? "live" : "dead"}>ExitOnOutOfMemoryError: {a.dump ? "fires" : "silent"}</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}
