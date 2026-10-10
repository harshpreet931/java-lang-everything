/**
 * the trace format: one snapshot of a running java program per step.
 *
 * produced two ways:
 *   1. by hand, inside an mdx file, for small conceptual figures
 *   2. by tools/tracer (a JDI debugger that actually runs the program), committed as json
 *
 * both feed <MemoryStepper>, which draws the code, the stack and the heap.
 */

/** a value in a slot (local, field, array element). */
export type Value =
  | number // int, long, double... printed as-is
  | boolean
  | string // a pre-formatted primitive like "'a'" (char) or "3.0f". NOT a java String (those live on the heap)
  | null // the null reference
  | { ref: string }; // points at a heap object by id

export type Frame = {
  /** what to print on the frame header, e.g. "main" or "Point.<init>" or "fib(3)" */
  name: string;
  /** line this frame is currently on (1-based). optional for hand-written traces */
  line?: number;
  /** ordered: insertion order is display order */
  locals: Record<string, Value>;
};

export type HeapObject = {
  /** the static type to print, e.g. "Point", "int[]", "String", "ArrayList<String>" */
  type: string;
  /** user object fields, in declaration order */
  fields?: Record<string, Value>;
  /** arrays (and summarized lists): element values */
  items?: Value[];
  /** summarized maps: key/value pairs */
  entries?: [Value, Value][];
  /** strings and boxed primitives: the printable value, e.g. "\"hi\"" or "42" */
  value?: string;
  /** true when the tracer collapsed a JDK type (ArrayList, HashMap...) into items/entries */
  summary?: boolean;
  /** optional tag shown under the object, e.g. "string pool" or "garbage" */
  tag?: string;
  /** visual state override: "dead" = unreachable / garbage (red), "new" = just allocated (hot) */
  state?: "dead" | "new";
};

export type Step = {
  /** the line that is ABOUT to run (1-based, in Trace.source) */
  line: number;
  /** bottom of the stack first (main is frames[0]). CodeStepper ignores it: pass [] */
  frames: Frame[];
  /** heap objects by id. ids are stable across steps so the diagram can animate. CodeStepper: pass {} */
  heap: Record<string, HeapObject>;
  /** everything printed to stdout up to and including this step */
  stdout?: string;
  /** a short lowercase narration for this step, shown under the figure */
  note?: string;
  /** optional: highlight these local/field names as "just changed" */
  changed?: string[];
};

export type Trace = {
  /** file tab name, e.g. "Main.java" */
  file: string;
  /** full java source the line numbers refer to */
  source: string;
  steps: Step[];
};

export const isRef = (v: Value): v is { ref: string } =>
  typeof v === "object" && v !== null && "ref" in v;
