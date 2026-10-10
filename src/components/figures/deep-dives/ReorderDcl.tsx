"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Narration, Row, Words, type Tone } from "./kit";

// broken vs volatile double-checked locking, as the java memory model allows it to run.
// `instance = new Config()` is three things: allocate (zeroed), run the constructor,
// store the reference. without volatile nothing orders the constructor's field writes
// before the reference store as far as another thread is concerned, so thread B can
// see the reference first. we caught exactly this on jdk 25 on an arm mac: plain
// publication showed a zero field 18 times in ~13.8 billion reads; volatile, 0 in 9.6 billion.

type Mode = "plain" | "volatile";
type Op = { k: string; label: string };
type S = {
  a: string;
  aTone?: Tone;
  b: string;
  bTone?: Tone;
  done: string[]; // ops done, in the order they became visible to B
  cur?: string;
  obj: "none" | "zeroed" | "built";
  ref: boolean;
  lineA?: number;
  lineB?: number;
  note: string;
};

const OPS: Op[] = [
  { k: "alloc", label: "allocate, all fields zero" },
  { k: "ctor", label: "constructor writes port, host" },
  { k: "pub", label: "store reference in instance" },
];

const code = (mode: Mode) => `class Config {
    private static ${mode === "volatile" ? "volatile " : ""}Config instance;
    int port; String host;
    Config() { port = 8080; host = "db"; }

    static Config get() {
        if (instance == null) {          // check 1
            synchronized (Config.class) {
                if (instance == null)    // check 2
                    instance = new Config();
            }
        }
        return instance;
    }
}`;

const PLAIN: S[] = [
  { a: "get()", b: "·", done: [], obj: "none", ref: false, lineA: 7, note: "thread A calls get() first. instance is null, so it passes check 1." },
  { a: "lock, check 2: still null", aTone: "hot", b: "·", done: [], obj: "none", ref: false, lineA: 9, note: "A takes the lock and checks again. still null. time to build it." },
  {
    a: "new Config(): allocate",
    aTone: "hot",
    b: "·",
    done: ["alloc"],
    cur: "alloc",
    obj: "zeroed",
    ref: false,
    lineA: 10,
    note: "the object exists, every field zeroed: port = 0, host = null. so far, so normal.",
  },
  {
    a: "instance = (the reference)",
    aTone: "dead",
    b: "·",
    done: ["alloc", "pub"],
    cur: "pub",
    obj: "zeroed",
    ref: true,
    lineA: 10,
    note: "the reorder. nothing in the memory model says other threads must see the constructor's writes before this store, and the JIT and an arm CPU are both allowed to let the reference out first.",
  },
  {
    a: "(still in the constructor)",
    b: "get(): check 1 sees non-null",
    bTone: "hot",
    done: ["alloc", "pub"],
    obj: "zeroed",
    ref: true,
    lineB: 7,
    note: "thread B calls get(). check 1 reads instance without the lock, finds a reference, and skips the lock entirely. no lock, no happens-before, no guarantees.",
  },
  {
    a: "(still in the constructor)",
    b: "config.port → 0",
    bTone: "dead",
    done: ["alloc", "pub"],
    obj: "zeroed",
    ref: true,
    lineB: 13,
    note: "B returns the object and reads port: 0. host: null. a half-built singleton, used as if it were done.",
  },
  {
    a: "port = 8080; host = \"db\"",
    aTone: "hot",
    b: "already connected to port 0",
    bTone: "dead",
    done: ["alloc", "pub", "ctor"],
    cur: "ctor",
    obj: "built",
    ref: true,
    lineA: 4,
    note: "A's constructor writes finally become visible. too late for B. this is rare (the window is nanoseconds) and it's real.",
  },
];

const VOLATILE: S[] = [
  PLAIN[0],
  PLAIN[1],
  { ...PLAIN[2] },
  {
    a: "port = 8080; host = \"db\"",
    aTone: "hot",
    b: "·",
    done: ["alloc", "ctor"],
    cur: "ctor",
    obj: "built",
    ref: false,
    lineA: 4,
    note: "with volatile, the order is pinned: no write before a volatile write can be moved after it. so the constructor's writes have to land first.",
  },
  {
    a: "instance = (the reference), a volatile write",
    aTone: "live",
    b: "·",
    done: ["alloc", "ctor", "pub"],
    cur: "pub",
    obj: "built",
    ref: true,
    lineA: 10,
    note: "now the reference is published, as a release: everything A wrote before it travels with it.",
  },
  {
    a: "·",
    b: "get(): check 1 sees non-null",
    bTone: "hot",
    done: ["alloc", "ctor", "pub"],
    obj: "built",
    ref: true,
    lineB: 7,
    note: "B's check 1 is now a volatile read. if it sees the reference, it is guaranteed to see everything A did before storing it (that's the happens-before edge).",
  },
  {
    a: "·",
    b: "config.port → 8080",
    bTone: "live",
    done: ["alloc", "ctor", "pub"],
    obj: "built",
    ref: true,
    lineB: 13,
    note: "B reads port: 8080. same code, one keyword, and a whole class of bug is gone. the cost is a volatile read on every get().",
  },
];

