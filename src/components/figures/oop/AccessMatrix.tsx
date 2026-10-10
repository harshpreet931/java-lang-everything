"use client";

import { useState } from "react";

// the access matrix: four modifiers × four places the access comes from.
// click a cell to see the exact two files and what javac says.
// every cell was compiled with javac 25 (temurin 25.0.4); the error text is copied from its output.

type Mod = "private" | "package" | "protected" | "public";
type Where = "class" | "package" | "subclass" | "world";
type Via = "this" | "sub" | "base";

const MODS: { id: Mod; label: string; kw: string }[] = [
  { id: "private", label: "private", kw: "private " },
  { id: "package", label: "(nothing)", kw: "" },
  { id: "protected", label: "protected", kw: "protected " },
  { id: "public", label: "public", kw: "public " },
];

const WHERE: { id: Where; label: string; long: string }[] = [
  { id: "class", label: "class", long: "same class" },
  { id: "package", label: "package", long: "same package" },
  { id: "subclass", label: "subclass", long: "subclass, other package" },
  { id: "world", label: "world", long: "anywhere else" },
];

const ERR = {
  private: "error: balance has private access in Account",
  package: "error: balance is not public in Account; cannot be accessed from outside package",
  protected: "error: balance has protected access in Account",
};

function result(m: Mod, w: Where, via: Via): string | null {
  if (m === "private") return w === "class" ? null : ERR.private;
  if (m === "package") return w === "class" || w === "package" ? null : ERR.package;
  if (m === "protected") {
    if (w === "world") return ERR.protected;
    if (w === "subclass" && via === "base") return ERR.protected;
    return null;
  }
  return null;
}

const owner = (kw: string, withSelf: boolean) =>
  [
    "package shop;",
    "",
    "public class Account {",
    `    ${kw}int balance;`,
    ...(withSelf ? ["", "    void self() {", "        balance = 1;", "    }"] : []),
    "}",
  ].join("\n");

function accessor(w: Where, via: Via): { file: string; src: string; line: number } | null {
  if (w === "class") return null;
  if (w === "package")
    return {
      file: "shop/Teller.java",
      src: ["package shop;", "", "class Teller {", "    void poke(Account acct) {", "        acct.balance = 1;", "    }", "}"].join("\n"),
      line: 5,
    };
  if (w === "subclass") {
    const sig = via === "this" ? "void poke()" : via === "sub" ? "void poke(Savings other)" : "void poke(Account other)";
    const use = via === "this" ? "this.balance = 1;" : "other.balance = 1;";
    return {
      file: "bank/Savings.java",
      src: ["package bank;", "", "import shop.Account;", "", "class Savings extends Account {", `    ${sig} {`, `        ${use}`, "    }", "}"].join("\n"),
      line: 7,
    };
  }
  return {
    file: "bank/Thief.java",
    src: ["package bank;", "", "import shop.Account;", "", "class Thief {", "    void poke(Account acct) {", "        acct.balance = 1;", "    }", "}"].join("\n"),
    line: 7,
  };
}

