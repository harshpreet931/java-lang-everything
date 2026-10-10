// a tiny JVM for the handful of opcodes in bytecodePrograms.ts.
// it runs a program and records a snapshot after every instruction, so the
// stepper's operand stack and locals are computed from real semantics.

import type { BcProgram, Ins } from "./bytecodePrograms";

export type Val = number | { ref: number } | null;
export type Frame = { method: string; pc: number; locals: (Val | undefined)[]; stack: Val[] };
export type Obj = { type: string; fields: Record<string, number> };
export type Snap = {
  frames: Frame[];
  heap: Record<number, Obj>;
  /** the instruction that just ran (absent on the entry snapshot) */
  ran?: { method: string; pc: number };
  note: string;
  /** local slot written by the instruction that just ran (in the top frame) */
  wrote?: number;
  /** object id whose fields just changed */
  touched?: number;
  /** set once the entry method has returned */
  result?: Val;
};

const clone = <T,>(x: T): T => structuredClone(x);
const show = (v: Val | undefined): string =>
  v === undefined ? "nothing" : v === null ? "null" : typeof v === "number" ? String(v) : `a reference to Point@${v.ref}`;

export function simulate(p: BcProgram): Snap[] {
  const entry = p.methods[p.entry.method];
  const frames: Frame[] = [
    { method: entry.name, pc: 0, locals: entry.locals.map((_, i) => (i < p.entry.args.length ? p.entry.args[i] : undefined)), stack: [] },
  ];
  const heap: Record<number, Obj> = {};
  let nextId = 1;
  const snaps: Snap[] = [];
  const args = p.entry.args.join(", ");
  snaps.push({
    frames: clone(frames),
    heap: clone(heap),
    note: `${entry.name}(${args}) is called. it gets a frame: locals ${entry.locals.join(", ")} and an empty operand stack.`,
  });

  const at = (m: string, pc: number): Ins => p.methods[m].code.find((c) => c.pc === pc)!;
  const nextPc = (m: string, pc: number) => {
    const code = p.methods[m].code;
    return code[code.findIndex((c) => c.pc === pc) + 1].pc;
  };

  for (let guard = 0; guard < 400 && frames.length; guard++) {
    const f = frames[frames.length - 1];
    const ins = at(f.method, f.pc);
    const m = p.methods[f.method];
    const name = (i: number) => m.locals[i];
    let note = "";
    let wrote: number | undefined;
    let touched: number | undefined;
    let result: Val | undefined;
    const op = ins.op;
    const ran = { method: f.method, pc: f.pc };
    let jumped = false;

    let mm: RegExpMatchArray | null;
    if ((mm = op.match(/^[ia]load_(\d)$/))) {
      const i = +mm[1];
      f.stack.push(f.locals[i]!);
      note = `${op}: push local ${i} (${name(i)} = ${show(f.locals[i])}) onto the operand stack.`;
    } else if ((mm = op.match(/^[ia]store_(\d)$/))) {
      const i = +mm[1];
      const v = f.stack.pop()!;
      f.locals[i] = v;
      wrote = i;
      note = `${op}: pop ${show(v)} off the stack into local ${i} (${name(i)}).`;
    } else if ((mm = op.match(/^iconst_(\d)$/))) {
      f.stack.push(+mm[1]);
      note = `${op}: push the constant ${mm[1]}. there's a one-byte instruction for each of -1 to 5.`;
    } else if (op === "iadd" || op === "imul") {
      const b = f.stack.pop() as number;
      const a = f.stack.pop() as number;
      const r = op === "iadd" ? a + b : a * b;
      f.stack.push(r);
      note = `${op}: pop ${b} and ${a}, push ${a} ${op === "iadd" ? "+" : "×"} ${b} = ${r}.`;
    } else if (op === "if_icmpge") {
      const b = f.stack.pop() as number;
      const a = f.stack.pop() as number;
      if (a >= b) {
        f.pc = +ins.arg!;
        jumped = true;
        note = `if_icmpge ${ins.arg}: pop ${b} and ${a}. is ${a} >= ${b}? yes, jump to ${ins.arg}. the loop is over.`;
      } else note = `if_icmpge ${ins.arg}: pop ${b} and ${a}. is ${a} >= ${b}? no, fall through into the loop body.`;
    } else if (op === "iinc") {
      const [i, c] = ins.arg!.split(",").map((s) => +s.trim());
      f.locals[i] = (f.locals[i] as number) + c;
      wrote = i;
      note = `iinc ${i}, ${c}: add ${c} to local ${i} (${name(i)}) in place, now ${f.locals[i]}. the stack isn't involved.`;
    } else if (op === "goto") {
      f.pc = +ins.arg!;
      jumped = true;
      note = `goto ${ins.arg}: jump back to the loop condition.`;
    } else if (op === "ireturn" || op === "areturn" || op === "return") {
      const v = op === "return" ? undefined : f.stack.pop()!;
      frames.pop();
      const caller = frames[frames.length - 1];
      if (caller) {
        if (v !== undefined) caller.stack.push(v);
        note =
          v === undefined
            ? `return: the constructor is done. its frame is popped, and the caller carries on.`
            : `${op}: pop ${show(v)}, destroy this frame, and push it onto the caller's stack.`;
      } else {
        result = v ?? null;
        note = `${op}: ${entry.name} returns ${show(v)}. the frame is gone.`;
      }
    } else if (op === "invokestatic") {
      const target = p.methods[ins.c!.match(/Method (\w+):/)![1]];
      const n = target.sig.match(/\((.*)\)/)![1].split(",").filter((s) => s.trim()).length;
      const a = f.stack.splice(f.stack.length - n, n);
      f.pc = nextPc(f.method, f.pc);
      frames.push({ method: target.name, pc: 0, locals: target.locals.map((_, i) => a[i]), stack: [] });
      note = `invokestatic ${ins.arg}: pop ${a.join(", ")} as the argument, and push a new frame for ${target.name}.`;
      jumped = true;
    } else if (op === "new") {
      const id = nextId++;
      heap[id] = { type: "Point", fields: { x: 0, y: 0 } };
      f.stack.push({ ref: id });
      touched = id;
      note = `new ${ins.arg}: allocate a Point on the heap, fields zeroed, and push a reference to it.`;
    } else if (op === "dup") {
      f.stack.push(clone(f.stack[f.stack.length - 1]));
      note = `dup: copy the top of the stack.`;
    } else if (op === "invokespecial") {
      if (ins.c!.includes("java/lang/Object")) {
        f.stack.pop();
        note = `invokespecial ${ins.arg}: call Object's constructor on this. it's empty, so it returns right away.`;
      } else {
        const target = p.methods["<init>"];
        const a = f.stack.splice(f.stack.length - 3, 3);
        f.pc = nextPc(f.method, f.pc);
        frames.push({ method: target.name, pc: 0, locals: [a[0], a[1], a[2]], stack: [] });
        note = `invokespecial ${ins.arg}: pop the arguments and a reference, then run the constructor with that reference as this.`;
        jumped = true;
      }
    } else if (op === "putfield") {
      const v = f.stack.pop() as number;
      const r = f.stack.pop() as { ref: number };
      const field = ins.c!.match(/Field (\w+):/)![1];
      heap[r.ref].fields[field] = v;
      touched = r.ref;
      note = `putfield ${ins.arg}: pop ${v} and the reference, write ${v} into this.${field}.`;
    } else {
      throw new Error(`unknown op ${op}`);
    }

    if (!jumped && frames.includes(f)) f.pc = nextPc(f.method, f.pc);
    const idx = snaps.length;
    snaps.push({
      frames: clone(frames),
      heap: clone(heap),
      ran,
      note: p.notes?.[idx] ?? note,
      wrote: frames[frames.length - 1] === f ? wrote : undefined,
      touched,
      result,
    });
  }
  if (p.notes?.[0]) snaps[0].note = p.notes[0];
  return snaps;
}
