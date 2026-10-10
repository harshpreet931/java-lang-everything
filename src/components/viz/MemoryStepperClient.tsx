"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isRef, type Frame, type HeapObject, type Step, type Trace, type Value } from "@/lib/trace";
import { StepControls, useStepper } from "./stepper";

// code on the left, stack + heap on the right, blue arrows for references.
// objects that stop being reachable linger for one step as red "unreachable" ghosts.

type Props = {
  trace: Trace;
  /** pre-highlighted html, one string per source line (from the server wrapper) */
  lines: string[];
  /** hide the memory panes and just walk the code (with notes + stdout) */
  memory?: boolean;
  /** first step to show */
  start?: number;
  /** max height of the code pane in px */
  codeHeight?: number;
  /** autoplay interval */
  interval?: number;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function MemoryStepperClient({ trace, lines, memory = true, start = 0, codeHeight = 420, interval = 1300 }: Props) {
  const s = useStepper(trace.steps.length, { start, interval });
  const step = trace.steps[s.i];
  const prev = s.i > 0 ? trace.steps[s.i - 1] : undefined;

  const newOut = useMemo(() => {
    const all = step.stdout ?? "";
    const before = prev?.stdout ?? "";
    return all.startsWith(before) ? [before, all.slice(before.length)] : ["", all];
  }, [step, prev]);

  return (
    <div {...s.keys} className="memstep @container outline-none" aria-label={`step-through of ${trace.file}`}>
      <div className={`grid gap-5 ${memory ? "@[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-3">
          <CodePane file={trace.file} lines={lines} line={step.line} prevLine={prev?.line} height={codeHeight} />
          {(trace.steps.some((x) => x.stdout) || !memory) && (
            <div className="bg-well px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="mb-1 text-11 text-faint">stdout</div>
              <pre className="min-h-[1.7em] overflow-x-auto text-13 leading-[1.7] whitespace-pre text-ink">
                {newOut[0]}
                <span className="text-hot">{newOut[1]}</span>
                {!step.stdout && <span className="text-faint">·</span>}
              </pre>
            </div>
          )}
        </div>
        {memory && <MemoryPane step={step} prev={prev} />}
      </div>
      <div className="mt-5 grid gap-3">
        <p className="min-h-[1.7em] font-serif text-[1.04rem] leading-[1.65] text-ink" aria-live="polite">
          {step.note ?? <span className="text-faint">line {step.line} is next.</span>}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}

/* ---- code ------------------------------------------------------------------- */

function CodePane({
  file,
  lines,
  line,
  prevLine,
  height,
}: {
  file: string;
  lines: string[];
  line: number;
  prevLine?: number;
  height: number;
}) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-l="${line}"]`);
    const pane = box.current;
    if (!el || !pane) return;
    const top = el.offsetTop - pane.clientHeight / 2 + el.clientHeight / 2;
    pane.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [line]);

  return (
    <div className="overflow-hidden rounded-xs bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-9 items-center justify-between border-b border-line px-4 text-12">
        <span className="text-ink">{file}</span>
        <span className="flex items-center gap-2 text-11 text-faint">
          <span className="inline-block h-2.5 w-[2px] bg-hot" /> next to run
        </span>
      </div>
      <div ref={box} className="relative overflow-auto py-3" style={{ maxHeight: height }}>
        <ol className="min-w-max text-13 leading-[1.75]">
          {lines.map((html, i) => {
            const n = i + 1;
            const cur = n === line;
            const was = n === prevLine && !cur;
            return (
              <li
                key={n}
                data-l={n}
                className={`grid grid-cols-[4ch_1fr] gap-x-3.5 border-l-2 pr-5 transition-colors duration-200 ${
                  cur ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent"
                }`}
              >
                <span className={`text-right tabular ${cur ? "text-hot" : was ? "text-mute" : "text-faint/60"}`}>{n}</span>
                <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html || " " }} />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ---- memory ----------------------------------------------------------------- */

type Arrow = { key: string; d: string; dead?: boolean };

export function MemoryPane({ step, prev }: { step: Step; prev?: Step }) {
  const root = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const marker = useId().replace(/:/g, "");

  // objects that were reachable last step and aren't now
  const ghosts = useMemo(() => {
    if (!prev) return [] as [string, HeapObject][];
    // skip objects the trace already showed as dead last step (the tracer marks them for one step itself)
    return Object.entries(prev.heap ?? {}).filter(([id, o]) => !(id in (step.heap ?? {})) && o.state !== "dead");
  }, [step, prev]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const rb = el.getBoundingClientRect();
      const out: Arrow[] = [];
      // arrows that have to loop back around a column get their own lane each, so they don't pile up
      let lane = 0;
      const incoming = new Map<string, number>();
      el.querySelectorAll<HTMLElement>("[data-to]").forEach((src) => {
        const to = src.dataset.to!;
        const target = el.querySelector<HTMLElement>(`[data-obj="${CSS.escape(to)}"]`);
        if (!target) return;
        const a = src.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const fx = a.left + a.width / 2 - rb.left;
        const fy = a.top + a.height / 2 - rb.top;
        const ty = b.top + Math.min(15, b.height / 2) - rb.top;
        let d: string;
        if (b.left - rb.left > fx + 14) {
          const tx = b.left - rb.left - 2;
          const dx = Math.max(24, (tx - fx) * 0.5);
          d = `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        } else {
          const tx = b.right - rb.left + 2;
          const n = incoming.get(to) ?? 0;
          incoming.set(to, n + 1);
          const ty2 = ty + (n % 4) * 5;
          const out2 = Math.max(tx, fx) + 22 + (lane++ % 6) * 9;
          d = `M ${fx} ${fy} C ${out2} ${fy}, ${out2} ${ty2}, ${tx} ${ty2}`;
        }
        out.push({ key: `${src.dataset.from}->${to}`, d });
      });
      setArrows(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  const stepFrames = step.frames ?? [];
  const stepHeap = step.heap ?? {};
  const frames = [...stepFrames].reverse(); // newest on top

  return (
    <div ref={root} className="relative grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-x-9 self-start">
      <div className="min-w-0">
        <PaneTitle>stack</PaneTitle>
        <div className="flex flex-col gap-2.5">
          {frames.length === 0 && <div className="text-12 text-faint">empty. main returned.</div>}
          {frames.map((f, idx) => {
            const depth = stepFrames.length - 1 - idx;
            const pf = prev?.frames?.[depth];
            const samefr = pf && pf.name === f.name;
            return <FrameBox key={`${depth}:${f.name}`} f={f} top={idx === 0} prevFrame={samefr ? pf : undefined} path={`f${depth}`} />;
          })}
        </div>
      </div>
      <div className="min-w-0">
        <PaneTitle>heap</PaneTitle>
        <div className="flex flex-col items-start gap-2.5">
          {Object.keys(stepHeap).length === 0 && ghosts.length === 0 && (
            <div className="text-12 text-faint">nothing allocated yet.</div>
          )}
          {Object.entries(stepHeap).map(([id, o]) => (
            <ObjectBox key={id} id={id} o={o} prev={prev?.heap?.[id]} isNew={!!prev && !(id in (prev.heap ?? {}))} />
          ))}
          {ghosts.map(([id, o]) => (
            <ObjectBox key={`ghost-${id}`} id={id} o={o} ghost />
          ))}
        </div>
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <marker id={`ah-${marker}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
          </marker>
        </defs>
        {arrows.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke="var(--ref)"
            strokeWidth={1.25}
            markerEnd={`url(#ah-${marker})`}
            className="arrow-in"
          />
        ))}
      </svg>
    </div>
  );
}

function PaneTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 border-b border-line pb-1.5 text-11 text-faint">{children}</div>;
}

function FrameBox({ f, top, prevFrame, path }: { f: Frame; top: boolean; prevFrame?: Frame; path: string }) {
  return (
    <div
      className={`frame-in rounded-xs bg-well px-3 py-2 ${
        top ? "shadow-[inset_0_0_0_1px_var(--line-2)]" : "opacity-70 shadow-[inset_0_0_0_1px_var(--line)]"
      }`}
    >
      <div className={`mb-1 flex items-baseline justify-between gap-3 text-12 ${top ? "text-hi" : "text-mute"}`}>
        <span className="truncate">{f.name}</span>
        {f.line !== undefined && <span className="text-11 text-faint tabular">line {f.line}</span>}
      </div>
      {Object.keys(f.locals).length === 0 ? (
        <div className="text-11 text-faint">no locals yet</div>
      ) : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] text-12 [&>.slot:first-child>span]:border-t-0 [&_.slot>span:first-child]:pr-3">
          {Object.entries(f.locals).map(([k, v]) => (
            <Slot
              key={k}
              name={k}
              v={v}
              from={`${path}.${k}`}
              changed={prevFrame ? !same(prevFrame.locals[k], v) : false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slot({ name, v, from, changed }: { name: string; v: Value; from: string; changed: boolean }) {
  return (
    <div className="slot contents">
      <span className="truncate border-t border-line py-[3px] text-mute">{name}</span>
      <span className="flex justify-end border-t border-line py-[3px]">
        <span key={changed ? JSON.stringify(v) : "same"} className={`px-0.5 ${changed ? "flash" : ""}`}>
          <ValueView v={v} from={from} />
        </span>
      </span>
    </div>
  );
}

function ValueView({ v, from }: { v: Value; from: string }) {
  if (v === null) return <span className="text-faint">null</span>;
  if (isRef(v))
    return (
      <span data-from={from} data-to={v.ref} className="inline-flex h-[1.4em] w-4 items-center justify-center" aria-label={`reference to ${v.ref}`}>
        <span className="size-[7px] rounded-full bg-ref" />
      </span>
    );
  if (typeof v === "boolean") return <span className="text-hi">{String(v)}</span>;
  return <span className="text-hi tabular">{String(v)}</span>;
}

function ObjectBox({ id, o, prev, ghost, isNew }: { id: string; o: HeapObject; prev?: HeapObject; ghost?: boolean; isNew?: boolean }) {
  const dead = ghost || o.state === "dead";
  const border = dead
    ? "shadow-[inset_0_0_0_1px_var(--dead)] opacity-60"
    : isNew || o.state === "new"
      ? "shadow-[inset_0_0_0_1px_var(--hot)]"
      : "shadow-[inset_0_0_0_1px_var(--line-2)]";
  return (
    <div data-obj={ghost ? undefined : id} className={`obj-in max-w-full rounded-xs bg-well px-3 py-2 ${border}`}>
      <div className="mb-1 flex items-baseline gap-3 text-12">
        <span className={dead ? "text-dead" : "text-hi"}>{o.type}</span>
        {(ghost || o.tag) && <span className={`text-11 ${ghost ? "text-dead" : "text-faint"}`}>{ghost ? "unreachable" : o.tag}</span>}
      </div>
      <ObjectBody id={id} o={o} prev={prev} />
    </div>
  );
}

function ObjectBody({ id, o, prev }: { id: string; o: HeapObject; prev?: HeapObject }) {
  if (o.value !== undefined) {
    return <div className="text-13 text-hi">{o.value}</div>;
  }
  if (o.fields) {
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] text-12 [&>.slot:first-child>span]:border-t-0 [&_.slot>span:first-child]:pr-4">
        {Object.entries(o.fields).map(([k, v]) => (
          <Slot key={k} name={k} v={v} from={`${id}.${k}`} changed={!!prev?.fields && !same(prev.fields[k], v)} />
        ))}
      </div>
    );
  }
  if (o.items) {
    if (o.items.length === 0) return <div className="text-11 text-faint">empty</div>;
    return (
      <div className="flex flex-wrap gap-px bg-line p-px">
        {o.items.map((v, i) => {
          const changed = !!prev?.items && !same(prev.items[i], v);
          return (
            <div key={i} className="flex min-w-7 flex-col items-center bg-well px-1.5 pt-1">
              <span key={changed ? JSON.stringify(v) : "s"} className={`flex h-[1.5em] items-center text-12 ${changed ? "flash" : ""}`}>
                <ValueView v={v} from={`${id}[${i}]`} />
              </span>
              <span className="text-[10px] leading-4 text-faint tabular">{i}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (o.entries) {
    if (o.entries.length === 0) return <div className="text-11 text-faint">empty</div>;
    return (
      <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2 text-12">
        {o.entries.map(([k, v], i) => (
          <div key={i} className="contents">
            <span className="flex justify-end py-[2px]">
              <ValueView v={k} from={`${id}{${i}}k`} />
            </span>
            <span className="text-faint">→</span>
            <span className="py-[2px]">
              <ValueView v={v} from={`${id}{${i}}v`} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <div className="text-11 text-faint">{o.summary ? "(internals hidden)" : ""}</div>;
}
