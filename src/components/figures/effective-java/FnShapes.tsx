"use client";

import { useState } from "react";
import { Java, Narration } from "./kit";

// item 44. the six basic shapes in java.util.function. the other 37 interfaces in the
// package (43 in total on jdk 25) are these six with primitives or two arguments.

type Shape = {
  name: string;
  ins: string[];
  out: string;
  method: string;
  example: string;
  variants: string;
};

const SHAPES: Shape[] = [
  { name: "Supplier<T>", ins: [], out: "T", method: "T get()", example: "Supplier<Instant> now = Instant::now;", variants: "IntSupplier, LongSupplier, DoubleSupplier, BooleanSupplier" },
  { name: "Consumer<T>", ins: ["T"], out: "void", method: "void accept(T t)", example: "Consumer<String> log = IO::println;", variants: "IntConsumer, ..., BiConsumer<T, U>, ObjIntConsumer<T>" },
  { name: "Function<T, R>", ins: ["T"], out: "R", method: "R apply(T t)", example: "Function<String, Integer> len = String::length;", variants: "IntFunction<R>, ToIntFunction<T>, IntToLongFunction, BiFunction<T, U, R>, ..." },
  { name: "Predicate<T>", ins: ["T"], out: "boolean", method: "boolean test(T t)", example: "Predicate<String> blank = String::isBlank;", variants: "IntPredicate, LongPredicate, DoublePredicate, BiPredicate<T, U>" },
  { name: "UnaryOperator<T>", ins: ["T"], out: "T", method: "T apply(T t)", example: "UnaryOperator<String> trim = String::strip;", variants: "IntUnaryOperator, LongUnaryOperator, DoubleUnaryOperator" },
  { name: "BinaryOperator<T>", ins: ["T", "T"], out: "T", method: "T apply(T a, T b)", example: "BinaryOperator<Integer> add = Integer::sum;", variants: "IntBinaryOperator, LongBinaryOperator, DoubleBinaryOperator" },
];

function Mini({ s, on }: { s: Shape; on: boolean }) {
  const chip = (t: string, i: number) => (
    <span
      key={i}
      className="rounded-sm px-1.5 text-11 leading-[20px]"
      style={{
        color: t === "void" ? "var(--faint)" : "var(--hi)",
        boxShadow: `inset 0 0 0 1px ${on ? "var(--mute)" : "var(--line-2)"}`,
      }}
    >
      {t}
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-faint">
      {s.ins.length ? s.ins.map(chip) : <span className="text-11">()</span>}
      <span aria-hidden>→</span>
      {chip(s.out, 9)}
    </span>
  );
}

export function FnShapes() {
  const [i, setI] = useState(2);
  const s = SHAPES[i];
  return (
    <div className="@container grid gap-4">
      <div className="grid gap-2 @[520px]:grid-cols-2 @[760px]:grid-cols-3" role="group" aria-label="functional interfaces">
        {SHAPES.map((x, j) => (
          <button
            key={x.name}
            onClick={() => setI(j)}
            aria-pressed={i === j}
            className="flex flex-col items-start gap-2 rounded-md bg-bg px-3.5 py-3 text-left transition-[box-shadow] duration-150"
            style={{ boxShadow: `inset 0 0 0 1px ${i === j ? "var(--hi)" : "var(--line-2)"}` }}
          >
            <span className="text-13 text-hi">{x.name}</span>
            <Mini s={x} on={i === j} />
          </button>
        ))}
      </div>
      <div className="grid gap-1 rounded-md bg-bg px-4 py-3 text-12 leading-[1.9] shadow-[inset_0_0_0_1px_var(--line-2)]" aria-live="polite">
        <div className="overflow-x-auto whitespace-nowrap">
          <span className="text-faint">method&nbsp;&nbsp; </span>
          <Java code={s.method} />
        </div>
        <div className="overflow-x-auto whitespace-nowrap">
          <span className="text-faint">example&nbsp; </span>
          <Java code={s.example} />
        </div>
        <div className="overflow-x-auto whitespace-nowrap">
          <span className="text-faint">variants </span>
          <span className="text-ink">{s.variants}</span>
        </div>
      </div>
      <Narration>
        six shapes, 43 interfaces. reach for these before writing your own, and prefer the primitive variants
        (IntPredicate over Predicate&lt;Integer&gt;) to skip boxing.
      </Narration>
    </div>
  );
}