export function AccessMatrix() {
  const [mod, setMod] = useState<Mod>("protected");
  const [where, setWhere] = useState<Where>("subclass");
  const [via, setVia] = useState<Via>("this");

  const err = result(mod, where, via);
  const acc = accessor(where, via);
  const kw = MODS.find((m) => m.id === mod)!.kw;

  return (
    <div className="grid gap-6 text-13">
      {/* the matrix */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[330px] border-collapse font-mono text-12" aria-label="who can access a member, by modifier">
          <thead>
            <tr>
              <th className="pb-2 text-left font-mono font-normal text-faint">
                <span className="sr-only">modifier</span>
              </th>
              {WHERE.map((w) => (
                <th key={w.id} className="px-1 pb-2 text-center font-mono text-11 font-normal text-faint" scope="col">
                  <span className="sm:hidden">{w.label}</span>
                  <span className="hidden sm:inline">{w.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODS.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <th scope="row" className={`py-1 pr-2 text-left font-mono text-12 font-normal whitespace-nowrap ${mod === m.id ? "text-hi" : "text-mute"}`}>
                  {m.label}
                </th>
                {WHERE.map((w) => {
                  const ok = result(m.id, w.id, "this") === null;
                  const weird = m.id === "protected" && w.id === "subclass";
                  const on = mod === m.id && where === w.id;
                  return (
                    <td key={w.id} className="p-1">
                      <button
                        onClick={() => {
                          setMod(m.id);
                          setWhere(w.id);
                          setVia("this");
                        }}
                        aria-pressed={on}
                        aria-label={`${m.label} from ${w.long}: ${ok ? "compiles" : "compile error"}`}
                        className="flex h-9 w-full items-center justify-center rounded-md text-14 transition-[box-shadow,background-color] duration-150 ease-jle"
                        style={{
                          boxShadow: `inset 0 0 0 1px ${on ? "var(--hot)" : "var(--line-2)"}`,
                          background: on ? "color-mix(in srgb, var(--hot) 10%, transparent)" : "var(--well)",
                          color: ok ? "var(--live)" : "var(--dead)",
                        }}
                      >
                        {ok ? "✓" : "✗"}
                        {weird && <span className="ml-1 text-hot">*</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-11 text-faint">
          <span className="text-hot">*</span> only through a reference to your own class. click it.
        </p>
      </div>

      {/* the protected twist */}
      {mod === "protected" && where === "subclass" && (
        <div className="grid grid-cols-[7ch_minmax(0,1fr)] items-center border-y border-line py-2">
          <span className="text-faint">via =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={via === "this"} onClick={() => setVia("this")}>
              this.balance
            </button>
            <button className="word" aria-pressed={via === "sub"} onClick={() => setVia("sub")}>
              (Savings) other
            </button>
            <button className="word" aria-pressed={via === "base"} onClick={() => setVia("base")}>
              (Account) other
            </button>
          </div>
        </div>
      )}

      {/* the code */}
      <div className="grid gap-3">
        <div className={`grid gap-3 ${acc ? "md:grid-cols-2" : ""}`}>
          <Source file="shop/Account.java" src={owner(kw, !acc)} hot={[4]} mark={!acc ? 7 : undefined} bad={!!err && !acc} />
          {acc && <Source file={acc.file} src={acc.src} hot={[]} mark={acc.line} bad={!!err} />}
        </div>
        <div
          className="rounded-md bg-well px-4 py-2.5 text-12 shadow-[inset_0_0_0_1px_var(--line)]"
          aria-live="polite"
        >
          <span className="text-faint">$ javac </span>
          <span className="text-mute">shop/*.java{acc && acc.file.startsWith("bank") ? " bank/*.java" : ""}</span>
          <div className="mt-1" style={{ color: err ? "var(--dead)" : "var(--live)" }}>
            {err ?? "compiles. no output, which is javac for yes."}
          </div>
        </div>
      </div>
    </div>
  );
}

function Source({ file, src, hot, mark, bad }: { file: string; src: string; hot: number[]; mark?: number; bad: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-8 items-center border-b border-line px-3.5 text-12 text-ink">{file}</div>
      <pre className="overflow-x-auto py-2 text-12 leading-[1.7]">
        {src.split("\n").map((l, i) => {
          const n = i + 1;
          const isHot = hot.includes(n);
          const isMark = mark === n;
          const color = isMark ? (bad ? "var(--dead)" : "var(--live)") : isHot ? "var(--hot)" : undefined;
          return (
            <div
              key={i}
              className="grid grid-cols-[3ch_1fr] gap-x-3 border-l-2 pr-4"
              style={{
                borderColor: color ?? "transparent",
                background: color ? `color-mix(in srgb, ${color} 9%, transparent)` : undefined,
              }}
            >
              <span className="text-right text-faint/60 tabular">{n}</span>
              <span className="whitespace-pre" style={{ color: color ?? "var(--ink)" }}>
                {l || " "}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
