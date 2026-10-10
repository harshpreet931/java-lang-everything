"use client";

import { useState } from "react";
import { CodePanel, Row, Words } from "./kit";

// three ways to make a Function/Runnable, and what each turns into on jdk 25.
// "in Shout.class" is real javap -c -p output (trimmed); "at run time" is the real
// hidden class, dumped with -Djdk.invoke.LambdaMetafactory.dumpProxyClassFiles and
// disassembled. identity checked with == in a loop: non-capturing lambdas came back
// as the same object every time, capturing ones as a new object every time.

type K = "plain" | "capturing" | "anon";

const DATA: Record<
  K,
  { src: string; javac: string; javacHot: number[]; runtime: string; runtimeFile: string; files: string; perEval: string; tone: "live" | "hot" | "ink" }
> = {
  plain: {
    src: `Function<String, String> up =
    s -> s.toUpperCase();`,
    javac: `// main():
invokedynamic #0:apply:()Function

// a new private method, holding the body
private static String lambda$main$0(String s) {
    return s.toUpperCase();
}`,
    javacHot: [2, 5],
    runtimeFile: "Shout$$Lambda (hidden class)",
    runtime: `final class Shout$$Lambda implements Function {
    private Shout$$Lambda() { super(); }

    public Object apply(Object s) {
        return Shout.lambda$main$0((String) s);
    }
}`,
    files: "Shout.class only",
    perEval: "the call site is linked to one pre-built instance. every evaluation returns the same object: no allocation, ever.",
    tone: "live",
  },
  capturing: {
    src: `String bang = "!";
Function<String, String> loud =
    s -> s.toUpperCase() + bang;`,
    javac: `// main():
aload_2                        // bang
invokedynamic #1:apply:(String)Function

// the captured value becomes the first parameter
private static String lambda$main$1(String bang, String s) {
    return s.toUpperCase() + bang;
}`,
    javacHot: [2, 3, 6],
    runtimeFile: "Shout$$Lambda (hidden class)",
    runtime: `final class Shout$$Lambda implements Function {
    private final String arg$1;     // the captured bang

    private Shout$$Lambda(String a) { arg$1 = a; }

    public Object apply(Object s) {
        return Shout.lambda$main$1(arg$1, (String) s);
    }
}`,
    files: "Shout.class only",
    perEval: "the call site is linked to the constructor. every evaluation allocates a new object holding the captured value (unless the JIT's escape analysis removes it).",
    tone: "hot",
  },
  anon: {
    src: `Runnable anon = new Runnable() {
    public void run() { System.out.println("anon"); }
};`,
    javac: `// main():
new           Shout$1
dup
invokespecial Shout$1.<init>()

// plus a whole extra file on disk: Shout$1.class`,
    javacHot: [2, 6],
    runtimeFile: "Shout$1.class (a real class file)",
    runtime: `class Shout$1 implements Runnable {
    Shout$1() { super(); }

    public void run() {
        System.out.println("anon");
    }
}`,
    files: "Shout.class + Shout$1.class",
    perEval: "plain old new: every evaluation allocates, the class is loaded from disk like any other, and in an instance method it's handed the enclosing this.",
    tone: "ink",
  },
};

export function LambdaAnatomy() {
  const [k, setK] = useState<K>("plain");
  const d = DATA[k];
  return (
    <div className="@container text-13">
      <Row k="you write =" w="11ch" last>
        <Words
          label="kind"
          value={k}
          onChange={setK}
          options={[
            { v: "plain", label: "lambda, captures nothing" },
            { v: "capturing", label: "lambda, captures a local" },
            { v: "anon", label: "anonymous class" },
          ]}
        />
      </Row>
      <div className="mt-2 grid gap-3">
        <CodePanel file="Shout.java" code={d.src} />
        <div className="grid gap-3">
          <CodePanel file={<>javac puts in <span className="text-faint">Shout.class</span></>} code={d.javac} hot={d.javacHot} nolines />
          <CodePanel file={<>at run time: <span className="text-faint">{d.runtimeFile}</span></>} code={d.runtime} nolines />
        </div>
        <div className="grid gap-1 rounded-md bg-bg px-3.5 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
          <div>
            <span className="text-faint">files on disk: </span>
            <span className="text-ink">{d.files}</span>
          </div>
          <div>
            <span className="text-faint">each evaluation: </span>
            <span style={{ color: `var(--${d.tone})` }}>{d.perEval}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
