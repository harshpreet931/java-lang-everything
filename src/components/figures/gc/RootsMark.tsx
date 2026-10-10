"use client";

import { useMemo } from "react";
import { GcStepper } from "./GcStepper";
import { mark, type Heap } from "./heap";

// marking from three kinds of roots: a local in main's frame, a local in another
// thread's frame, and a static field. H and I point at each other and are still garbage.
// K points at a live object, and that doesn't help K at all.

const REACH: Heap = {
  cells: 20,
  roots: [
    { id: "r1", label: "order", to: "A" },
    { id: "r2", label: "req", to: "E" },
    { id: "r3", label: "CACHE", to: "F" },
  ],
  objs: [
    { id: "A", addr: 0, size: 2, refs: ["B"] },
    { id: "D", addr: 2, size: 1, refs: [] },
    { id: "B", addr: 3, size: 2, refs: ["C"] },
    { id: "H", addr: 5, size: 2, refs: ["I"] },
    { id: "C", addr: 7, size: 1, refs: [] },
    { id: "E", addr: 8, size: 2, refs: ["C"] },
    { id: "I", addr: 10, size: 1, refs: ["H"] },
    { id: "F", addr: 11, size: 3, refs: ["G"] },
    { id: "K", addr: 14, size: 2, refs: ["F"] },
    { id: "G", addr: 16, size: 2, refs: [] },
  ],
};

export function RootsMark() {
  const frames = useMemo(() => mark(REACH).frames, []);
  return (
    <GcStepper
      frames={frames}
      layout={{ cells: 20, rootSlots: 3, arcDepth: 58 }}
      id="rm"
      legend={[
        ["ref", "roots and references"],
        ["hot", "being marked / on the stack"],
        ["live", "marked: reachable"],
        ["dead", "never marked: garbage"],
      ]}
    />
  );
}
