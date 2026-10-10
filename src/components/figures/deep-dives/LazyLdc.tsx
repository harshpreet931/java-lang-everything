"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { CodePanel, Narration } from "./kit";

// string literals are resolved lazily: a CONSTANT_String entry stays unresolved until
// the first ldc that uses it runs. verified on jdk 25: in the program below,
// x.intern() == x prints true, so "jle-pool" was not in the pool yet even though the
// literal sits two lines further down in the same class. then x == "jle-pool" is true.

const CODE = `void main() {
    String x = new String("jle-") + new String("pool");
    IO.println(x.intern() == x);
    IO.println(x == "jle-pool");
}`;

type Obj = { id: string; text: string; pooled?: boolean; fresh?: boolean };
type S = {
  line: number;
  cp: { lit: string; to?: string; fresh?: boolean }[];
  table: { text: string; to: string; fresh?: boolean }[];
  heap: Obj[];
  x?: string;
  out: string;
  note: string;
};

const CP_ALL = ['"jle-"', '"pool"', '"jle-pool"'];

const STEPS: S[] = [
  {
    line: 2,
    cp: CP_ALL.map((lit) => ({ lit })),
    table: [],
    heap: [],
    out: "",
    note: "the class is loaded. its constant pool has three CONSTANT_String entries, all unresolved: just bytes in the class file. nothing is in the string pool yet.",
  },
  {
    line: 3,
    cp: [{ lit: '"jle-"', to: "#1", fresh: true }, { lit: '"pool"', to: "#2", fresh: true }, { lit: '"jle-pool"' }],
    table: [
      { text: "jle-", to: "#1", fresh: true },
      { text: "pool", to: "#2", fresh: true },
    ],
    heap: [
      { id: "#1", text: '"jle-"', pooled: true, fresh: true },
      { id: "#2", text: '"pool"', pooled: true, fresh: true },
      { id: "#3", text: '"jle-" (copy)', fresh: true },
      { id: "#4", text: '"pool" (copy)', fresh: true },
      { id: "#5", text: '"jle-pool"', fresh: true },
    ],
    x: "#5",
    out: "",
    note: 'line 2 runs two ldc instructions, so "jle-" and "pool" get resolved: a String is made and put in the pool. the two new Strings are copies, and the + builds #5 at run time. #5 is not in the pool.',
  },
  {
    line: 4,
    cp: [{ lit: '"jle-"', to: "#1" }, { lit: '"pool"', to: "#2" }, { lit: '"jle-pool"' }],
    table: [
      { text: "jle-", to: "#1" },
      { text: "pool", to: "#2" },
      { text: "jle-pool", to: "#5", fresh: true },
    ],
    heap: [
      { id: "#1", text: '"jle-"', pooled: true },
      { id: "#2", text: '"pool"', pooled: true },
      { id: "#5", text: '"jle-pool"', pooled: true, fresh: true },
    ],
    x: "#5",
    out: "true\n",
    note: 'x.intern() looks up "jle-pool" by content. no hit, because the literal on line 4 hasn\'t run yet. so the pool adopts #5 itself and returns it: true. (the two copies are garbage now.)',
  },
  {
    line: 5,
    cp: [{ lit: '"jle-"', to: "#1" }, { lit: '"pool"', to: "#2" }, { lit: '"jle-pool"', to: "#5", fresh: true }],
    table: [
      { text: "jle-", to: "#1" },
      { text: "pool", to: "#2" },
      { text: "jle-pool", to: "#5" },
    ],
    heap: [
      { id: "#1", text: '"jle-"', pooled: true },
      { id: "#2", text: '"pool"', pooled: true },
      { id: "#5", text: '"jle-pool"', pooled: true },
    ],
    x: "#5",
    out: "true\ntrue\n",
    note: 'now the literal runs for the first time. resolving it means "look it up in the pool": hit, #5. the constant pool entry caches that reference, so x == "jle-pool" is true. a literal is just an intern() that runs once.',
  },
];

export function LazyLdc() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const st = STEPS[s.i];

  return (
    <div {...s.keys} className="@container outline-none" aria-label="lazy resolution of string literals, step by step">
      <div className="grid gap-4 @[880px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <CodePanel file="Main.java" code={CODE} hot={[st.line]} />
          <div className="rounded-md bg-bg px-4 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="text-11 text-faint">stdout</div>
            <pre className="min-h-[3.4em] text-13 leading-[1.7] text-hi">{st.out || <span className="text-faint">·</span>}</pre>
          </div>
        </div>
        <div className="grid content-start gap-3 text-12">
          <Panel title="Main's constant pool" sub="CONSTANT_String entries">
            {st.cp.map((c) => (
              <div key={c.lit} className="flex items-baseline justify-between gap-3 border-t border-line py-1 first:border-t-0">
                <span className="text-ink">{c.lit}</span>
                {c.to ? (
                  <span key={c.to} className={`text-ref ${c.fresh ? "flash" : ""}`}>→ {c.to}</span>
                ) : (
                  <span className="text-faint">unresolved</span>
                )}
              </div>
            ))}
          </Panel>
          <Panel title="StringTable" sub="the pool: a hash table inside the JVM">
            {st.table.length === 0 && <div className="text-faint">empty (for these strings)</div>}
            {st.table.map((t) => (
              <div key={t.text} className="flex items-baseline justify-between gap-3 border-t border-line py-1 first:border-t-0">
                <span className={t.fresh ? "text-hot" : "text-ink"}>{t.text}</span>
                <span className="text-ref">→ {t.to}</span>
              </div>
            ))}
          </Panel>
          <Panel title="heap" sub={st.x ? <>x <span className="text-ref">→ {st.x}</span></> : "x not assigned yet"}>
            {st.heap.length === 0 && <div className="text-faint">nothing yet</div>}
            <div className="flex flex-wrap gap-1.5">
              {st.heap.map((o) => (
                <span
                  key={o.id}
                  className="obj-in inline-flex items-baseline gap-1.5 rounded-xs bg-well px-2 py-1"
                  style={{ boxShadow: `inset 0 0 0 1px ${o.fresh ? "var(--hot)" : "var(--line-2)"}` }}
                >
                  <span className="text-faint">{o.id}</span>
                  <span className="text-hi">{o.text}</span>
                  {o.pooled && <span className="text-[10px] text-meta">pooled</span>}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <Narration className="mt-4">{st.note}</Narration>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-bg px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-meta">{title}</span>
        <span className="text-11 text-faint">{sub}</span>
      </div>
      {children}
    </div>
  );
}
