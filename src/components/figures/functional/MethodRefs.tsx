"use client";

import { useState, type ReactNode } from "react";
import { Java, Row, Words, ring, tint } from "./kit";

// the four kinds of method reference, each next to the lambda it stands for.
// the coloured tokens are where the lambda's parameters end up. every pair here
// compiles and behaves the same on jdk 25.

type Kind = "static" | "bound" | "unbound" | "ctor";

// a token list: plain text, or [text, slot] where slot names a parameter (p0, p1)
// or the bound receiver (rx).
type Tok = string | [string, "p0" | "p1" | "rx"];

type Ex = {
  ref: Tok[];
  target: string;
  lambda: Tok[];
  says: ReactNode;
};

const KINDS: { v: Kind; label: string; shape: string; rule: ReactNode; ex: Ex[] }[] = [
  {
    v: "static",
    label: "static",
    shape: "Class::staticMethod",
    rule: "every argument is passed straight through to the static method.",
    ex: [
      {
        ref: ["Integer::parseInt"],
        target: "Function<String, Integer>",
        lambda: [["s", "p0"], " -> Integer.parseInt(", ["s", "p0"], ")"],
        says: "one argument in, passed along as the only argument.",
      },
      {
        ref: ["Math::max"],
        target: "IntBinaryOperator",
        lambda: ["(", ["a", "p0"], ", ", ["b", "p1"], ") -> Math.max(", ["a", "p0"], ", ", ["b", "p1"], ")"],
        says: "two arguments in, both passed along, in order.",
      },
    ],
  },
  {
    v: "bound",
    label: "bound",
    shape: "expression::method",
    rule: "the receiver is evaluated once, when the reference is created. arguments go to the method.",
    ex: [
      {
        ref: [["System.out", "rx"], "::println"],
        target: "Consumer<String>",
        lambda: [["x", "p0"], " -> ", ["System.out", "rx"], ".println(", ["x", "p0"], ")"],
        says: "System.out is read once, right now, and stored in the reference.",
      },
      {
        ref: [["greeting", "rx"], "::startsWith"],
        target: "Predicate<String>",
        lambda: [["p", "p0"], " -> ", ["greeting", "rx"], ".startsWith(", ["p", "p0"], ")"],
        says: "the String in greeting is captured. the predicate asks it about whatever you pass.",
      },
    ],
  },
  {
    v: "unbound",
    label: "unbound",
    shape: "Class::instanceMethod",
    rule: "there's no receiver yet. the first argument becomes the receiver, the rest become arguments.",
    ex: [
      {
        ref: ["String::length"],
        target: "Function<String, Integer>",
        lambda: [["s", "p0"], " -> ", ["s", "p0"], ".length()"],
        says: "the one argument is the String to call length() on.",
      },
      {
        ref: ["String::compareToIgnoreCase"],
        target: "Comparator<String>",
        lambda: ["(", ["a", "p0"], ", ", ["b", "p1"], ") -> ", ["a", "p0"], ".compareToIgnoreCase(", ["b", "p1"], ")"],
        says: "two arguments: the first is the receiver, the second is the argument. that's why it fits Comparator.",
      },
    ],
  },
  {
    v: "ctor",
    label: "constructor",
    shape: "Class::new",
    rule: "calls a constructor. the arguments pick which one, and arrays work too.",
    ex: [
      {
        ref: ["ArrayList::new"],
        target: "Supplier<List<String>>",
        lambda: ["() -> new ArrayList<>()"],
        says: "no arguments, so the no-arg constructor.",
      },
      {
        ref: ["int[]::new"],
        target: "IntFunction<int[]>",
        lambda: [["n", "p0"], " -> new int[", ["n", "p0"], "]"],
        says: "an array constructor. the argument is the length. toArray(String[]::new) uses exactly this.",
      },
    ],
  },
];

// hot = look here (the first argument, the one that moves around). ref = the captured
// receiver, which really is a reference stored in the object. the 2nd argument stays neutral.
const SLOT: Record<string, { color: string; bg: string; label: string }> = {
  p0: { color: "var(--hot)", bg: tint("hot", 14), label: "1st argument" },
  p1: { color: "var(--hi)", bg: "color-mix(in srgb, var(--ink) 14%, transparent)", label: "2nd argument" },
  rx: { color: "var(--ref)", bg: tint("ref", 14), label: "captured receiver (a reference)" },
};

function Toks({ toks }: { toks: Tok[] }) {
  return (
    <>
      {toks.map((t, i) =>
        typeof t === "string" ? (
          <Java key={i} code={t} />
        ) : (
          <span
            key={i}
            className="rounded-[1px] px-[2px]"
            style={{ color: SLOT[t[1]].color, background: SLOT[t[1]].bg }}
          >
            {t[0]}
          </span>
        ),
      )}
    </>
  );
}

