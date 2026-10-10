"use client";

import { useState } from "react";
import { Java, Row, Words, ring } from "./kit";

// the java.util.function zoo, drawn as shapes: what goes in, what comes out.
// signatures and default methods read off the real interfaces with reflection on jdk 25.
// "used by" examples are real parameter types in the JDK api.

type Out = "void" | "value" | "boolean" | "same";
type Card = {
  name: string;
  pkg?: string;
  ins: string[];
  out: Out;
  outLabel?: string;
  sig: string;
  ex: string;
  used: string;
  combine?: string;
  note?: string;
};

const CARDS: Card[] = [
  { name: "Supplier<T>", ins: [], out: "value", outLabel: "T", sig: "T get()", ex: "Supplier<List<String>> fresh = () -> new ArrayList<>();", used: "Optional.orElseGet, Stream.generate, ThreadLocal.withInitial", note: "makes something from nothing. lazy values, factories." },
  { name: "Consumer<T>", ins: ["T"], out: "void", sig: "void accept(T t)", ex: "Consumer<String> log = s -> IO.println(s);", used: "Iterable.forEach, Optional.ifPresent", combine: "andThen", note: "eats a value, returns nothing. exists for its side effect." },
  { name: "Function<T, R>", ins: ["T"], out: "value", outLabel: "R", sig: "R apply(T t)", ex: "Function<String, Integer> len = s -> s.length();", used: "Stream.map, Optional.map, Map.computeIfAbsent", combine: "andThen, compose, identity", note: "the general case: one thing in, another thing out." },
  { name: "Predicate<T>", ins: ["T"], out: "boolean", sig: "boolean test(T t)", ex: "Predicate<String> blank = s -> s.isBlank();", used: "Stream.filter, Collection.removeIf, Optional.filter", combine: "and, or, negate, not, isEqual", note: "a yes/no question about a value." },
  { name: "UnaryOperator<T>", ins: ["T"], out: "same", outLabel: "T", sig: "T apply(T t)", ex: "UnaryOperator<String> up = s -> s.toUpperCase();", used: "List.replaceAll, Stream.iterate", combine: "identity", note: "a Function<T, T>. it literally extends Function." },
  { name: "BiConsumer<T, U>", ins: ["T", "U"], out: "void", sig: "void accept(T t, U u)", ex: 'BiConsumer<String, Integer> show = (k, v) -> IO.println(k + "=" + v);', used: "Map.forEach", combine: "andThen" },
  { name: "BiFunction<T, U, R>", ins: ["T", "U"], out: "value", outLabel: "R", sig: "R apply(T t, U u)", ex: "BiFunction<String, Integer, String> rep = (s, n) -> s.repeat(n);", used: "Map.compute, Map.merge, Map.replaceAll", combine: "andThen" },
  { name: "BinaryOperator<T>", ins: ["T", "T"], out: "same", outLabel: "T", sig: "T apply(T t, T u)", ex: "BinaryOperator<Integer> add = (a, b) -> a + b;", used: "Stream.reduce, Collectors.toMap (the merge function)", combine: "minBy, maxBy", note: "a BiFunction<T, T, T>. two of a kind in, one out: reduction." },
  { name: "BiPredicate<T, U>", ins: ["T", "U"], out: "boolean", sig: "boolean test(T t, U u)", ex: "BiPredicate<String, Integer> hasLen = (s, n) -> s.length() == n;", used: "Files.find", combine: "and, or, negate" },
  { name: "Runnable", pkg: "java.lang", ins: [], out: "void", sig: "void run()", ex: 'Runnable tick = () -> IO.println("tick");', used: "new Thread(...), Executor.execute", note: "older than java.util.function, and still the one for \"just do this\"." },
  { name: "Callable<V>", pkg: "java.util.concurrent", ins: [], out: "value", outLabel: "V", sig: "V call() throws Exception", ex: "Callable<String> read = () -> Files.readString(path);", used: "ExecutorService.submit, invokeAll", note: "a Supplier that's allowed to throw checked exceptions." },
  { name: "Comparator<T>", pkg: "java.util", ins: ["T", "T"], out: "value", outLabel: "int", sig: "int compare(T a, T b)", ex: "Comparator<String> byLen = (a, b) -> Integer.compare(a.length(), b.length());", used: "List.sort, TreeMap, Stream.sorted", combine: "reversed, thenComparing, comparing", note: "a functional interface too: equals() doesn't count, it's from Object." },
];

