"use client";

import { PhaseTimeline, type Seg } from "./PhaseTimeline";

// real GC cycles, copied out of -Xlog:gc* runs of the toy service (Service.java, see
// content/gc/serial-and-parallel.mdx) on jdk 25.0.4, macOS aarch64, 14 cores, -Xmx256m.
// start times come from the [gc,start] lines (1 ms resolution); durations from the log.

const g1 = (start: number, dur: number, label: string, line: string): Seg => ({ start, dur, label, line });

export function G1Cycle() {
  return (
    <PhaseTimeline
      from={28}
      to={124}
      ticks={[30, 50, 70, 90, 110]}
      pauses={[
        g1(32, 3.605, "young", "GC(0) Pause Young (Normal) (G1 Evacuation Pause) 53M->41M(256M) 3.605ms"),
        g1(48, 4.812, "young", "GC(1) Pause Young (Normal) (G1 Evacuation Pause) 117M->85M(256M) 4.812ms"),
        g1(63, 7.929, "young", "GC(2) Pause Young (Normal) (G1 Evacuation Pause) 144M->120M(256M) 7.929ms"),
        g1(79, 3.97, "young", "GC(3) Pause Young (Normal) (G1 Evacuation Pause) 167M->153M(256M) 3.970ms"),
        g1(89, 2.512, "young, starts marking", "GC(4) Pause Young (Concurrent Start) (G1 Evacuation Pause) 188M->182M(256M) 2.512ms"),
        g1(94, 0.337, "remark", "GC(5) Pause Remark 201M->135M(256M) 0.337ms"),
        g1(95, 1.366, "young", "GC(6) Pause Young (Normal) (G1 Evacuation Pause) 141M->137M(256M) 1.366ms"),
        g1(97.5, 0.024, "cleanup", "GC(5) Pause Cleanup 144M->144M(256M) 0.024ms"),
        g1(101, 1.685, "young, prepares mixed", "GC(7) Pause Young (Prepare Mixed) (G1 Evacuation Pause) 177M->171M(256M) 1.685ms"),
        g1(106, 1.803, "mixed", "GC(8) Pause Young (Mixed) (G1 Evacuation Pause) 199M->168M(256M) 1.803ms"),
        g1(110, 1.398, "mixed", "GC(9) Pause Young (Mixed) (G1 Evacuation Pause) 197M->164M(256M) 1.398ms"),
        g1(115, 1.403, "mixed", "GC(10) Pause Young (Mixed) (G1 Evacuation Pause) 194M->187M(256M) 1.403ms"),
        g1(118, 1.079, "young, starts marking again", "GC(11) Pause Young (Concurrent Start) (G1 Evacuation Pause) 209M->207M(256M) 1.079ms"),
      ]}
      concurrent={[g1(91.5, 6.233, "concurrent mark cycle", "GC(5) Concurrent Mark Cycle 6.233ms")]}
    />
  );
}

// ZGC: one young collection (GC(4), "Minor Collection (Allocation Rate)"), -Xlog:gc,gc+phases
// with uptimenanos. log timestamps are when a phase ended; start = end - duration.
export function ZgcCycle() {
  return (
    <PhaseTimeline
      from={233.6}
      to={252.4}
      ticks={[234, 238, 242, 246, 250]}
      pauses={[
        g1(234.084, 0.012, "pause mark start", "GC(4) y: Pause Mark Start 0.012ms"),
        g1(248.09, 0.006, "pause mark end", "GC(4) y: Pause Mark End 0.006ms"),
        g1(249.335, 0.019, "pause relocate start", "GC(4) y: Pause Relocate Start 0.019ms"),
      ]}
      concurrent={[
        g1(234.245, 13.716, "concurrent mark", "GC(4) y: Concurrent Mark 13.716ms"),
        g1(248.237, 0.662, "select relocation set", "GC(4) y: Concurrent Select Relocation Set 0.662ms"),
        g1(249.476, 2.337, "concurrent relocate", "GC(4) y: Concurrent Relocate 2.337ms"),
      ]}
    />
  );
}

// Shenandoah (single generation, the default mode in 25): GC(3), -Xlog:gc with uptimenanos.
export function ShenandoahCycle() {
  return (
    <PhaseTimeline
      from={84.5}
      to={94}
      ticks={[85, 87, 89, 91, 93]}
      pauses={[
        g1(84.806, 0.011, "init mark", "GC(3) Pause Init Mark (unload classes) 0.011ms"),
        g1(87.41, 0.142, "final mark", "GC(3) Pause Final Mark (unload classes) 0.142ms"),
        g1(90.788, 0.002, "init update refs", "GC(3) Pause Init Update Refs 0.002ms"),
        g1(93.499, 0.029, "final update refs", "GC(3) Pause Final Update Refs 0.029ms"),
      ]}
      concurrent={[
        g1(84.85, 2.381, "concurrent marking", "GC(3) Concurrent marking roots 0.058ms + Concurrent marking (unload classes) 2.299ms"),
        g1(87.618, 1.85, "weak refs, class unloading, cleanup", "GC(3) Concurrent thread roots / weak references / weak roots / class unloading / cleanup 100M->100M"),
        g1(89.672, 0.41, "concurrent evacuation", "GC(3) Concurrent evacuation 0.410ms"),
        g1(90.858, 2.479, "concurrent update references", "GC(3) Concurrent update references 2.182ms + Concurrent update thread roots 0.097ms"),
        g1(93.608, 0.161, "cleanup", "GC(3) Concurrent cleanup (unload classes) 123M->85M(256M) 0.012ms"),
      ]}
    />
  );
}
