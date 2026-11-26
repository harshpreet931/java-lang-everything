"use client";

import { useMemo } from "react";
import { DotField, DotLegend, at, dotField, type Comet, type Look } from "@/components/viz/DotField";
import { StepControls, useStepper } from "@/components/viz/stepper";

// two threads, two stacks, one heap, drawn as a dot field. every frame and object is
// a block of dots with a meta header column; every reference is a run of ref dots.
// stepping through follows the references: a comet runs from a frame's slot to the
// object it points at, and the object it lands on lights hot. the last step fires both
// at once, because that is the whole point: two threads, one object.

const P = 12;

type Layout = "wide" | "narrow";

function build(layout: Layout) {
  if (layout === "wide") {
    const f = dotField(56, 17);
    // thread main
    f.block("handle", 1, 3, 9, 3);
    f.set("handle", 9, 4, "ref").set("handle", 9, 5, "ref");
    f.block("main", 1, 9, 9, 2);
    // thread worker
    f.block("flush", 46, 3, 9, 3);
    f.set("flush", 46, 4, "ref");
    f.block("run", 46, 9, 9, 2);
    // heap
    f.block("list", 22, 3, 12, 4);
    f.block("req", 22, 11, 8, 3);
    f.block("str", 33, 11, 5, 2);
    f.path("m-list", [[10, 4], [21, 4]]);
    f.path("m-req", [[10, 5], [14, 5], [14, 12], [21, 12]]);
    f.path("w-list", [[45, 4], [34, 4]]);
    f.path("req-str", [[30, 12], [32, 12]]);
    return { f: f.done(), cols: 56 };
  }
  const f = dotField(30, 26);
  f.block("handle", 0, 3, 10, 3);
  f.set("handle", 9, 4, "ref").set("handle", 9, 5, "ref");
  f.block("main", 0, 9, 10, 2);
  f.block("flush", 20, 3, 10, 3);
  f.set("flush", 20, 4, "ref");
  f.block("run", 20, 9, 10, 2);
  f.block("list", 9, 15, 12, 3);
  f.block("req", 1, 22, 8, 3);
  f.block("str", 13, 22, 5, 2);
  f.path("m-list", [[10, 4], [12, 4], [12, 14]]);
  f.path("m-req", [[10, 5], [11, 5], [11, 8], [11, 12], [4, 12], [4, 21]]);
  f.path("w-list", [[19, 4], [17, 4], [17, 14]]);
  f.path("req-str", [[9, 23], [12, 23]]);
  return { f: f.done(), cols: 30 };
}

const STEPS = [
  { note: "two threads, two stacks, one heap. each stack holds only its own thread's frames and locals." },
  { note: "main follows its reference out of handle(req) and lands on the ArrayList." },
  { note: "worker follows its own reference out of flush(). it lands on the same ArrayList." },
  { note: "both at once. nothing in the picture stops two threads touching one object together: that's every race in part 09." },
] as const;

function Labels({ layout }: { layout: Layout }) {
  const t = (x: number, y: number, s: string, cls = "lbl", anchor?: "end" | "middle") => (
    <text x={x} y={y} className={cls} textAnchor={anchor}>
      {s}
    </text>
  );
  if (layout === "wide")
    return (
      <>
        {t(P * 1, 12, "thread main, stack")}
        {t(P * 55, 12, "thread worker, stack", "lbl", "end")}
        {t(P * 28, 12, "heap, shared by every thread", "lbl", "middle")}
        {t(P * 1, at(2, P) + 4, "handle(req)", "val")}
        {t(P * 1, at(8, P) + 4, "main()", "key")}
        {t(P * 55, at(2, P) + 4, "flush()", "val", "end")}
        {t(P * 55, at(8, P) + 4, "run()", "key", "end")}
        {t(P * 22, at(2, P) + 4, "ArrayList", "val")}
        {t(P * 22, at(10, P) + 4, "Request", "val")}
        {t(P * 38, at(13, P) + 4, "String", "key", "end")}
        {t(P * 1, at(15, P) + 4, "locals: private to their thread.")}
        {t(P * 55, at(15, P) + 4, "objects: anyone with a reference can touch them.", "lbl", "end")}
      </>
    );
  return (
    <>
      {t(0, 12, "main, stack")}
      {t(P * 30, 12, "worker, stack", "lbl", "end")}
      {t(0, at(2, P) + 4, "handle(req)", "val")}
      {t(0, at(8, P) + 4, "main()", "key")}
      {t(P * 30, at(2, P) + 4, "flush()", "val", "end")}
      {t(P * 30, at(8, P) + 4, "run()", "key", "end")}
      {t(P * 21, at(14, P) + 4, "ArrayList", "val", "end")}
      {t(P * 1, at(20, P) + 4, "Request", "val")}
      {t(P * 18, at(24, P) + 6, "String", "key", "end")}
      {t(P * 30, at(13, P) + 4, "heap, shared", "lbl", "end")}
    </>
  );
}

export function ThreadsShareHeap() {
  const s = useStepper(STEPS.length, { interval: 1800 });
  const wide = useMemo(() => build("wide"), []);
  const narrow = useMemo(() => build("narrow"), []);
  const i = s.i;

  const look: Record<string, Look> = {
    list: i >= 1 ? { tone: "hot", wave: 26, delay: 300 } : {},
    handle: { dim: i === 2 },
    main: { dim: true },
    flush: { dim: i === 1 },
    run: { dim: true },
    "m-list": { dim: i === 2 },
    "m-req": { dim: i >= 1 },
    "w-list": { dim: i === 1 },
    req: { dim: i >= 1 },
    str: { dim: i >= 1 },
    "req-str": { dim: i >= 1 },
  };
  // comet keys change only on the steps that follow a reference
  const comets: Comet[] = [
    { path: "m-list", k: i === 1 || i === 3 ? `m${i}` : "m" },
    { path: "w-list", k: i === 2 || i === 3 ? `w${i}` : "w" },
  ];

  const label =
    "two threads. thread main's stack has frames handle(req) and main(); thread worker's stack has flush() and run(). one shared heap holds an ArrayList, a Request and a String. handle(req) references the ArrayList and the Request; flush() references the same ArrayList.";

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <DotField field={wide.f} pitch={P} look={look} comets={comets} label={label} className="hidden sm:block" pad={[0, 0, 0, 0]} seed={11}>
        <Labels layout="wide" />
      </DotField>
      <DotField field={narrow.f} pitch={P} look={look} comets={comets} label={label} className="mx-auto max-w-[420px] sm:hidden" seed={11}>
        <Labels layout="narrow" />
      </DotField>
      <p className="min-h-[3.3em] font-serif text-[1.02rem] leading-[1.6] text-ink" aria-live="polite">
        {STEPS[i].note}
      </p>
      <StepControls s={s} compact />
      <DotLegend
        items={[
          { k: "ref", label: "reference" },
          { k: "meta", label: "header" },
          { k: "hot", label: "reached now" },
        ]}
      />
    </div>
  );
}