export function ReorderDcl() {
  const [mode, setMode] = useState<Mode>("plain");
  const steps = mode === "plain" ? PLAIN : VOLATILE;
  const s = useStepper(steps.length, { interval: 2400 });
  const st = steps[Math.min(s.i, steps.length - 1)];

  return (
    <div {...s.keys} className="@container outline-none" aria-label="double-checked locking with and without volatile, step by step">
      <Row k="instance =" w="10ch" last>
        <Words
          label="how instance is declared"
          value={mode}
          onChange={(m) => {
            setMode(m);
            s.reset();
          }}
          options={[
            { v: "plain", label: "plain (broken)" },
            { v: "volatile", label: "volatile (fixed)" },
          ]}
        />
      </Row>

      <div className="mt-3 grid gap-4 @[760px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CodePanel
          file="Config.java"
          code={code(mode)}
          hot={st.lineA ? [st.lineA] : []}
          live={st.lineB && st.bTone === "live" ? [st.lineB] : []}
          dead={st.lineB && st.bTone !== "live" ? [st.lineB] : []}
          right={<span className="text-11 text-faint">amber: A · {mode === "plain" ? "red" : "green"}: B</span>}
        />

        <div className="grid content-start gap-3 text-12">
          {(
            [
              ["A", st.a, st.aTone],
              ["B", st.b, st.bTone],
            ] as const
          ).map(([who, what, tone]) => (
            <div key={who} className="grid grid-cols-[3ch_minmax(0,1fr)] items-baseline gap-2 rounded-md bg-bg px-3 py-2 shadow-[inset_0_0_0_1px_var(--line)]">
              <span className="text-hi">{who}</span>
              <span className="border-l-2 pl-2" style={{ borderColor: tone ? `var(--${tone})` : "transparent", color: what === "·" ? "var(--faint)" : "var(--ink)" }}>
                {what}
              </span>
            </div>
          ))}

          <div className="rounded-md bg-bg px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="mb-1.5 text-11 text-faint">order B can observe A&apos;s writes in</div>
            <ol className="grid gap-1">
              {st.done.map((k, i) => {
                const op = OPS.find((o) => o.k === k)!;
                const outOfOrder = mode === "plain" && k === "pub" && !st.done.includes("ctor");
                return (
                  <li key={k} className="obj-in flex items-baseline gap-2">
                    <span className="text-faint tabular">{i + 1}.</span>
                    <span style={{ color: k === st.cur ? (outOfOrder ? "var(--dead)" : "var(--hot)") : "var(--ink)" }}>{op.label}</span>
                  </li>
                );
              })}
              {st.done.length === 0 && <li className="text-faint">nothing yet</li>}
            </ol>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-bg px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="shrink-0">
              <div className="text-11 text-faint">static</div>
              <div className="flex items-center gap-1.5">
                <span className="text-mute">instance</span>
                {st.ref ? <span className="size-[7px] rounded-full bg-ref" /> : <span className="text-faint">null</span>}
              </div>
            </div>
            <span className={`text-ref transition-opacity duration-200 ${st.ref ? "opacity-100" : "opacity-0"}`}>⟶</span>
            {st.obj === "none" ? (
              <span className="text-11 text-faint">no object yet</span>
            ) : (
              <div
                className="obj-in min-w-0 flex-1 rounded-md px-2.5 py-1.5"
                style={{ boxShadow: `inset 0 0 0 1px ${st.obj === "zeroed" ? (st.ref ? "var(--dead)" : "var(--hot)") : "var(--line-2)"}` }}
              >
                <div className="text-11 text-hi">Config</div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 text-11">
                  <span className="text-mute">port</span>
                  <span style={{ color: st.obj === "zeroed" ? "var(--dead)" : "var(--hi)" }}>{st.obj === "zeroed" ? "0" : "8080"}</span>
                  <span className="text-mute">host</span>
                  <span style={{ color: st.obj === "zeroed" ? "var(--dead)" : "var(--hi)" }}>{st.obj === "zeroed" ? "null" : '"db"'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Narration className="mt-4">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