const IN_OPTS = [
  { v: -1, label: "any" },
  { v: 0, label: "nothing" },
  { v: 1, label: "one" },
  { v: 2, label: "two" },
] as const;
const OUT_OPTS = [
  { v: "any", label: "any" },
  { v: "void", label: "nothing" },
  { v: "value", label: "a value" },
  { v: "boolean", label: "boolean" },
] as const;

function Glyph({ ins, out, outLabel, on }: { ins: string[]; out: Out; outLabel?: string; on: boolean }) {
  const stroke = on ? "var(--hi)" : "var(--mute)";
  const text = on ? "var(--hi)" : "var(--ink)";
  const w = 128;
  const inX = ins.length === 0 ? [] : ins.length === 1 ? [18] : [12, 34];
  return (
    <svg viewBox={`0 0 ${w} 34`} className="block h-[30px] w-[114px]" aria-hidden>
      {ins.length === 0 && <circle cx={18} cy={17} r={10} fill="none" stroke="var(--line-2)" strokeDasharray="2 3" />}
      {inX.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={17} r={10} fill="var(--well)" stroke={stroke} />
          <text fontFamily="var(--font-code)" x={x} y={21} fontSize={11} textAnchor="middle" fill={text}>
            {ins[i]}
          </text>
        </g>
      ))}
      <line x1={50} y1={17} x2={78} y2={17} stroke="var(--line-2)" />
      <path d="M78 13 L84 17 L78 21 z" fill="var(--line-2)" />
      {out === "void" && <rect x={94} y={7} width={20} height={20} rx={2} fill="none" stroke="var(--line-2)" strokeDasharray="2 3" />}
      {(out === "value" || out === "same") && (
        <g>
          {out === "same" ? (
            <circle cx={104} cy={17} r={10} fill="var(--well)" stroke={stroke} />
          ) : (
            <rect x={92} y={6} width={outLabel && outLabel.length > 1 ? 30 : 22} height={22} rx={2} fill="var(--well)" stroke={stroke} />
          )}
          <text fontFamily="var(--font-code)" x={out === "same" ? 104 : outLabel && outLabel.length > 1 ? 107 : 103} y={21} fontSize={11} textAnchor="middle" fill={text}>
            {outLabel}
          </text>
        </g>
      )}
      {out === "boolean" && (
        <g>
          <path d="M104 4 L117 17 L104 30 L91 17 z" fill="var(--well)" stroke={stroke} />
          <text fontFamily="var(--font-code)" x={104} y={21} fontSize={11} textAnchor="middle" fill={text}>
            ?
          </text>
        </g>
      )}
    </svg>
  );
}

