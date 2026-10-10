"use client";

import { useMemo, useState } from "react";
import { GcStepper } from "./GcStepper";
import { DEMO, compact, copy, mark, sweep } from "./heap";
import { Row, Words } from "./kit";

// one heap, three ways to reclaim it. same objects, same roots, same garbage cycle (H ↔ I),
// so the only thing that changes between tabs is the algorithm.

type Algo = "mark-sweep" | "mark-compact" | "copying";

export function GcLab() {
  const [algo, setAlgo] = useState<Algo>("mark-sweep");

  const frames = useMemo(() => {
    const m = mark(DEMO);
    if (algo === "mark-sweep") return [...m.frames, ...sweep(DEMO, m.marked)];
    if (algo === "mark-compact") return compact(DEMO, m.marked);
    return copy(DEMO);
  }, [algo]);

  const layout =
    algo === "copying"
      ? { cells: DEMO.cells, rootSlots: 2, ptrRow: true, arcDepth: 50 }
      : { cells: DEMO.cells, rootSlots: 2, ptrRow: true, arcDepth: 56, ghostRoom: true };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Row k="algorithm" last>
        <Words options={["mark-sweep", "mark-compact", "copying"] as const} value={algo} onChange={setAlgo} label="collection algorithm" />
      </Row>
      <GcStepper
        key={algo}
        frames={frames}
        layout={layout}
        id={`lab-${algo}`}
        interval={1900}
        legend={[
          ["ref", "references"],
          ["hot", "being processed"],
          ["live", "live"],
          ["dead", "garbage"],
          ["meta", "GC machinery: free list, pointers, forwarding"],
        ]}
      />
    </div>
  );
}
