"use client";

import { useState } from "react";
import { PANEL } from "./kit";

// one maven project, three small buggy classes, every tool on its DEFAULT configuration:
// error prone 2.50.0 (+ nullaway 0.14.2, jspecify mode), spotbugs 4.10.4 (plugin 4.10.4.1),
// pmd 7.17.0 (maven-pmd-plugin 3.28.0), checkstyle with google_checks.xml (plugin 3.6.0).
// jdk 25, maven 3.10.0. every message below is copied from that run (paths trimmed).

type Tool = "javac" | "errorprone" | "nullaway" | "spotbugs" | "pmd" | "checkstyle";
const TOOLS: { id: Tool; label: string; when: string }[] = [
  { id: "javac", label: "javac", when: "compile" },
  { id: "errorprone", label: "error prone", when: "compile" },
  { id: "nullaway", label: "nullaway", when: "compile" },
  { id: "spotbugs", label: "spotbugs", when: "bytecode" },
  { id: "pmd", label: "pmd", when: "source" },
  { id: "checkstyle", label: "checkstyle", when: "source" },
];

type Bug = { code: string; what: string; hits: Partial<Record<Tool, string>> };

const BUGS: Bug[] = [
  {
    code: "return id.equals(other); // Long vs Integer",
    what: "always false: a Long is never equal to an Integer",
    hits: {
      errorprone: "[EqualsIncompatibleType] Calling equals on incompatible types Long and Integer",
      spotbugs: "High: Call to Long.equals(Integer) in com.acme.Bugs.sameId(Long, Integer) EC_UNRELATED_TYPES",
    },
  },
  {
    code: "s.trim(); return s;",
    what: "strings are immutable, trim() returns a new one",
    hits: {
      errorprone: "[ReturnValueIgnored] Return value of 'trim' must be used. Did you mean 's = s.trim();'?",
      spotbugs: "High: Return value of String.trim() ignored in com.acme.Bugs.clean(String) RV_RETURN_VALUE_IGNORED",
      pmd: "Rule:UselessPureMethodCall Priority:3 Do not call pure method trim if the result is not used.",
    },
  },
  {
    code: 'new IllegalArgumentException("negative age");',
    what: "missing throw: the check checks nothing",
    hits: {
      errorprone: "[DeadException] Exception created but not thrown. Did you mean 'throw new IllegalArgumentException(...)'?",
      spotbugs: "High: new IllegalArgumentException(String) not thrown in com.acme.Bugs.check(int) RV_EXCEPTION_NOT_THROWN",
    },
  },
  {
    code: 'return role == "admin";',
    what: "compares references, not text",
    hits: {
      errorprone: "[ReferenceEquality] Comparison using reference equality instead of value equality. Did you mean 'return \"admin\".equals(role);'?",
      spotbugs: "Medium: Comparison of String parameter using == or != in com.acme.Bugs.isAdmin(String) ES_COMPARING_PARAMETER_STRING_WITH_EQ",
    },
  },
  {
    code: "return emailOf(user).length(); // @Nullable",
    what: "NullPointerException for any unknown user",
    hits: {
      nullaway: "[NullAway] dereferenced expression 'emailOf(user)' is @Nullable",
      spotbugs: "Medium: Possible null pointer dereference in com.acme.Users.emailLength(String) due to return value of called method NP_NULL_ON_SOME_PATH_FROM_RETURN_VALUE",
    },
  },
  {
    code: "FileInputStream in = new FileInputStream(path); return in.read();",
    what: "leaks a file handle on every call",
    hits: {
      spotbugs: "Medium: com.acme.Cart.readFirstByte(String) may fail to close stream OS_OPEN_STREAM",
    },
  },
  {
    code: "public int hashCode() { ... } // no equals()",
    what: "breaks the equals/hashCode contract",
    hits: {
      pmd: "Rule:OverrideBothEqualsAndHashcode Priority:3 Ensure you override both equals() and hashCode().",
    },
  },
  {
    code: 'public static final String[] CURRENCIES = {"USD", ...};',
    what: "final reference, mutable contents: anyone can change it",
    hits: {
      errorprone: "[MutablePublicArray] Non-empty arrays are mutable, so this `public static final` array is not a constant and can be modified by clients of this class.",
    },
  },
  {
    code: "private int total_items;",
    what: "not a bug, a naming convention",
    hits: {
      checkstyle: "Member name 'total_items' must match pattern '^[a-z][a-z0-9][a-zA-Z0-9]*$'. [MemberName]",
    },
  },
];

export function BugMatrix() {
  const [row, setRow] = useState(1);
  const [tool, setTool] = useState<Tool | null>("errorprone");
  const b = BUGS[row];
  const msg = tool ? b.hits[tool] : undefined;

  return (
    <div className="@container">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[430px] border-collapse font-mono text-12">
          <thead>
            <tr>
              <th className="pb-2 text-left font-normal text-faint">bug</th>
              {TOOLS.map((t) => (
                <th key={t.id} className="w-[11%] pb-2 text-center font-normal">
                  <span className="block text-mute">{t.label}</span>
                  <span className="block text-[10px] text-faint">{t.when}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUGS.map((bug, i) => (
              <tr key={i} className="border-t border-line-2" style={{ background: i === row ? "var(--well-2)" : undefined }}>
                <td className="py-1.5 pr-3">
                  <button className="block max-w-[15ch] truncate text-left text-ink hover:text-hi @[560px]:max-w-[34ch]" onClick={() => setRow(i)} title={bug.code}>
                    {bug.code}
                  </button>
                </td>
                {TOOLS.map((t) => {
                  const hit = !!bug.hits[t.id];
                  const sel = i === row && t.id === tool;
                  return (
                    <td key={t.id} className="py-1 text-center">
                      <button
                        onClick={() => (setRow(i), setTool(t.id))}
                        aria-label={`${t.label} on bug ${i + 1}: ${hit ? "caught" : "missed"}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-13 transition-[box-shadow] duration-150"
                        style={{
                          color: hit ? "var(--live)" : "var(--line-2)",
                          boxShadow: sel ? "inset 0 0 0 1px var(--hot)" : undefined,
                        }}
                      >
                        {hit ? "●" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`mt-4 p-4 ${PANEL}`} aria-live="polite">
        <div className="text-12 text-faint">
          {b.what}
        </div>
        <div className="mt-1 text-13 text-hi">{b.code}</div>
        <div className="mt-3 text-12 leading-[1.6]">
          <span className="text-faint">{tool ? TOOLS.find((t) => t.id === tool)!.label : "pick a tool"}: </span>
          {msg ? (
            <span style={{ color: "var(--live)" }}>{msg}</span>
          ) : (
            <span className="text-mute">{tool === "javac" ? "nothing. it compiled without a word." : "nothing. this tool, on its default rules, didn't flag it."}</span>
          )}
        </div>
      </div>
    </div>
  );
}