export function RefKinds() {
  const [k, setK] = useState<Kind>("unbound");
  const kind = KINDS.find((x) => x.v === k)!;
  const slots = new Set(kind.ex.flatMap((e) => [...e.ref, ...e.lambda]).filter((t) => typeof t !== "string").map((t) => (t as [string, string])[1]));

  return (
    <div className="@container grid gap-5">
      <Row k="kind =" last>
        <Words options={KINDS.map((x) => ({ v: x.v, label: x.label }))} value={k} onChange={setK} label="kind of method reference" />
      </Row>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-15 text-hi">
          <Java code={kind.shape} />
        </span>
        <span className="font-serif text-17 leading-[1.5] text-ink">{kind.rule}</span>
      </div>

      <div className="grid gap-2" aria-live="polite">
        {kind.ex.map((e, i) => (
          <div key={`${k}-${i}`} className="rounded-md bg-well px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="grid gap-x-4 gap-y-1.5 text-13 @[600px]:grid-cols-[minmax(0,15rem)_2ch_minmax(0,1fr)] @[600px]:items-baseline">
              <span className="min-w-0 overflow-x-auto whitespace-pre text-hi">
                <Toks toks={e.ref} />
              </span>
              <span className="hidden text-faint @[600px]:inline">≡</span>
              <span className="min-w-0 overflow-x-auto whitespace-pre">
                <span className="mr-2 text-faint @[600px]:hidden">≡</span>
                <Toks toks={e.lambda} />
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-2.5 text-12">
              <span className="text-faint">as</span>
              <span className="whitespace-pre">
                <Java code={e.target} />
              </span>
              <span className="font-serif text-16 leading-[1.5] text-mute">{e.says}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-11 text-faint">
        {[...slots].map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-[1px]" style={{ background: SLOT[s].color }} />
            {SLOT[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- sort them yourself ------------------------------------------------------- */

const ITEMS: { ref: string; kind: Kind; lambda: string; why: string }[] = [
  { ref: "String::toUpperCase", kind: "unbound", lambda: "s -> s.toUpperCase()", why: "an instance method named through its class: the argument is the receiver." },
  { ref: "Integer::sum", kind: "static", lambda: "(a, b) -> Integer.sum(a, b)", why: "sum is static on Integer." },
  { ref: "list::add", kind: "bound", lambda: "x -> list.add(x)", why: "a specific list, captured now." },
  { ref: "StringBuilder::new", kind: "ctor", lambda: "() -> new StringBuilder()", why: "::new is always a constructor." },
  { ref: "Object::toString", kind: "unbound", lambda: "o -> o.toString()", why: "toString is an instance method, and there's no object before the ::." },
  { ref: "this::render", kind: "bound", lambda: "x -> this.render(x)", why: "this is an expression. bound to the current object." },
  { ref: "List::of", kind: "static", lambda: "(a, b) -> List.of(a, b)", why: "List.of is a static factory on the interface." },
  { ref: "String[]::new", kind: "ctor", lambda: "n -> new String[n]", why: "an array constructor." },
];

const KIND_WORDS: { v: Kind; label: string }[] = [
  { v: "static", label: "static" },
  { v: "bound", label: "bound" },
  { v: "unbound", label: "unbound" },
  { v: "ctor", label: "constructor" },
];

export function KindSorter() {
  const [picks, setPicks] = useState<Record<number, Kind>>({});
  const done = Object.keys(picks).length;
  const right = ITEMS.filter((it, i) => picks[i] === it.kind).length;

  return (
    <div className="@container grid gap-1">
      {ITEMS.map((it, i) => {
        const p = picks[i];
        const ok = p === it.kind;
        return (
          <div key={it.ref} className="grid gap-x-4 gap-y-1.5 border-b border-line py-2.5 @[640px]:grid-cols-[24ch_minmax(0,1fr)] @[640px]:items-center">
            <span className="text-13 whitespace-pre text-hi">
              <Java code={it.ref} />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {KIND_WORDS.map((w) => {
                const chosen = p === w.v;
                const reveal = p !== undefined;
                const correct = reveal && w.v === it.kind;
                return (
                  <button
                    key={w.v}
                    className="word !min-h-7 !text-12"
                    disabled={reveal}
                    aria-pressed={chosen}
                    onClick={() => setPicks((x) => ({ ...x, [i]: w.v }))}
                    style={
                      reveal
                        ? {
                            background: chosen ? tint(ok ? "live" : "dead", 14) : "transparent",
                            color: chosen ? (ok ? "var(--live)" : "var(--dead)") : correct ? "var(--live)" : "var(--faint)",
                            boxShadow: chosen ? ring(ok ? "live" : "dead", 70) : correct ? ring("live", 60) : undefined,
                            textDecoration: chosen && !ok ? "line-through" : undefined,
                            opacity: 1,
                          }
                        : undefined
                    }
                  >
                    {w.label}
                  </button>
                );
              })}
              {p !== undefined && (
                <span className="basis-full pt-1 pl-2.5 text-12 leading-[1.6] text-mute">
                  <span className="whitespace-pre">
                    <Java code={it.lambda} />
                  </span>
                  <span className="ml-2 font-serif text-16 text-mute">{it.why}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="mt-3 flex items-center justify-between gap-3 text-12" aria-live="polite">
        <span className="text-faint tabular">
          {done < ITEMS.length ? `${done}/${ITEMS.length} sorted` : (
            <span style={{ color: right === ITEMS.length ? "var(--live)" : "var(--ink)" }}>
              {right}/{ITEMS.length} right{right === ITEMS.length ? ". clean sweep." : "."}
            </span>
          )}
        </span>
        <button className="act" onClick={() => setPicks({})} disabled={done === 0}>
          reset
        </button>
      </div>
    </div>
  );
}
