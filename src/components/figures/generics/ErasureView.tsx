"use client";

import { useState } from "react";
import { CodePanel, Narrate, Row, Words, tint } from "../functional/kit";

// java source next to what javac 25 really wrote. the right side is `javap -c -s -p`
// output (constructors trimmed where they don't matter, column spacing tightened,
// the bridge flags line comes from javap -v). nothing on the right is made up.

type Focus = { id: string; label: string; src: number[]; bc: number[]; note: string };
type Tab = { id: string; label: string; file: string; cmd: string; src: string; bc: string[]; focus: Focus[] };

const TABS: Tab[] = [
  {
    id: "class",
    label: "a generic class",
    file: "Box.java",
    cmd: "javap -c -s -p Box.class",
    src: `class Box<T> {
    private T value;

    Box(T value) { this.value = value; }

    T get() { return value; }
}`,
    bc: [
      "class Box<T> {",
      "  private T value;",
      "    descriptor: Ljava/lang/Object;",
      "",
      "  Box(T);",
      "    descriptor: (Ljava/lang/Object;)V",
      "    Code:",
      "       0: aload_0",
      '       1: invokespecial #1  // Method java/lang/Object."<init>":()V',
      "       4: aload_0",
      "       5: aload_1",
      "       6: putfield      #7  // Field value:Ljava/lang/Object;",
      "       9: return",
      "",
      "  T get();",
      "    descriptor: ()Ljava/lang/Object;",
      "    Code:",
      "       0: aload_0",
      "       1: getfield      #7  // Field value:Ljava/lang/Object;",
      "       4: areturn",
      "}",
    ],
    focus: [
      { id: "field", label: "the field", src: [2], bc: [2, 3], note: "javap still prints private T value, because the class file keeps the generic signature as metadata. but the descriptor, the type the JVM actually uses, is Ljava/lang/Object;. T became Object." },
      { id: "ctor", label: "the constructor", src: [4], bc: [5, 6, 12], note: "the constructor takes an Object, and stores an Object. there is no Box<String> constructor, there's one Box constructor for every type argument." },
      { id: "get", label: "get()", src: [6], bc: [15, 16, 19, 20], note: "get returns Object, and no cast happens in here: the class has no idea what T is. the cast happens at the call site. look at the next tab." },
    ],
  },
  {
    id: "call",
    label: "a call site",
    file: "Main.java",
    cmd: "javap -c Main.class",
    src: `class Main {
    public static void main(String[] args) {
        Box<String> box = new Box<>("hi");
        String s = box.get();
        System.out.println(s.length());
    }
}`,
    bc: [
      "public static void main(java.lang.String[]);",
      "  Code:",
      "     0: new           #7   // class Box",
      "     3: dup",
      "     4: ldc           #9   // String hi",
      '     6: invokespecial #11  // Method Box."<init>":(Ljava/lang/Object;)V',
      "     9: astore_1",
      "    10: aload_1",
      "    11: invokevirtual #14  // Method Box.get:()Ljava/lang/Object;",
      "    14: checkcast     #18  // class java/lang/String",
      "    17: astore_2",
      "    18: getstatic     #20  // Field java/lang/System.out:Ljava/io/PrintStream;",
      "    21: aload_2",
      "    22: invokevirtual #26  // Method java/lang/String.length:()I",
      "    25: invokevirtual #30  // Method java/io/PrintStream.println:(I)V",
      "    28: return",
    ],
    focus: [
      { id: "new", label: "new Box<>(\"hi\")", src: [3], bc: [3, 4, 5, 6, 7], note: "new Box, not new Box<String>. the type argument is gone, and the constructor call passes \"hi\" as a plain Object." },
      { id: "get", label: "box.get()", src: [4], bc: [8, 9, 10, 11], note: "get hands back an Object (that's its descriptor), and the very next instruction is a checkcast to String. that's the cast you didn't write. javac proved it can't fail, so it's free to insert it." },
      { id: "len", label: "s.length()", src: [5], bc: [13, 14, 15], note: "after the checkcast it's a real String on the stack, so String.length() is called directly. generics cost one cast per read, nothing else." },
    ],
  },
  {
    id: "bound",
    label: "a bound",
    file: "Bounded.java",
    cmd: "javap -c -s -p Bounded.class",
    src: `class Bounded<T extends Number> {
    T n;

    double twice() { return n.doubleValue() * 2; }
}`,
    bc: [
      "class Bounded<T extends java.lang.Number> {",
      "  T n;",
      "    descriptor: Ljava/lang/Number;",
      "",
      "  double twice();",
      "    descriptor: ()D",
      "    Code:",
      "       0: aload_0",
      "       1: getfield      #7   // Field n:Ljava/lang/Number;",
      "       4: invokevirtual #13  // Method java/lang/Number.doubleValue:()D",
      "       7: ldc2_w        #19  // double 2.0d",
      "      10: dmul",
      "      11: dreturn",
      "}",
    ],
    focus: [
      { id: "field", label: "the field", src: [1, 2], bc: [2, 3], note: "a bounded T erases to its bound, not to Object. the field's descriptor is Ljava/lang/Number;." },
      { id: "call", label: "doubleValue()", src: [4], bc: [9, 10], note: "so calling a Number method needs no cast at all: the field already is a Number as far as the JVM knows. that's what the bound bought." },
    ],
  },
  {
    id: "bridge",
    label: "a bridge method",
    file: "Name.java",
    cmd: "javap -c -p Name.class",
    src: `record Name(String value) implements Comparable<Name> {
    public int compareTo(Name other) {
        return value.compareTo(other.value);
    }
}`,
    bc: [
      "public int compareTo(Name);",
      "  Code:",
      "     0: aload_0",
      "     1: getfield      #7   // Field value:Ljava/lang/String;",
      "     4: aload_1",
      "     5: getfield      #7   // Field value:Ljava/lang/String;",
      "     8: invokevirtual #13  // Method java/lang/String.compareTo:(Ljava/lang/String;)I",
      "    11: ireturn",
      "",
      "public int compareTo(java.lang.Object);",
      "  flags: (0x1041) ACC_PUBLIC, ACC_BRIDGE, ACC_SYNTHETIC",
      "  Code:",
      "     0: aload_0",
      "     1: aload_1",
      "     2: checkcast     #8   // class Name",
      "     5: invokevirtual #19  // Method compareTo:(LName;)I",
      "     8: ireturn",
    ],
    focus: [
      { id: "yours", label: "your compareTo", src: [2, 3, 4], bc: [1, 2, 3, 4, 5, 6, 7, 8], note: "your method, exactly as written: compareTo(Name). but Comparable<T>'s compareTo(T) erases to compareTo(Object), and in the bytecode a method taking Name doesn't override one taking Object." },
      { id: "bridge", label: "the bridge", src: [1], bc: [10, 11, 15, 16], note: "so javac writes a second method you never typed: compareTo(Object), flagged BRIDGE and SYNTHETIC. it casts to Name and calls yours. sort code that only knows Comparable calls this one, and lands in your code." },
    ],
  },
];