export function ShapeCatalog() {
  const [inN, setIn] = useState<number>(-1);
  const [out, setOut] = useState<string>("any");
  const [sel, setSel] = useState("Function<T, R>");
  const match = (c: Card) =>
    (inN === -1 || c.ins.length === inN) && (out === "any" || (out === "value" ? c.out === "value" || c.out === "same" : c.out === out));
  const card = CARDS.find((c) => c.name === sel)!;
  const refilter = (n: number, o: string) => {
    setIn(n);
    setOut(o);
    const ok = (c: Card) =>
      (n === -1 || c.ins.length === n) && (o === "any" || (o === "value" ? c.out === "value" || c.out === "same" : c.out === o));
    if (!ok(card)) {
      const first = CARDS.find(ok);
      if (first) setSel(first.name);
    }
  };

  return (
    <div className="@container grid gap-5">
      <div>
        <Row k="takes =">
          <Words options={IN_OPTS} value={inN} onChange={(n) => refilter(n, out)} label="number of inputs" />
        </Row>
        <Row k="returns =" last>
          <Words options={OUT_OPTS} value={out} onChange={(o) => refilter(inN, o)} label="what it returns" />
        </Row>
      </div>

      <div className="grid grid-cols-1 gap-1.5 @[460px]:grid-cols-2 @[880px]:grid-cols-3">
        {CARDS.map((c) => {
          const m = match(c);
          const on = sel === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setSel(c.name)}
              aria-pressed={on}
              className="flex items-center justify-between gap-3 rounded-md bg-well px-3 py-2 text-left transition-[box-shadow,opacity] duration-200 ease-jle"
              style={{ boxShadow: on ? ring("hi") : ring(m && (inN !== -1 || out !== "any") ? "ink" : null, 100), opacity: m ? 1 : 0.28 }}
            >
              <span className="min-w-0">
                <span className={`block truncate text-12 ${on ? "text-hi" : "text-ink"}`}>{c.name}</span>
                <span className="block truncate text-11 text-faint">{c.pkg ?? "java.util.function"}</span>
              </span>
              <Glyph ins={c.ins} out={c.out} outLabel={c.outLabel} on={on} />
            </button>
          );
        })}
      </div>

      <div className="grid gap-x-6 gap-y-2 border-t border-line pt-4 text-12 @[560px]:grid-cols-[11ch_minmax(0,1fr)]" aria-live="polite">
        <span className="text-faint">method</span>
        <span className="min-w-0 overflow-x-auto whitespace-pre text-13">
          <Java code={card.sig} />
        </span>
        <span className="text-faint">example</span>
        <span className="min-w-0 overflow-x-auto whitespace-pre text-13">
          <Java code={card.ex} />
        </span>
        <span className="text-faint">the JDK uses it in</span>
        <span className="text-ink">{card.used}</span>
        {card.combine && (
          <>
            <span className="text-faint">defaults</span>
            <span className="text-ink">{card.combine}</span>
          </>
        )}
        {card.note && (
          <>
            <span className="text-faint">note</span>
            <span className="font-serif text-16 leading-[1.5] text-ink">{card.note}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- the 43, as a grid ---------------------------------------------------------- */

// rows: what goes in. columns: what comes out. every name in java.util.function, once.
const COLS = ["nothing", "boolean", "int", "long", "double", "an object"] as const;
type Cell = string | null;
const GRID: { in: string; cells: Cell[]; alt?: string }[] = [
  { in: "()", cells: [null, "BooleanSupplier", "IntSupplier", "LongSupplier", "DoubleSupplier", "Supplier<T>"] },
  { in: "T", cells: ["Consumer<T>", "Predicate<T>", "ToIntFunction<T>", "ToLongFunction<T>", "ToDoubleFunction<T>", "Function<T, R>"], alt: "UnaryOperator<T>" },
  { in: "T, U", cells: ["BiConsumer<T, U>", "BiPredicate<T, U>", "ToIntBiFunction<T, U>", "ToLongBiFunction<T, U>", "ToDoubleBiFunction<T, U>", "BiFunction<T, U, R>"], alt: "BinaryOperator<T>" },
  { in: "int", cells: ["IntConsumer", "IntPredicate", "IntUnaryOperator", "IntToLongFunction", "IntToDoubleFunction", "IntFunction<R>"] },
  { in: "long", cells: ["LongConsumer", "LongPredicate", "LongToIntFunction", "LongUnaryOperator", "LongToDoubleFunction", "LongFunction<R>"] },
  { in: "double", cells: ["DoubleConsumer", "DoublePredicate", "DoubleToIntFunction", "DoubleToLongFunction", "DoubleUnaryOperator", "DoubleFunction<R>"] },
  { in: "int, int", cells: [null, null, "IntBinaryOperator", null, null, null] },
  { in: "long, long", cells: [null, null, null, "LongBinaryOperator", null, null] },
  { in: "double, double", cells: [null, null, null, null, "DoubleBinaryOperator", null] },
  { in: "T, int", cells: ["ObjIntConsumer<T>", null, null, null, null, null] },
  { in: "T, long", cells: ["ObjLongConsumer<T>", null, null, null, null, null] },
  { in: "T, double", cells: ["ObjDoubleConsumer<T>", null, null, null, null, null] },
];

// the single abstract method of each, as reflection reports it
const SAM: Record<string, string> = {
  BooleanSupplier: "boolean getAsBoolean()", IntSupplier: "int getAsInt()", LongSupplier: "long getAsLong()", DoubleSupplier: "double getAsDouble()", "Supplier<T>": "T get()",
  "Consumer<T>": "void accept(T t)", "Predicate<T>": "boolean test(T t)", "ToIntFunction<T>": "int applyAsInt(T value)", "ToLongFunction<T>": "long applyAsLong(T value)", "ToDoubleFunction<T>": "double applyAsDouble(T value)", "Function<T, R>": "R apply(T t)", "UnaryOperator<T>": "T apply(T t)",
  "BiConsumer<T, U>": "void accept(T t, U u)", "BiPredicate<T, U>": "boolean test(T t, U u)", "ToIntBiFunction<T, U>": "int applyAsInt(T t, U u)", "ToLongBiFunction<T, U>": "long applyAsLong(T t, U u)", "ToDoubleBiFunction<T, U>": "double applyAsDouble(T t, U u)", "BiFunction<T, U, R>": "R apply(T t, U u)", "BinaryOperator<T>": "T apply(T t, T u)",
  IntConsumer: "void accept(int value)", IntPredicate: "boolean test(int value)", IntUnaryOperator: "int applyAsInt(int operand)", IntToLongFunction: "long applyAsLong(int value)", IntToDoubleFunction: "double applyAsDouble(int value)", "IntFunction<R>": "R apply(int value)",
  LongConsumer: "void accept(long value)", LongPredicate: "boolean test(long value)", LongToIntFunction: "int applyAsInt(long value)", LongUnaryOperator: "long applyAsLong(long operand)", LongToDoubleFunction: "double applyAsDouble(long value)", "LongFunction<R>": "R apply(long value)",
  DoubleConsumer: "void accept(double value)", DoublePredicate: "boolean test(double value)", DoubleToIntFunction: "int applyAsInt(double value)", DoubleToLongFunction: "long applyAsLong(double value)", DoubleUnaryOperator: "double applyAsDouble(double operand)", "DoubleFunction<R>": "R apply(double value)",
  IntBinaryOperator: "int applyAsInt(int left, int right)", LongBinaryOperator: "long applyAsLong(long left, long right)", DoubleBinaryOperator: "double applyAsDouble(double left, double right)",
  "ObjIntConsumer<T>": "void accept(T t, int value)", "ObjLongConsumer<T>": "void accept(T t, long value)", "ObjDoubleConsumer<T>": "void accept(T t, double value)",
};

const short = (n: string) =>
  n
    .replace(/<.*>/, "")
    .split(/(?=[A-Z])/)
    .flatMap((p, i) => (i ? [<wbr key={i} />, p] : [p]));

export function FunctionGrid() {
  const [sel, setSel] = useState<string>("ToIntFunction<T>");
  const total = GRID.reduce((a, r) => a + r.cells.filter(Boolean).length + (r.alt ? 1 : 0), 0);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[620px] table-fixed border-collapse text-11">
          <thead>
            <tr>
              <th className="w-[12ch] px-1.5 py-2 text-left font-normal text-faint">in ↓ out →</th>
              {COLS.map((c) => (
                <th key={c} className="px-1.5 py-2 text-left font-normal text-faint">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID.map((r) => (
              <tr key={r.in} className="border-t border-line">
                <td className="px-1.5 py-1 align-top text-mute tabular">{r.in === "()" ? "()" : `(${r.in})`}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-0.5 py-0.5 align-top">
                    {c ? (
                      <div className="flex flex-col gap-0.5">
                        {[c, ...(i === 5 && r.alt ? [r.alt] : [])].map((n) => (
                          <button
                            key={n}
                            onClick={() => setSel(n)}
                            aria-pressed={sel === n}
                            className={`w-full rounded-sm px-1.5 py-1 text-left leading-[1.45] transition-colors duration-150 ${
                              sel === n ? "bg-well-2 text-hi shadow-[inset_0_0_0_1px_var(--line-2)]" : "text-ink hover:text-hi hover:shadow-[inset_0_0_0_1px_var(--line-2)]"
                            }`}
                          >
                            {short(n)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="block px-1.5 py-1 text-faint/60">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line pt-3.5 text-13" aria-live="polite">
        <span className="min-w-0 overflow-x-auto whitespace-pre">
          <Java code={`interface ${sel} { ${SAM[sel]}; }`} />
        </span>
        <span className="text-11 text-faint tabular">{total} interfaces. the dots don&apos;t exist.</span>
      </div>
    </div>
  );
}
