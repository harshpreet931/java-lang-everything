"use client";

import { useEffect, useRef, useState } from "react";

// what `a.speak()` costs at runtime: reference → object → class pointer → vtable slot → code.
// javac only wrote "invokevirtual Animal.speak()". the JVM resolves that to a slot number once,
// and every call after that is two loads and an indirect jump.
// slot numbers are written relative (k, k+1...) on purpose: the absolute numbers are HotSpot's business.
// what matters, and what's true for HotSpot, is that a subclass's vtable starts as a copy of its parent's,
// overrides replace entries in place, and new methods are appended.

type Obj = "Animal" | "Dog";
type Call = "speak" | "eat" | "toString";

type Slot = { slot: string; name: Call | "fetch" | "rest"; impl: string; how: "inherited" | "overrides" | "new" | "declares" };

const VTABLE: Record<Obj, Slot[]> = {
  Animal: [
    { slot: "0…", name: "toString", impl: "Object.toString", how: "inherited" },
    { slot: "…", name: "rest", impl: "equals, hashCode, clone… → Object", how: "inherited" },
    { slot: "k", name: "speak", impl: "Animal.speak", how: "declares" },
    { slot: "k+1", name: "eat", impl: "Animal.eat", how: "declares" },
  ],
  Dog: [
    { slot: "0…", name: "toString", impl: "Object.toString", how: "inherited" },
    { slot: "…", name: "rest", impl: "equals, hashCode, clone… → Object", how: "inherited" },
    { slot: "k", name: "speak", impl: "Dog.speak", how: "overrides" },
    { slot: "k+1", name: "eat", impl: "Animal.eat", how: "inherited" },
    { slot: "k+2", name: "fetch", impl: "Dog.fetch", how: "new" },
  ],
};

const CODE: Record<string, string> = {
  "Animal.speak": 'String speak() {\n    return "...";\n}',
  "Dog.speak": '@Override\nString speak() {\n    return "woof";\n}',
  "Animal.eat": 'String eat() {\n    return "nom";\n}',
  "Object.toString": 'public String toString() {\n    return getClass().getName()\n        + "@" + Integer.toHexString(hashCode());\n}',
};

const PHASES = [
  "javac compiled this to invokevirtual Animal.CALL(), based on a's declared type. the JVM resolved that to a vtable slot the first time it ran.",
  "follow a: the reference leads to the object on the heap.",
  "read the object's header: its class pointer says what it really is, OBJ.",
  "look up slot SLOT in OBJ's vtable. one array read, no searching by name.",
  "jump to IMPL. that's dynamic dispatch: the object picked the code.",
];

export function VtableLookup() {
  const [obj, setObj] = useState<Obj>("Dog");
  const [call, setCall] = useState<Call>("speak");
  const [phase, setPhase] = useState(4);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const run = (o: Obj, c: Call) => {
    clear();
    setObj(o);
    setCall(c);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(4);
      return;
    }
    setPhase(0);
    for (let p = 1; p <= 4; p++) timers.current.push(window.setTimeout(() => setPhase(p), p * 650));
  };

  const table = VTABLE[obj];
  const row = table.find((r) => r.name === call)!;
  const note = PHASES[phase]
    .replace("CALL", call)
    .replace(/OBJ/g, obj)
    .replace("SLOT", row.slot === "0…" ? "of toString" : row.slot)
    .replace("IMPL", row.impl + "()");

  const lit = (p: number) => phase === p;
  const done = (p: number) => phase >= p;

  return (
    <div className="grid gap-5 text-13">
      <div>
        <div className="grid grid-cols-[8ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">a =</span>
          <div className="flex flex-wrap gap-1">
            {(["Animal", "Dog"] as const).map((o) => (
              <button key={o} className="word" aria-pressed={obj === o} onClick={() => run(o, call)}>
                Animal a = new {o}()
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[8ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">call =</span>
          <div className="flex flex-wrap gap-1">
            {(["speak", "eat", "toString"] as const).map((c) => (
              <button key={c} className="word" aria-pressed={call === c} onClick={() => run(obj, c)}>
                a.{c}()
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-2 md:grid-cols-[minmax(0,0.7fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1.3fr)_auto_minmax(0,1.2fr)]">
        {/* stack */}
        <Col title="stack" on={lit(0) || lit(1)}>
          <div className="text-12 text-mute">main</div>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-1 text-12">
            <span className="text-mute">Animal a</span>
            <span className="size-[7px] rounded-full bg-ref" />
          </div>
        </Col>
        <Arrow tone="ref" on={done(1)} />
        {/* heap */}
        <Col title="heap" on={lit(1) || lit(2)}>
          <div className="text-12 text-hi">{obj}</div>
          <div className="mt-1 grid gap-0.5 border-t border-line pt-1 text-12">
            <div className="flex justify-between gap-2">
              <span className="text-meta">mark</span>
              <span className="text-faint">…</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={lit(2) ? "text-hot" : "text-meta"}>class</span>
              <span className="size-[7px] rounded-full bg-meta" />
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-mute">fields…</span>
            </div>
          </div>
        </Col>
        <Arrow tone="meta" on={done(2)} />
        {/* class + vtable */}
        <Col title={`class ${obj} · vtable`} on={lit(3)}>
          <div className="grid text-11">
            {table.map((r) => {
              const hit = r.name === call && done(3);
              return (
                <div
                  key={r.slot + r.name}
                  className="grid grid-cols-[3.5ch_minmax(0,1fr)] gap-x-2 border-t border-line py-[3px] first:border-t-0 transition-colors duration-150"
                  style={{ background: hit ? "color-mix(in srgb, var(--hot) 14%, transparent)" : undefined }}
                >
                  <span className="text-faint tabular">{r.slot}</span>
                  <span className="min-w-0">
                    <span className={hit ? "text-hot" : r.name === "rest" ? "text-faint" : "text-ink"}>
                      {r.name === "rest" ? r.impl : r.impl}
                    </span>
                    {r.name !== "rest" && (
                      <span className={`ml-1.5 ${r.how === "overrides" ? "text-live" : "text-faint"}`}>{r.how}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Col>
        <Arrow tone="hot" on={done(4)} />
        {/* code */}
        <Col title="code that runs" on={lit(4)}>
          <pre className={`overflow-x-auto text-11 leading-[1.6] transition-opacity duration-200 ${done(4) ? "opacity-100" : "opacity-25"}`}>
            <span className="text-faint">// {row.impl}</span>
            {"\n"}
            <span className={done(4) ? "text-live" : "text-ink"}>{CODE[row.impl]}</span>
          </pre>
        </Col>
      </div>

      <p className="min-h-[3.4em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        <span className="mr-2 font-mono text-12 text-faint tabular">{phase + 1}/5</span>
        {note}
      </p>
    </div>
  );
}

function Col({ title, on, children }: { title: string; on: boolean; children: React.ReactNode }) {
  return (
    <div
      className="min-w-0 rounded-md bg-well px-3 py-2.5 transition-[box-shadow] duration-200 ease-jle"
      style={{ boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}` }}
    >
      <div className="mb-1.5 text-[10px] text-faint">{title}</div>
      {children}
    </div>
  );
}

function Arrow({ tone, on }: { tone: "ref" | "meta" | "hot"; on: boolean }) {
  return (
    <div
      className="flex items-center justify-center self-center text-14 transition-colors duration-200"
      style={{ color: on ? `var(--${tone})` : "var(--line-2)" }}
      aria-hidden
    >
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </div>
  );
}