export function ErasureView() {
  const [tabId, setTabId] = useState("call");
  const tab = TABS.find((t) => t.id === tabId)!;
  const [fid, setFid] = useState<Record<string, string>>({});
  const f = tab.focus.find((x) => x.id === fid[tab.id]) ?? tab.focus[tab.id === "call" ? 1 : 0];

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="show =" w="7ch">
          <Words options={TABS.map((t) => ({ v: t.id, label: t.label }))} value={tabId} onChange={setTabId} label="example" />
        </Row>
        <Row k="look at" w="7ch" last>
          <Words options={tab.focus.map((x) => ({ v: x.id, label: x.label }))} value={f.id} onChange={(v) => setFid((o) => ({ ...o, [tab.id]: v }))} label="what to look at" />
        </Row>
      </div>

      <div className="grid gap-3">
        <CodePanel file={tab.file} code={tab.src} hot={f.src} className="self-start" />
        <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-9 items-center border-b border-line px-4 text-12 text-ink">
            <span className="mr-2 text-faint">$</span>
            {tab.cmd}
          </div>
          <pre className="overflow-x-auto py-3 text-11 leading-[1.75] @[560px]:text-12">
            {tab.bc.map((l, i) => {
              const on = f.bc.includes(i + 1);
              return (
                <div
                  key={`${tab.id}-${i}`}
                  className="min-w-max border-l-2 px-4 transition-colors duration-200 ease-jle"
                  style={{
                    borderColor: on ? "var(--hot)" : "transparent",
                    background: on ? tint("hot", 10) : undefined,
                    color: on ? "var(--hot)" : "var(--mute)",
                  }}
                >
                  {l || " "}
                </div>
              );
            })}
          </pre>
        </div>
      </div>

      <Narrate minH="4.6em">{f.note}</Narrate>
    </div>
  );
}
