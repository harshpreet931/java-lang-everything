"use client";

import { useState, type ReactNode } from "react";
import { Java } from "@/components/figures/basics/kit";

// a method declaration, piece by piece. click a part.

type Part = "mods" | "ret" | "name" | "params" | "body" | "return";

const INFO: Record<Part, { title: string; text: ReactNode }> = {
  mods: {
    title: "modifiers",
    text: (
      <>
        <code>public</code>: any class can call it (more in <a href="/learn/oop/access-control">access control</a>). <code>static</code>: it belongs
        to the class, so you call it as <code>Main.max(3, 7)</code>, no object needed. both are optional.
      </>
    ),
  },
  ret: {
    title: "return type",
    text: (
      <>
        what the method hands back: one <code>int</code>. a method that returns nothing says <code>void</code>. it&apos;s checked at
        compile time: every path through the body must return an <code>int</code>.
      </>
    ),
  },
  name: { title: "name", text: <>a verb, in camelCase. together with the parameter types it forms the method&apos;s signature.</> },
  params: {
    title: "parameters",
    text: (
      <>
        the inputs, each with a type and a name. every call gets its own fresh copies in a new stack frame, filled with the
        arguments the caller passed. they&apos;re just local variables that start with a value.
      </>
    ),
  },
  body: { title: "body", text: <>the code that runs on every call. variables declared in here live in this call&apos;s frame, and die with it.</> },
  return: {
    title: "return",
    text: (
      <>
        ends the method right here and hands the value back to the caller. in a <code>void</code> method a bare{" "}
        <code>return;</code> just leaves early.
      </>
    ),
  },
};

export function MethodAnatomy() {
  const [sel, setSel] = useState<Part>("params");
  const [sig, setSig] = useState(false);

  const seg = (p: Part, code: string, inSig = false) => {
    const on = sel === p;
    const lit = sig && inSig;
    return (
      <button
        onClick={() => setSel(p)}
        onMouseEnter={() => setSel(p)}
        aria-pressed={on}
        className="rounded-[3px] px-0.5 transition-[background-color,box-shadow] duration-150"
        style={{
          background: on ? "color-mix(in srgb, var(--hot) 15%, transparent)" : lit ? "color-mix(in srgb, var(--meta) 12%, transparent)" : undefined,
          boxShadow: on ? "0 0 0 1px color-mix(in srgb, var(--hot) 55%, transparent)" : lit ? "0 0 0 1px color-mix(in srgb, var(--meta) 50%, transparent)" : undefined,
        }}
      >
        <Java code={code} />
      </button>
    );
  };

  return (
    <div className="font-mono text-13">
      <pre className="overflow-x-auto rounded-md bg-well px-4 py-4 text-13 leading-[2.1] shadow-[inset_0_0_0_1px_var(--line)] sm:text-14">
        <div className="whitespace-pre">
          {seg("mods", "public static")} {seg("ret", "int")} {seg("name", "max", true)}
          {seg("params", "(int a, int b)", true)} <Java code="{" />
        </div>
        <div className="whitespace-pre">
          {"    "}
          {seg("body", "int bigger = a > b ? a : b;")}
        </div>
        <div className="whitespace-pre">
          {"    "}
          {seg("return", "return bigger;")}
        </div>
        <div>
          <Java code="}" />
        </div>
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button className="word" aria-pressed={sig} onClick={() => setSig((x) => !x)}>
          show the signature
        </button>
        {sig && (
          <span className="text-12" style={{ color: "var(--meta)" }}>
            max(int, int)
            <span className="text-faint"> · name + parameter types. the return type isn&apos;t part of it.</span>
          </span>
        )}
      </div>
      <div className="mt-3 border-t border-line pt-3" aria-live="polite">
        <div className="text-12 text-hi">{INFO[sel].title}</div>
        <p className="mt-1 font-serif text-16 leading-[1.6] text-ink [&_a]:text-link [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi">
          {INFO[sel].text}
        </p>
      </div>
    </div>
  );
}
