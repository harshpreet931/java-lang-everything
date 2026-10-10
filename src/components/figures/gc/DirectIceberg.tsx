"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Readout } from "./kit";

// a direct buffer is a tiny heap object holding a big native allocation. real numbers from
// jdk 25.0.4: a 1 MB ByteBuffer.allocateDirect costs 136 bytes of heap (DirectByteBuffer 64 +
// Cleaner 40 + Deallocator 32, from jcmd GC.class_histogram) and 1 MB of native memory.
// Buffers.java with -XX:MaxDirectMemorySize=64m: by default the JDK's own System.gc() frees
// the dead ones (15 full GCs for 1,000 buffers); with -XX:+DisableExplicitGC the 65th
// allocation dies with the OutOfMemoryError quoted below.

type Obj = "none" | "live" | "dead";
type Step = { heap: Obj[]; native: number; fresh?: number; gc?: boolean; oom?: boolean; note: string };

const N = 64;
const fill = (n: number, s: Obj): Obj[] => Array.from({ length: N }, (_, i) => (i < n ? s : "none"));

const STEPS: Step[] = [
  {
    heap: fill(1, "live"),
    native: 1,
    fresh: 0,
    note: "ByteBuffer.allocateDirect(1 << 20). in the heap: three small objects, 136 bytes. outside it: a 1 MB block from malloc. the heap object is the only handle to that memory.",
  },
  {
    heap: fill(64, "live"),
    native: 64,
    note: "64 of them. the heap barely noticed: 8.5 KB. native memory is at 64 MB, which is the limit this run set with -XX:MaxDirectMemorySize=64m.",
  },
  {
    heap: fill(64, "dead"),
    native: 64,
    note: "the code drops every buffer. the 64 heap objects are garbage now, but the native memory is only freed when a GC finds them and runs their cleaners. 8.5 KB of garbage is nothing, so no GC is coming any time soon.",
  },
  {
    heap: fill(1, "live"),
    native: 1,
    fresh: 0,
    gc: true,
    note: "the 65th allocateDirect doesn't fit under the limit. so the JDK calls System.gc() itself, waits for the cleaners, and tries again. the dead buffers go, their 64 MB comes back, the new one fits. allocating 1,000 throwaway buffers this way cost 15 full GCs.",
  },
  {
    heap: fill(64, "dead"),
    native: 64,
    oom: true,
    note: "same program with -XX:+DisableExplicitGC (a popular flag in old tuning guides). now that System.gc() does nothing, the garbage is never found, and a program that keeps zero buffers runs out of direct memory.",
  },
];

export function DirectIceberg() {
  const s = useStepper(STEPS.length, { interval: 2800 });
  const st = STEPS[s.i];
  return (
    <div {...s.keys} className="@container grid grid-cols-[minmax(0,1fr)] gap-3 outline-none" aria-label="direct buffers: small heap objects, big native blocks">
      <div className="grid gap-4 @[560px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-md bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-2 flex justify-between gap-2 text-11">
            <span className="text-hi">java heap</span>
            <span className="text-faint tabular">{(st.heap.filter((h) => h !== "none").length * 136).toLocaleString("en-US")} B</span>
          </div>
          <div className="grid w-fit grid-cols-[repeat(16,10px)] gap-[3px]" role="img" aria-label={`${st.heap.filter((h) => h === "live").length} live and ${st.heap.filter((h) => h === "dead").length} dead buffer objects`}>
            {st.heap.map((h, i) => (
              <span
                key={i}
                className="size-[10px] rounded-[2px] transition-[background,box-shadow,opacity] duration-200"
                style={{
                  background: h === "live" ? (st.fresh === i ? "var(--hot)" : "color-mix(in srgb, var(--ink) 60%, transparent)") : "transparent",
                  boxShadow: h === "dead" ? "inset 0 0 0 1px var(--dead)" : h === "none" ? "inset 0 0 0 1px var(--line)" : undefined,
                  opacity: h === "dead" ? 0.75 : 1,
                }}
              />
            ))}
          </div>
          <div className="mt-2 text-[10.5px] leading-snug text-faint">one square = DirectByteBuffer + Cleaner + Deallocator</div>
        </div>
        <div className="rounded-md bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-2 flex justify-between gap-2 text-11">
            <span className="text-hi">native memory, outside -Xmx</span>
            <span className="text-faint tabular">{st.native} / 64 MB</span>
          </div>
          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[3px]" role="img" aria-label={`${st.native} MB of direct memory allocated`}>
            {Array.from({ length: N }, (_, i) => (
              <span
                key={i}
                className="aspect-square rounded-[2px] transition-[background] duration-200"
                style={{
                  background: i < st.native ? (st.fresh === i ? "var(--hot)" : st.oom ? "color-mix(in srgb, var(--dead) 45%, transparent)" : "color-mix(in srgb, var(--ink) 45%, transparent)") : "transparent",
                  boxShadow: i < st.native ? undefined : "inset 0 0 0 1px var(--line)",
                }}
              />
            ))}
          </div>
          <div className="mt-2 text-[10.5px] text-faint">one square = 1 MB</div>
        </div>
      </div>
      <div className="min-h-[1.6em] text-11 leading-relaxed" aria-live="polite">
        {st.gc && <span className="text-mute">[gc] Pause Full (System.gc()), called from java.nio.Bits.reserveMemory</span>}
        {st.oom && (
          <span className="break-all text-dead">
            OutOfMemoryError: Cannot reserve 1048576 bytes of direct buffer memory (allocated: 67108864, limit: 67108864)
          </span>
        )}
      </div>
      <Readout minLines={3}>{st.note}</Readout>
      <StepControls s={s} />
    </div>
  );
}
