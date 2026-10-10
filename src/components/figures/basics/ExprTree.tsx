"use client";

import { useMemo, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { javaDouble } from "@/components/figures/basics/kit";

// type a small java expression, see the tree precedence builds, step through evaluation.
// a tiny subset of java with java's semantics: int (32-bit, wraps, truncating division,
// ArithmeticException on / 0), double, boolean, String concatenation, short-circuit && and ||,
// left-to-right operand evaluation. doubles print the way Double.toString does.

type Ty = "int" | "double" | "boolean" | "String";
type Val = { ty: Ty; v: number | boolean | string };
type Node = {
  id: number;
  kind: "lit" | "bin" | "un";
  op?: string;
  lit?: Val;
  kids: Node[];
  paren?: boolean;
  ty?: Ty;
};

/* ---- lexer + pratt parser -------------------------------------------------------- */

const TOK = /\s*(?:(\d+\.\d+|\d+)|("[^"]*")|(true|false)|(&&|\|\||<=|>=|==|!=|[-+*/%<>!()]))/y;

const BIN: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };

function lex(src: string) {
  const out: string[] = [];
  TOK.lastIndex = 0;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    TOK.lastIndex = i;
    const m = TOK.exec(src);
    if (!m) throw new Error(`can't read "${src.slice(i).trim().slice(0, 12)}"`);
    out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
    i = TOK.lastIndex;
  }
  return out;
}

export function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  let id = 0;
  const peek = () => toks[p];
  const expr = (minBp: number): Node => {
    let left = prefix();
    while (p < toks.length && BIN[peek()] !== undefined && BIN[peek()] >= minBp) {
      const op = toks[p++];
      const right = expr(BIN[op] + 1); // all left-associative
      left = { id: id++, kind: "bin", op, kids: [left, right] };
    }
    return left;
  };
  const prefix = (): Node => {
    const t = toks[p++];
    if (t === undefined) throw new Error("expression ends too early");
    if (t === "(") {
      const e = expr(0);
      if (toks[p++] !== ")") throw new Error("')' expected");
      return { ...e, paren: true };
    }
    if (t === "-" || t === "!") return { id: id++, kind: "un", op: t, kids: [prefix()] };
    if (/^\d+\.\d+$/.test(t)) return { id: id++, kind: "lit", lit: { ty: "double", v: Number(t) }, kids: [] };
    if (/^\d+$/.test(t)) {
      if (Number(t) > 2147483647) throw new Error("integer number too large");
      return { id: id++, kind: "lit", lit: { ty: "int", v: Number(t) }, kids: [] };
    }
    if (t.startsWith('"')) return { id: id++, kind: "lit", lit: { ty: "String", v: t.slice(1, -1) }, kids: [] };
    if (t === "true" || t === "false") return { id: id++, kind: "lit", lit: { ty: "boolean", v: t === "true" }, kids: [] };
    throw new Error(`unexpected '${t}'`);
  };
  const root = expr(0);
  if (p < toks.length) throw new Error(`unexpected '${toks[p]}'`);
  return root;
}

/* ---- types (what javac would check) ----------------------------------------------- */

const num = (t: Ty) => t === "int" || t === "double";

export function check(n: Node): Ty {
  if (n.kind === "lit") return (n.ty = n.lit!.ty);
  const ts = n.kids.map(check);
  const op = n.op!;
  const bad = () => {
    throw new Error(`bad operand types for ${n.kind === "un" ? "unary" : "binary"} operator '${op}'`);
  };
  let t: Ty;
  if (n.kind === "un") t = op === "!" ? (ts[0] === "boolean" ? "boolean" : bad()) : num(ts[0]) ? ts[0] : bad();
  else {
    const [a, b] = ts;
    if (op === "+" && (a === "String" || b === "String")) t = "String";
    else if ("+-*/%".includes(op)) t = num(a) && num(b) ? (a === "double" || b === "double" ? "double" : "int") : bad();
    else if (["<", "<=", ">", ">="].includes(op)) t = num(a) && num(b) ? "boolean" : bad();
    else if (op === "==" || op === "!=") {
      if (a === "String" || b === "String") throw new Error("comparing Strings with == compares references. use .equals()");
      t = (num(a) && num(b)) || (a === "boolean" && b === "boolean") ? "boolean" : bad();
    } else t = a === "boolean" && b === "boolean" ? "boolean" : bad(); // && ||
  }
  return (n.ty = t);
}

