"use client";

import { useState } from "react";

// a class file as the Class-File API sees it: a tree of elements. the element types are
// what iterating ClassFile.of().parse(Gen.class) printed on jdk 25, and the listing is the
// real `javap -v` output for the same 148-byte class (constant pool left out).

const JAVAP = [
  "public class Gen",
  "  minor version: 0",
  "  major version: 69",
  "  flags: (0x0021) ACC_PUBLIC, ACC_SUPER",
  "  this_class: #2              // Gen",
  "  super_class: #6             // java/lang/Object",
  "  interfaces: 0, fields: 0, methods: 1, attributes: 0",
  "{",
  "  public static int sum(int);",
  "    descriptor: (I)I",
  "    flags: (0x0009) ACC_PUBLIC, ACC_STATIC",
  "    Code:",
  "      stack=2, locals=2, args_size=1",
  "         0: iconst_0",
  "         1: istore_1",
  "         2: iload_0",
  "         3: ifle          16",
  "         6: iload_1",
  "         7: iload_0",
  "         8: iadd",
  "         9: istore_1",
  "        10: iinc          0, -1",
  "        13: goto          2",
  "        16: iload_1",
  "        17: ireturn",
  "      StackMapTable: number_of_entries = 2",
  "        frame_type = 252 /* append */",
  "          offset_delta = 2",
  "          locals = [ int ]",
  "        frame_type = 13 /* same */",
  "}",
];

type Node = { depth: number; type: string; text: string; lines: number[]; match: string; computed?: boolean };

const NODES: Node[] = [
  { depth: 0, type: "ClassModel", text: "Gen", lines: [0, 4], match: "ClassModel cm = ClassFile.of().parse(bytes);" },
  { depth: 1, type: "AccessFlags", text: "public (0x0021)", lines: [3], match: "case AccessFlags f -> f.flags()" },
  { depth: 1, type: "ClassFileVersion", text: "69.0", lines: [1, 2], match: "case ClassFileVersion v -> v.majorVersion()" },
  { depth: 1, type: "Superclass", text: "java/lang/Object", lines: [5], match: "case Superclass s -> s.superclassEntry()" },
  { depth: 1, type: "Interfaces", text: "none", lines: [6], match: "case Interfaces i -> i.interfaces()" },
  { depth: 1, type: "MethodModel", text: "sum (I)I", lines: [8, 9], match: "case MethodModel m -> m.methodName()" },
  { depth: 2, type: "AccessFlags", text: "public static", lines: [10], match: "case AccessFlags f -> f.has(AccessFlag.STATIC)" },
  { depth: 2, type: "CodeModel", text: "stack=2, locals=2", lines: [11, 12], match: "case CodeModel code -> ..." },
  { depth: 3, type: "ConstantInstruction", text: "ICONST_0", lines: [13], match: "case ConstantInstruction c -> c.constantValue()" },
  { depth: 3, type: "StoreInstruction", text: "ISTORE_1", lines: [14], match: "case StoreInstruction s -> s.slot()" },
  { depth: 3, type: "LabelTarget", text: "loop", lines: [15], match: "case LabelTarget t -> t.label()" },
  { depth: 3, type: "LoadInstruction", text: "ILOAD_0", lines: [15], match: "case LoadInstruction l -> l.slot()" },
  { depth: 3, type: "BranchInstruction", text: "IFLE → done", lines: [16], match: "case BranchInstruction b -> b.target()" },
  { depth: 3, type: "LoadInstruction ×2", text: "ILOAD_1, ILOAD_0", lines: [17, 18], match: "case LoadInstruction l -> l.typeKind()" },
  { depth: 3, type: "OperatorInstruction", text: "IADD", lines: [19], match: "case OperatorInstruction o -> o.opcode()" },
  { depth: 3, type: "StoreInstruction", text: "ISTORE_1", lines: [20], match: "case StoreInstruction s -> s.slot()" },
  { depth: 3, type: "IncrementInstruction", text: "IINC 0, -1", lines: [21], match: "case IncrementInstruction i -> i.constant()" },
  { depth: 3, type: "BranchInstruction", text: "GOTO → loop", lines: [22], match: "case BranchInstruction b -> b.target()" },
  { depth: 3, type: "LabelTarget", text: "done", lines: [23], match: "case LabelTarget t -> t.label()" },
  { depth: 3, type: "LoadInstruction", text: "ILOAD_1", lines: [23], match: "case LoadInstruction l -> l.slot()" },
  { depth: 3, type: "ReturnInstruction", text: "IRETURN", lines: [24], match: "case ReturnInstruction r -> r.typeKind()" },
  {
    depth: 2,
    type: "StackMapTable",
    text: "computed for you",
    lines: [12, 25, 26, 27, 28, 29],
    match: "// not an element you write. max stack, max locals and\n// the stack map frames are computed when the class is built.",
    computed: true,
  },
];

export function ElementTree() {
  const [at, setAt] = useState(7);
  const n = NODES[at];
  const hl = new Set(n.lines);

  return (
    <div className="@container">
      <div className="grid gap-4 @[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">elements (click one)</div>
          <ul className="flex flex-col" role="listbox" aria-label="class file elements">
            {NODES.map((x, i) => {
              const on = i === at;
              return (
                <li key={i}>
                  <button
                    role="option"
                    aria-selected={on}
                    onClick={() => setAt(i)}
                    className="flex w-full items-baseline gap-2 rounded-xs py-[3px] pr-2 text-left text-12 transition-colors duration-150"
                    style={{
                      paddingLeft: `${0.5 + x.depth * 1.1}rem`,
                      background: on ? "var(--well-2)" : "transparent",
                      boxShadow: on ? "inset 0 0 0 1px var(--hot)" : undefined,
                    }}
                  >
                    <span style={{ color: x.computed ? "var(--live)" : x.depth === 3 ? "var(--ink)" : "var(--meta)" }}>{x.type}</span>
                    <span className="min-w-0 truncate text-11 text-faint">{x.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">javap -v Gen (real)</div>
          <pre className="overflow-x-auto rounded-md bg-well px-3 py-2 text-11 leading-[1.55] whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]">
            {JAVAP.map((l, i) => (
              <span key={i} className="block transition-colors duration-150" style={{ color: hl.has(i) ? (n.computed ? "var(--live)" : "var(--hot)") : "var(--mute)" }}>
                {l}
              </span>
            ))}
          </pre>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-11 text-faint">reading it, inside a switch over the elements</div>
        <pre className="overflow-x-auto rounded-md bg-well px-3 py-2 text-12 leading-[1.6] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
          {n.match}
        </pre>
      </div>
    </div>
  );
}
