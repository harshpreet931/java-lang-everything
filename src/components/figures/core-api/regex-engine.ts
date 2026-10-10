// a tiny backtracking regex engine that writes down every step it takes.
// same algorithm family as java.util.regex (depth-first, try the greedy choice first,
// back up on failure), minus java's optimizations, so the step counts show the raw shape.
// supports: literals, ., \d, \w, \s, escapes, ( ), (?: ), |, * + ? {m,n}, and lazy *? +? ??.

export type Node =
  | { t: "char"; c: string; s: number; e: number }
  | { t: "any"; s: number; e: number }
  | { t: "cls"; k: "d" | "w" | "s"; s: number; e: number }
  | { t: "seq"; items: Node[]; s: number; e: number }
  | { t: "alt"; alts: Node[]; s: number; e: number }
  | { t: "group"; body: Node; s: number; e: number }
  | { t: "rep"; body: Node; min: number; max: number; lazy: boolean; s: number; e: number };

export type Step = {
  kind: "start" | "ok" | "fail" | "back" | "done" | "nomatch";
  /** pattern range [s, e) being worked on */
  s: number;
  e: number;
  /** input position */
  at: number;
  /** where this attempt started in the input */
  from: number;
};

export function parse(src: string): Node {
  let i = 0;
  const alt = (): Node => {
    const start = i;
    const alts: Node[] = [seq()];
    while (src[i] === "|") {
      i++;
      alts.push(seq());
    }
    return alts.length === 1 ? alts[0] : { t: "alt", alts, s: start, e: i };
  };
  const seq = (): Node => {
    const start = i;
    const items: Node[] = [];
    while (i < src.length && src[i] !== "|" && src[i] !== ")") items.push(quant(atom()));
    return { t: "seq", items, s: start, e: i };
  };
  const atom = (): Node => {
    const s = i;
    const ch = src[i++];
    if (ch === "(") {
      if (src.startsWith("?:", i)) i += 2;
      const body = alt();
      if (src[i] !== ")") throw new Error("unclosed group");
      i++;
      return { t: "group", body, s, e: i };
    }
    if (ch === ".") return { t: "any", s, e: i };
    if (ch === "\\") {
      const n = src[i++];
      if (n === "d" || n === "w" || n === "s") return { t: "cls", k: n, s, e: i };
      return { t: "char", c: n, s, e: i };
    }
    return { t: "char", c: ch, s, e: i };
  };
  const quant = (n: Node): Node => {
    const s = n.s;
    let min = -1;
    let max = -1;
    const q = src[i];
    if (q === "*") (min = 0), (max = Infinity), i++;
    else if (q === "+") (min = 1), (max = Infinity), i++;
    else if (q === "?") (min = 0), (max = 1), i++;
    else if (q === "{") {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i));
      if (!m) return n;
      min = Number(m[1]);
      max = m[2] ? (m[3] ? Number(m[3]) : Infinity) : min;
      i += m[0].length;
    } else return n;
    let lazy = false;
    if (src[i] === "?") (lazy = true), i++;
    return { t: "rep", body: n, min, max, lazy, s, e: i };
  };
  const root = alt();
  if (i !== src.length) throw new Error("unexpected )");
  return root;
}

const test = (k: "d" | "w" | "s", c: string) => (k === "d" ? /\d/.test(c) : k === "w" ? /\w/.test(c) : /\s/.test(c));

/**
 * find() semantics: try every start position, leftmost match wins.
 * `limit` caps the number of recorded steps (counting continues up to `countLimit`).
 */
export function run(pattern: string, input: string, limit = 5000, countLimit = 3_000_000) {
  const root = parse(pattern);
  const steps: Step[] = [];
  let count = 0;
  let from = 0;
  let stopped = false;
  const rec = (st: Omit<Step, "from">) => {
    count++;
    if (count > countLimit) {
      stopped = true;
      throw new Error("budget");
    }
    if (steps.length < limit) steps.push({ ...st, from });
  };

  const m = (n: Node, i: number, k: (j: number) => boolean): boolean => {
    switch (n.t) {
      case "char":
      case "any":
      case "cls": {
        const c = input[i];
        const ok = i < input.length && (n.t === "any" ? c !== "\n" : n.t === "char" ? c === n.c : test(n.k, c));
        rec({ kind: ok ? "ok" : "fail", s: n.s, e: n.e, at: i });
        return ok ? k(i + 1) : false;
      }
      case "seq": {
        const go = (idx: number, j: number): boolean => (idx === n.items.length ? k(j) : m(n.items[idx], j, (x) => go(idx + 1, x)));
        return go(0, i);
      }
      case "alt": {
        for (let a = 0; a < n.alts.length; a++) {
          if (a > 0) rec({ kind: "back", s: n.alts[a].s, e: n.alts[a].e, at: i });
          if (m(n.alts[a], i, k)) return true;
        }
        return false;
      }
      case "group":
        return m(n.body, i, k);
      case "rep": {
        const loop = (cnt: number, j: number): boolean => {
          const more = () =>
            cnt < n.max &&
            m(n.body, j, (x) => {
              if (x === j) return false; // an empty iteration would loop forever
              return loop(cnt + 1, x);
            });
          if (n.lazy) {
            if (cnt >= n.min && k(j)) return true;
            if (cnt >= n.min) rec({ kind: "back", s: n.s, e: n.e, at: j });
            return more();
          }
          if (more()) return true;
          if (cnt >= n.min) {
            if (cnt < n.max) rec({ kind: "back", s: n.s, e: n.e, at: j });
            return k(j);
          }
          return false;
        };
        return loop(0, i);
      }
    }
  };

  let match: [number, number] | null = null;
  try {
    for (from = 0; from <= input.length; from++) {
      rec({ kind: "start", s: 0, e: 0, at: from });
      let end = -1;
      const ok = m(root, from, (j) => {
        end = j;
        return true;
      });
      if (ok) {
        match = [from, end];
        rec({ kind: "done", s: 0, e: pattern.length, at: end });
        break;
      }
    }
    if (!match) rec({ kind: "nomatch", s: 0, e: 0, at: input.length });
  } catch {
    // budget exceeded
  }
  return { steps, count, match, stopped };
}