/* ---- evaluation, one operator per step --------------------------------------------- */

const show = (v: Val) =>
  v.ty === "String" ? `"${v.v}"` : v.ty === "double" ? javaDouble(v.v as number) : String(v.v);
const str = (v: Val) => (v.ty === "String" ? (v.v as string) : v.ty === "double" ? javaDouble(v.v as number) : String(v.v));

type Ev = { id: number; val?: Val; err?: string; skipped?: number[]; note: string };

export function evaluate(root: Node): Ev[] {
  const steps: Ev[] = [];
  const subtree = (n: Node): number[] => [n.id, ...n.kids.flatMap(subtree)];
  const ev = (n: Node): Val => {
    if (n.kind === "lit") return n.lit!;
    const op = n.op!;
    if (n.kind === "un") {
      const a = ev(n.kids[0]);
      const val: Val =
        op === "!" ? { ty: "boolean", v: !a.v } : a.ty === "int" ? { ty: "int", v: -(a.v as number) | 0 } : { ty: "double", v: -(a.v as number) };
      steps.push({ id: n.id, val, note: `${op}${show(a)} is ${show(val)}.` });
      return val;
    }
    const a = ev(n.kids[0]);
    if ((op === "&&" && a.v === false) || (op === "||" && a.v === true)) {
      const val: Val = { ty: "boolean", v: a.v };
      steps.push({
        id: n.id,
        val,
        skipped: subtree(n.kids[1]),
        note: `the left side is already ${a.v}, so ${op} is ${a.v} no matter what. the right side is never evaluated.`,
      });
      return val;
    }
    const b = ev(n.kids[1]);
    let val: Val;
    let note = "";
    if (n.ty === "String") {
      val = { ty: "String", v: str(a) + str(b) };
      note = `one side is a String, so + means "glue together": ${show(a)} + ${show(b)} → ${show(val)}.`;
    } else if (n.ty === "boolean") {
      const x = a.v as number,
        y = b.v as number;
      const r =
        op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : op === ">=" ? x >= y : op === "==" ? a.v === b.v : op === "!=" ? a.v !== b.v : op === "&&" ? (a.v as boolean) && (b.v as boolean) : (a.v as boolean) || (b.v as boolean);
      val = { ty: "boolean", v: r };
      note = `${show(a)} ${op} ${show(b)} is ${r}.`;
    } else if (n.ty === "int") {
      const x = a.v as number,
        y = b.v as number;
      if ((op === "/" || op === "%") && y === 0) {
        steps.push({ id: n.id, err: "ArithmeticException: / by zero", note: `int division by zero. no Infinity for ints: java throws.` });
        throw new Error("thrown");
      }
      const r = op === "+" ? (x + y) | 0 : op === "-" ? (x - y) | 0 : op === "*" ? Math.imul(x, y) : op === "/" ? Math.trunc(x / y) | 0 : (x % y) | 0;
      val = { ty: "int", v: r };
      note =
        op === "/" && x % y !== 0
          ? `both are ints, so this is int division: ${x} / ${y} is ${r}, the fraction is thrown away (rounded toward zero).`
          : op === "%"
            ? `remainder: ${x} % ${y} is ${r}. the result takes the sign of the left side.`
            : r !== (op === "+" ? x + y : op === "-" ? x - y : x * y)
              ? `${x} ${op} ${y} doesn't fit in 32 bits, so it wraps around: ${r}.`
              : `${x} ${op} ${y} is ${r}.`;
    } else {
      const x = a.v as number,
        y = b.v as number;
      const r = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : op === "/" ? x / y : x % y;
      val = { ty: "double", v: r };
      note =
        a.ty !== b.ty
          ? `an int meets a double, so the int is widened first: ${show(a.ty === "int" ? { ty: "double", v: x } : a)} ${op} ${show(b.ty === "int" ? { ty: "double", v: y } : b)} is ${show(val)}.`
          : `${show(a)} ${op} ${show(b)} is ${show(val)}.`;
    }
    steps.push({ id: n.id, val, note });
    return val;
  };
  try {
    ev(root);
  } catch {
    /* the step that threw is already recorded */
  }
  return steps;
}

