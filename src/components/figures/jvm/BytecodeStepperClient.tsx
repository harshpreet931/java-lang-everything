"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { PROGRAMS, type BcProgram } from "./bytecodePrograms";
import { simulate, type Frame, type Obj, type Val } from "./bytecodeSim";

// source | bytecode | frames. one step = one bytecode instruction, executed by
// bytecodeSim.ts. the hot bar marks the instruction that just ran.

const KEYFRAMES = `@keyframes jvm-bc-push { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.jvm-bc-push { animation: jvm-bc-push 220ms cubic-bezier(0.2, 0, 0, 1) both; }`;

export function BytecodeStepperClient({ ids, lines }: { ids: string[]; lines: string[][] }) {
  const progs = ids.map((id) => PROGRAMS.find((p) => p.id === id)!);
  const [i, setI] = useState(0);
  return (
    <div className="@container">
      <style>{KEYFRAMES}</style>
      {progs.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-line pb-2" role="tablist" aria-label="pick a method">
          <span className="mr-2 text-12 text-faint">method =</span>
          {progs.map((p, j) => (
            <button key={p.id} role="tab" className="word" aria-selected={i === j} onClick={() => setI(j)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <Program key={progs[i].id} p={progs[i]} lines={lines[i]} />
    </div>
  );
}

function Program({ p, lines }: { p: BcProgram; lines: string[] }) {
  const snaps = useMemo(() => simulate(p), [p]);
  const s = useStepper(snaps.length, { interval: 1300 });
  const snap = snaps[s.i];
  const prev = s.i > 0 ? snaps[s.i - 1] : undefined;
  const top = snap.frames[snap.frames.length - 1];
  const shownMethod = snap.ran?.method ?? top?.method ?? p.entry.method;
  const m = p.methods[shownMethod];
  const ranIns = snap.ran ? m.code.find((c) => c.pc === snap.ran!.pc) : undefined;
  const nextPc = top && top.method === shownMethod ? top.pc : undefined;
  const line = ranIns?.line;
  const objs = Object.entries(snap.heap);

  return (
    <div {...s.keys} className="outline-none" aria-label={`bytecode step-through of ${p.file}`}>
      <div className="grid gap-4 @[560px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Source file={p.file} lines={lines} line={line} />
          <Bytecode sig={m.sig} maxStack={m.maxStack} locals={m.locals.length} code={m.code} ran={snap.ran?.pc} next={nextPc} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Title>frames · newest on top</Title>
          {snap.frames.length === 0 && (
            <div className="rounded-md bg-well px-3 py-3 text-12 text-mute shadow-[inset_0_0_0_1px_var(--line)]">
              no frames left.{" "}
              {snap.result !== undefined && (
                <>
                  {p.entry.method} returned <span className="text-live">{fmt(snap.result)}</span>.
                </>
              )}
            </div>
          )}
          {[...snap.frames].reverse().map((f, k) => {
            const depth = snap.frames.length - 1 - k;
            const pf = prev?.frames[depth];
            return (
              <FrameCard
                key={`${depth}-${f.method}`}
                f={f}
                p={p}
                active={k === 0}
                prev={pf && pf.method === f.method ? pf : undefined}
                wrote={k === 0 ? snap.wrote : undefined}
              />
            );
          })}
          {objs.length > 0 && (
            <>
              <Title>heap</Title>
              {objs.map(([id, o]) => (
                <ObjCard key={id} id={+id} o={o} touched={snap.touched === +id} before={prev?.heap[+id]} />
              ))}
            </>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {snap.note}
        </p>
        <StepControls s={s} label="instruction" />
      </div>
    </div>
  );
}

const fmt = (v: Val | undefined) => (v === undefined ? "·" : v === null ? "null" : typeof v === "number" ? String(v) : `Point@${v.ref}`);

function Title({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-line pb-1.5 text-11 text-faint">{children}</div>;
}

function ValView({ v }: { v: Val | undefined }) {
  if (v === undefined) return <span className="text-faint">·</span>;
  if (v === null) return <span className="text-faint">null</span>;
  if (typeof v === "number") return <span className="text-hi tabular">{v}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-ref">
      <span className="size-[7px] rounded-full bg-ref" aria-hidden />
      Point@{v.ref}
    </span>
  );
}

function Source({ file, lines, line }: { file: string; lines: string[]; line?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">{file}</div>
      <div className="overflow-x-auto py-2.5">
        <ol className="min-w-max text-12 leading-[1.8]">
          {lines.map((html, i) => {
            const cur = i + 1 === line;
            return (
              <li
                key={i}
                className={`grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4 transition-colors duration-200 ${
                  cur ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent"
                }`}
              >
                <span className={`text-right tabular ${cur ? "text-hot" : "text-faint/60"}`}>{i + 1}</span>
                <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html || " " }} />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Bytecode({
  sig,
  maxStack,
  locals,
  code,
  ran,
  next,
}: {
  sig: string;
  maxStack: number;
  locals: number;
  code: BcProgram["methods"][string]["code"];
  ran?: number;
  next?: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-9 items-center justify-between gap-3 border-b border-line px-4 text-12">
        <span className="truncate text-ink">{sig}</span>
        <span className="flex shrink-0 items-center gap-2 text-11 text-faint">
          <span className="inline-block h-2.5 w-[2px] bg-hot" /> just ran
        </span>
      </div>
      <div className="px-4 pt-2 text-11 text-faint tabular">
        stack={maxStack}, locals={locals}
      </div>
      <div className="overflow-x-auto pb-2.5">
        <ol className="min-w-max text-12 leading-[1.8]">
          {code.map((c) => {
            const cur = c.pc === ran;
            const nx = c.pc === next && !cur;
            return (
              <li
                key={c.pc}
                className={`grid grid-cols-[3ch_auto_1fr] gap-x-3 border-l-2 pr-4 pl-2 transition-colors duration-200 ${
                  cur ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : nx ? "border-line-2" : "border-transparent"
                }`}
              >
                <span className={`text-right tabular ${cur ? "text-hot" : "text-faint/70"}`}>{c.pc}:</span>
                <span className={cur ? "text-hi" : "text-ink"}>
                  {c.op}
                  {c.arg && <span className={c.arg.startsWith("#") ? "text-ref" : "text-mute"}> {c.arg}</span>}
                </span>
                <span className="truncate text-faint">{c.c ? `// ${c.c}` : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function FrameCard({ f, p, active, prev, wrote }: { f: Frame; p: BcProgram; active: boolean; prev?: Frame; wrote?: number }) {
  const m = p.methods[f.method];
  // which stack cells are new since the previous step (for the push animation)
  const keep = prev ? f.stack.findIndex((v, i) => i >= prev.stack.length || JSON.stringify(v) !== JSON.stringify(prev.stack[i])) : 0;
  const firstNew = keep === -1 ? f.stack.length : keep;
  // the active frame shows every slot up to max_stack; callers only show what's on their stack
  const depth = active ? m.maxStack : Math.max(1, f.stack.length);
  const slots = Array.from({ length: depth }, (_, i) => depth - 1 - i); // top cell first
  return (
    <div
      className={`rounded-md bg-well px-3 pt-2 pb-3 transition-opacity duration-200 ${
        active ? "shadow-[inset_0_0_0_1px_var(--line-2)]" : "opacity-60 shadow-[inset_0_0_0_1px_var(--line)]"
      }`}
    >
      <div className={`mb-2 flex items-baseline justify-between gap-3 text-12 ${active ? "text-hi" : "text-mute"}`}>
        <span className="truncate">{m.name === "<init>" ? "Point.<init>" : m.name}</span>
        <span className="text-11 text-faint tabular">next pc {f.pc}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-11 text-faint">local variables</div>
          <div className="grid grid-cols-[3ch_auto_minmax(0,1fr)] text-12">
            {m.locals.map((name, i) => (
              <div key={i} className="contents">
                <span className="border-t border-line py-[3px] text-faint tabular">{i}</span>
                <span className="truncate border-t border-line py-[3px] pr-2 text-mute">{name}</span>
                <span className="flex justify-end border-t border-line py-[3px]">
                  <span key={i === wrote ? JSON.stringify(f.locals[i]) : "same"} className={`px-0.5 ${i === wrote ? "flash" : ""}`}>
                    <ValView v={f.locals[i]} />
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-11 text-faint">operand stack</div>
          <div className="flex flex-col gap-1">
            {slots.map((si) => {
              const v = f.stack[si];
              const filled = si < f.stack.length;
              const isTop = si === f.stack.length - 1;
              return (
                <div
                  key={si}
                  className={`flex h-[24px] items-center justify-center rounded-md text-12 ${
                    filled ? "bg-well-2 shadow-[inset_0_0_0_1px_var(--line-2)]" : "shadow-[inset_0_0_0_1px_var(--line)]"
                  }`}
                  style={isTop && active ? { boxShadow: "inset 0 0 0 1px var(--hot)" } : undefined}
                >
                  {filled && (
                    <span key={`${si}:${JSON.stringify(v)}:${si >= firstNew}`} className={si >= firstNew && active ? "jvm-bc-push" : ""}>
                      <ValView v={v} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {active && <div className="mt-1 text-[10px] text-faint">max_stack {m.maxStack}</div>}
        </div>
      </div>
    </div>
  );
}

function ObjCard({ id, o, touched, before }: { id: number; o: Obj; touched: boolean; before?: Obj }) {
  return (
    <div
      className="rounded-md bg-well px-3 py-2 text-12"
      style={{ boxShadow: `inset 0 0 0 1px ${touched ? "var(--hot)" : "var(--line-2)"}` }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-ref">
        <span className="size-[7px] rounded-full bg-ref" aria-hidden />
        Point@{id}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
        {Object.entries(o.fields).map(([k, v]) => (
          <div key={k} className="contents">
            <span className="border-t border-line py-[3px] text-mute">{k}</span>
            <span className="border-t border-line py-[3px] text-right">
              <span key={`${k}${v}`} className={before && before.fields[k] !== v ? "flash px-0.5 text-hi" : "px-0.5 text-hi"}>
                {v}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
