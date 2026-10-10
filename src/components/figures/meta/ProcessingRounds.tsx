"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";

// javac's annotation processing rounds, for the BuilderProcessor in the chapter.
// the "Round n" text is the real output of `javac -XprintRounds -processor gen.BuilderProcessor`
// on jdk 25. Main.java uses PersonBuilder, a class that only exists after round 1.

type Phase = "parse" | "enter" | "process" | "attribute" | "generate";
type File = { name: string; tone?: "hot" | "live"; note?: string };

const PHASES: { id: Phase; label: string }[] = [
  { id: "parse", label: "parse" },
  { id: "enter", label: "enter" },
  { id: "process", label: "process" },
  { id: "attribute", label: "attribute + flow" },
  { id: "generate", label: "generate" },
];

const ROUNDS = [
  "Round 1:\n\tinput files: {Main, Person}\n\tannotations: [gen.Builder]\n\tlast round: false",
  "Round 2:\n\tinput files: {PersonBuilder}\n\tannotations: []\n\tlast round: false",
  "Round 3:\n\tinput files: {}\n\tannotations: []\n\tlast round: true",
];

const STEPS: { phase: Phase; round?: number; sources: File[]; classes: File[]; rounds: number; note: string }[] = [
  {
    phase: "parse",
    sources: [{ name: "Main.java", note: "new PersonBuilder()…" }, { name: "Person.java", note: "@Builder record Person" }],
    classes: [],
    rounds: 0,
    note: "javac parses both files into syntax trees. Main mentions PersonBuilder, which doesn't exist anywhere. javac notices, and keeps quiet for now.",
  },
  {
    phase: "enter",
    sources: [{ name: "Main.java", note: "new PersonBuilder()…" }, { name: "Person.java", note: "@Builder record Person" }],
    classes: [],
    rounds: 0,
    note: "enter: every class gets a symbol. javac collects which annotations appear and which processors claim them. gen.Builder is claimed by BuilderProcessor.",
  },
  {
    phase: "process",
    round: 1,
    sources: [
      { name: "Main.java", note: "new PersonBuilder()…" },
      { name: "Person.java", note: "@Builder record Person", tone: "hot" },
      { name: "PersonBuilder.java", note: "written by the Filer", tone: "hot" },
    ],
    classes: [],
    rounds: 1,
    note: "round 1: process() is called with [gen.Builder]. the processor asks for every element annotated with it, gets Person, reads its components (String name, int age) and writes PersonBuilder.java.",
  },
  {
    phase: "process",
    round: 2,
    sources: [
      { name: "Main.java", note: "new PersonBuilder()…" },
      { name: "Person.java", note: "@Builder record Person" },
      { name: "PersonBuilder.java", note: "parsed + entered", tone: "hot" },
    ],
    classes: [],
    rounds: 2,
    note: "a new source file means a new round. PersonBuilder.java is parsed and entered like any other file. it has no annotations, so the processor has nothing to do. (if it did, it could generate more files, and there'd be a round 3 of real work.)",
  },
  {
    phase: "process",
    round: 3,
    sources: [{ name: "Main.java" }, { name: "Person.java" }, { name: "PersonBuilder.java" }],
    classes: [],
    rounds: 3,
    note: "a round that produced nothing new is the last round. processors get one final call (last round: true) to finish up, and processing is over.",
  },
  {
    phase: "attribute",
    sources: [
      { name: "Main.java", note: "PersonBuilder resolves now", tone: "live" },
      { name: "Person.java" },
      { name: "PersonBuilder.java" },
    ],
    classes: [],
    rounds: 3,
    note: "only now does javac type-check method bodies. new PersonBuilder() resolves, because the class exists. that's why 'cannot find symbol' errors for generated code can be deferred until after processing.",
  },
  {
    phase: "generate",
    sources: [{ name: "Main.java" }, { name: "Person.java" }, { name: "PersonBuilder.java" }],
    classes: [
      { name: "Main.class", tone: "live" },
      { name: "Person.class", tone: "live" },
      { name: "PersonBuilder.class", tone: "live" },
    ],
    rounds: 3,
    note: "three class files. the generated one is compiled exactly like code you wrote, and nothing at runtime knows a processor was involved. @Builder has SOURCE retention, so it isn't even in Person.class.",
  },
];

function FileRow({ f }: { f: File }) {
  const c = f.tone ? `var(--${f.tone})` : "var(--line-2)";
  return (
    <div
      className="rounded-md bg-well px-2.5 py-1.5 transition-[box-shadow] duration-200 ease-jle"
      style={{ boxShadow: `inset 0 0 0 1px ${c}` }}
    >
      <div className="text-12 text-hi">{f.name}</div>
      {f.note && (
        <div className="text-11" style={{ color: f.tone ? c : "var(--faint)" }}>
          {f.note}
        </div>
      )}
    </div>
  );
}

export function ProcessingRounds() {
  const s = useStepper(STEPS.length, { interval: 2600 });
  const st = STEPS[s.i];

  return (
    <div {...s.keys} className="@container outline-none">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-12" aria-label="javac phases">
        {PHASES.map((p, i) => {
          const on = p.id === st.phase;
          return (
            <li key={p.id} className="flex items-center gap-1">
              <span
                className="rounded-xs px-2 py-1 transition-[box-shadow,color] duration-200 ease-jle"
                style={{
                  boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
                  color: on ? "var(--hot)" : "var(--mute)",
                }}
              >
                {p.label}
                {p.id === "process" && st.round ? ` · round ${st.round}` : ""}
              </span>
              {i < PHASES.length - 1 && <span className="text-faint">→</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 text-11 text-faint">the process phase loops: any round that generates source files triggers another round.</div>

      <div className="mt-5 grid gap-4 @[600px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">sources javac knows about</div>
          <div className="flex flex-col gap-1.5">
            {st.sources.map((f) => (
              <FileRow key={f.name} f={f} />
            ))}
          </div>
          <div className="mt-3 mb-1.5 text-11 text-faint">class files written</div>
          <div className="flex min-h-[2.4rem] flex-wrap gap-1.5">
            {st.classes.length ? st.classes.map((f) => <FileRow key={f.name} f={f} />) : <span className="text-12 text-faint">none yet</span>}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">javac -XprintRounds (real output)</div>
          <pre className="min-h-[15em] overflow-x-auto rounded-md bg-well px-3 py-2.5 text-12 leading-[1.55] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)] [tab-size:2]">
            {ROUNDS.slice(0, st.rounds).map((r, i) => (
              <span key={i} style={{ color: i === st.rounds - 1 && st.phase === "process" ? "var(--hot)" : undefined }}>
                {r}
                {"\n"}
              </span>
            ))}
            {st.rounds === 0 && <span className="text-faint">(processing hasn&apos;t started)</span>}
          </pre>
        </div>
      </div>

      <p className="mt-4 min-h-[5.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
