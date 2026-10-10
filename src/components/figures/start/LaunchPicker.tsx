"use client";

import { useState } from "react";
import { Java, Row, Words } from "@/components/figures/basics/kit";

// the java 25 launch protocol (JEP 512): a main(String[]) wins over a main(),
// static or not. an instance main means the launcher creates the object first.
// the error text is the real one from `java Main.java` on jdk 25.

type Kind = "none" | "static" | "instance";

export function LaunchPicker() {
  const [withArgs, setWithArgs] = useState<Kind>("none");
  const [noArgs, setNoArgs] = useState<Kind>("instance");

  const decl = (k: Kind, params: string) =>
    k === "none" ? null : `${k === "static" ? "static " : ""}void main(${params}) { ... }`;
  const lines = [decl(withArgs, "String[] args"), decl(noArgs, "")].filter(Boolean) as string[];

  const pick: { k: Kind; params: string } | null =
    withArgs !== "none" ? { k: withArgs, params: "String[] args" } : noArgs !== "none" ? { k: noArgs, params: "" } : null;

  const opts = [
    { v: "none", label: "none" },
    { v: "static", label: "static" },
    { v: "instance", label: "instance" },
  ] as const;

  return (
    <div className="font-mono text-13">
      <Row k="main(String[]) =" w="17ch">
        <Words options={opts} value={withArgs} onChange={setWithArgs} label="main with String[] parameter" />
      </Row>
      <Row k="main() =" w="17ch">
        <Words options={opts} value={noArgs} onChange={setNoArgs} label="main with no parameters" />
      </Row>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]">
          <Java code="class Main {" />
          {"\n"}
          {lines.length === 0 && <span className="text-faint">{"    // no main at all\n"}</span>}
          {lines.map((l) => {
            const chosen = pick && l === decl(pick.k, pick.params);
            return (
              <span key={l} className={`-mx-4 block border-l-2 px-[14px] ${chosen ? "border-hot bg-[color-mix(in_srgb,var(--hot)_10%,transparent)]" : "border-transparent opacity-55"}`}>
                {"    "}
                <Java code={l} />
              </span>
            );
          })}
          <Java code="}" />
        </pre>

        <div aria-live="polite" className="grid content-start gap-2">
          <div className="text-11 text-faint">$ java Main.java</div>
          {pick ? (
            <ol className="grid gap-1.5 text-13">
              {pick.k === "instance" && (
                <li className="flex gap-2">
                  <span className="text-faint tabular">1.</span>
                  <span>
                    <span className="text-hi">new Main()</span> <span className="text-mute">(it&apos;s an instance method, so it needs an object)</span>
                  </span>
                </li>
              )}
              <li className="flex gap-2">
                <span className="text-faint tabular">{pick.k === "instance" ? "2." : "1."}</span>
                <span>
                  <span className="text-hot">
                    {pick.k === "instance" ? "obj." : "Main."}main({pick.params ? "args" : ""})
                  </span>{" "}
                  <span className="text-mute">
                    {withArgs !== "none" && noArgs !== "none"
                      ? "(the String[] one wins, always)"
                      : pick.k === "static"
                        ? "(static: no object needed)"
                        : ""}
                  </span>
                </span>
              </li>
            </ol>
          ) : (
            <div className="text-12 leading-[1.6] text-dead">error: can&apos;t find main(String[]) or main() method in class: Main</div>
          )}
        </div>
      </div>
    </div>
  );
}