/* ---- layout ------------------------------------------------------------------- */

type Placed = { n: Node; x: number; y: number; w: number };

function layout(root: Node) {
  const out: Placed[] = [];
  let cursor = 0;
  const label = (n: Node) => (n.kind === "lit" ? show(n.lit!) : n.op!);
  const place = (n: Node, depth: number): number => {
    const w = Math.max(30, label(n).length * 7.4 + 18);
    let x: number;
    if (n.kids.length === 0) {
      x = cursor + w / 2;
      cursor += w + 14;
    } else {
      const xs = n.kids.map((k) => place(k, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    out.push({ n, x, y: depth * 62 + 22, w });
    return x;
  };
  place(root, 0);
  const width = Math.max(cursor - 14, 60);
  const height = Math.max(...out.map((p) => p.y)) + 44;
  return { nodes: out, width, height, label };
}

/* ---- the figure ------------------------------------------------------------------ */

const PRESETS = ["2 + 3 * 4", "(2 + 3) * 4", "10 - 4 - 3", '1 + 2 + "3" + 4 + 5', "7 / 2 * 2.0", "true || 1 / 0 > 0"];

export function ExprTree() {
  const [src, setSrc] = useState(PRESETS[0]);
  const parsed = useMemo(() => {
    try {
      const root = parse(src);
      const ty = check(root);
      return { root, ty, steps: evaluate(root), err: null as string | null };
    } catch (e) {
      return { root: null, ty: null, steps: [] as Ev[], err: (e as Error).message };
    }
  }, [src]);

  return (
    <div className="font-mono text-13">
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="example expressions">
        {PRESETS.map((p) => (
          <button key={p} className="word !min-h-7 !px-2 !text-12" aria-pressed={src === p} onClick={() => setSrc(p)}>
            {p}
          </button>
        ))}
      </div>
      <label className="flex items-baseline gap-3 border-b border-line pb-2.5">
        <span className="shrink-0 text-faint">expr =</span>
        <input
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
          aria-label="expression"
        />
        {parsed.ty && <span className="shrink-0 text-11 text-faint">type: {parsed.ty}</span>}
      </label>
      {parsed.err || !parsed.root ? (
        <p className="mt-4 text-13 text-dead">
          compile error: {parsed.err} <span className="text-faint">(this little evaluator knows ints, doubles, booleans and strings)</span>
        </p>
      ) : (
        <Evaluation key={src} root={parsed.root} steps={parsed.steps} />
      )}
    </div>
  );
}

function Evaluation({ root, steps }: { root: Node; steps: Ev[] }) {
  // step 0 = the tree, nothing evaluated. step k = first k operators done.
  const s = useStepper(steps.length + 1, { interval: 1300 });
  const { nodes, width, height, label } = useMemo(() => layout(root), [root]);
  const done = new Map<number, Ev>();
  steps.slice(0, s.i).forEach((e) => done.set(e.id, e));
  const skipped = new Set(steps.slice(0, s.i).flatMap((e) => e.skipped ?? []));
  const cur = s.i > 0 ? steps[s.i - 1] : null;
  const byId = new Map(nodes.map((p) => [p.n.id, p]));

  // the expression, rewritten with what's been computed so far
  const render = (n: Node): React.ReactNode => {
    const e = done.get(n.id);
    if (e?.val) {
      return (
        <span key={n.id} className={cur?.id === n.id ? "text-hot" : "text-hi"}>
          {show(e.val)}
        </span>
      );
    }
    if (skipped.has(n.id)) {
      return (
        <span key={n.id} className="text-faint line-through">
          {plain(n)}
        </span>
      );
    }
    if (n.kind === "lit") return <span key={n.id}>{show(n.lit!)}</span>;
    const inner =
      n.kind === "un" ? (
        <>
          {n.op}
          {render(n.kids[0])}
        </>
      ) : (
        <>
          {render(n.kids[0])} <span className={e?.err ? "text-dead" : ""}>{n.op}</span> {render(n.kids[1])}
        </>
      );
    return <span key={n.id}>{n.paren ? <>({inner})</> : inner}</span>;
  };
  const plain = (n: Node): string =>
    n.kind === "lit" ? show(n.lit!) : n.kind === "un" ? n.op + plain(n.kids[0]) : `${n.paren ? "(" : ""}${plain(n.kids[0])} ${n.op} ${plain(n.kids[1])}${n.paren ? ")" : ""}`;

  return (
    <div {...s.keys} className="mt-4 outline-none">
      <div className="overflow-x-auto">
        <svg fontFamily="var(--font-code), monospace"
          viewBox={`-10 0 ${width + 20} ${height}`}
          width="100%"
          style={{ maxWidth: width + 20, minWidth: Math.min(width + 20, 300) }}
          className="mx-auto block"
          role="img"
          aria-label={`expression tree for ${plain(root)}`}
        >
          {nodes.map((p) =>
            p.n.kids.map((k) => {
              const c = byId.get(k.id)!;
              const sk = skipped.has(k.id);
              return (
                <line
                  key={`${p.n.id}-${k.id}`}
                  x1={p.x}
                  y1={p.y + 13}
                  x2={c.x}
                  y2={c.y - 13}
                  stroke="var(--line-2)"
                  strokeDasharray={sk ? "3 3" : undefined}
                />
              );
            }),
          )}
          {nodes.map((p) => {
            const e = done.get(p.n.id);
            const isCur = cur?.id === p.n.id;
            const sk = skipped.has(p.n.id);
            const err = isCur && cur?.err;
            const stroke = err ? "var(--dead)" : isCur ? "var(--hot)" : p.n.kind === "lit" ? "var(--line)" : "var(--line-2)";
            return (
              <g key={p.n.id} opacity={sk ? 0.35 : 1} className="transition-opacity duration-200">
                <rect
                  x={p.x - p.w / 2}
                  y={p.y - 13}
                  width={p.w}
                  height={26}
                  rx={2}
                  fill="var(--well)"
                  stroke={stroke}
                  strokeDasharray={sk ? "3 3" : undefined}
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill={p.n.kind === "lit" ? "var(--ink)" : isCur ? "var(--hot)" : "var(--hi)"}
                >
                  {label(p.n)}
                </text>
                {e?.val && (
                  <>
                    <rect
                      x={p.x - (show(e.val).length + 2) * 3.4 - 4}
                      y={p.y + 17}
                      width={(show(e.val).length + 2) * 6.8 + 8}
                      height={15}
                      fill="var(--well)"
                    />
                    <text x={p.x} y={p.y + 28} textAnchor="middle" fontSize={11} fill={isCur ? "var(--hot)" : "var(--mute)"}>
                      = {show(e.val)}
                    </text>
                  </>
                )}
                {err && (
                  <text x={p.x} y={p.y + 28} textAnchor="middle" fontSize={11} fill="var(--dead)" stroke="var(--well)" strokeWidth={5} paintOrder="stroke">
                    throws
                  </text>
                )}
                {sk && p.n.id === steps.find((x) => x.skipped?.[0] === p.n.id)?.skipped?.[0] && (
                  <text x={p.x} y={p.y + 28} textAnchor="middle" fontSize={11} fill="var(--faint)" stroke="var(--well)" strokeWidth={5} paintOrder="stroke">
                    skipped
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md bg-well px-4 py-2.5 text-14 whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line)]">
        {render(root)}
      </div>
      <p className="mt-3 min-h-[3.2em] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink" aria-live="polite">
        {cur ? (
          cur.err ? (
            <>
              <span className="text-dead">{cur.err}</span> <span className="text-mute">{cur.note}</span>
            </>
          ) : (
            cur.note
          )
        ) : (
          <span className="text-mute">precedence decided the shape of the tree before anything runs. step to evaluate it, one operator at a time.</span>
        )}
      </p>
      <StepControls s={s} className="mt-1" />
    </div>
  );
}
