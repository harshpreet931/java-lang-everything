"use client";

import type { Step } from "@/lib/trace";
import { MemoryPane } from "./MemoryStepperClient";

/**
 * a single, static memory snapshot: stack frames, heap objects, reference arrows.
 * same data shape as one step of a trace (code-free).
 *
 *   <Memory frames={[{ name: "main", locals: { age: 21, p: { ref: "p1" } } }]}
 *           heap={{ p1: { type: "Person", fields: { name: { ref: "s1" }, age: 36 } }, s1: { type: "String", value: '"ada"' } }} />
 */
export function Memory({ frames, heap, note }: { frames: Step["frames"]; heap: Step["heap"]; note?: string }) {
  return (
    <div className="memory">
      <MemoryPane step={{ line: 0, frames, heap }} />
      {note && <p className="mt-4 text-13 text-mute">{note}</p>}
    </div>
  );
}
