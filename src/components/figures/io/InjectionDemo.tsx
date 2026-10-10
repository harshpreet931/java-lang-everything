"use client";

import { useState } from "react";
import { NARR, Row, ring, tint } from "./kit";

// what the database receives when user input is glued into SQL, versus sent as a parameter.
// the concatenated strings are exactly what java's + produces (checked on jdk 25); the
// "escaped the quotes" test is simply: does the input contain a single quote.

const PRESETS = ["ada", "x' OR '1'='1", "'; DROP TABLE users; --"];

export function InjectionDemo() {
  const [name, setName] = useState(PRESETS[1]);
  const escapes = name.includes("'");
  // split the input at the first quote: the part before stays inside the string literal
  const q = name.indexOf("'");
  const inside = escapes ? name.slice(0, q) : name;
  const outside = escapes ? name.slice(q) : "";

  return (
    <div className="text-13">
      <Row k="name =" w="7ch">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          className="w-full min-w-0 border-b border-line-2 bg-transparent py-1 text-14 text-hi outline-none focus:border-hi"
          spellCheck={false}
          aria-label="what the user typed"
        />
      </Row>
      <Row k="try =" w="7ch" last>
        {PRESETS.map((p) => (
          <button key={p} className="word" aria-pressed={name === p} onClick={() => setName(p)}>
            {p}
          </button>
        ))}
      </Row>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-md p-3" style={{ boxShadow: ring(escapes ? "dead" : "line-2", escapes ? 70 : undefined) }}>
          <div className="mb-2 text-11 text-faint">string concatenation · what the database parses</div>
          <div className="text-12 leading-[1.8] break-all">
            <span className="text-mute">SELECT * FROM users WHERE name = &apos;</span>
            <span className="text-hi">{inside}</span>
            {outside && (
              <span className="rounded-[2px] px-0.5" style={{ color: "var(--dead)", background: tint("dead", 14) }}>
                {outside}
              </span>
            )}
            <span className="text-mute">&apos;</span>
          </div>
          <div className="mt-2 text-11" style={{ color: escapes ? "var(--dead)" : "var(--faint)" }}>
            {escapes ? "the quote closed the string. the rest is SQL now, written by the user." : "harmless this time. the code is only safe because nobody typed a quote."}
          </div>
        </div>
        <div className="rounded-md p-3" style={{ boxShadow: ring("live", 70) }}>
          <div className="mb-2 text-11 text-faint">PreparedStatement · sent separately</div>
          <div className="text-12 leading-[1.8]">
            <span className="text-mute">SELECT * FROM users WHERE name = </span>
            <span className="text-ref">?</span>
          </div>
          <div className="mt-1 text-12 break-all">
            <span className="text-faint">param 1 = </span>
            <span className="rounded-[2px] px-0.5" style={{ color: "var(--live)", background: tint("live", 12) }}>
              {JSON.stringify(name)}
            </span>
          </div>
          <div className="mt-2 text-11 text-faint">the SQL was parsed before the value arrived. the value can only ever be a value.</div>
        </div>
      </div>
      <p className={`mt-4 ${NARR}`} aria-live="polite">
        {name === PRESETS[1] ? (
          <>
            the filter becomes <code>name = &apos;x&apos; OR &apos;1&apos;=&apos;1&apos;</code>, which is true for every row. a login check built like this lets anyone in.
          </>
        ) : name === PRESETS[2] ? (
          <>
            the quote ends the string, the semicolon ends the statement, and <code>--</code> comments out the leftover quote. whether the second statement runs
            depends on the driver allowing multiple statements per call, which is exactly the kind of luck you don&apos;t want to depend on.
          </>
        ) : escapes ? (
          "any quote in the input lets the user rewrite your query."
        ) : (
          "type a quote somewhere and watch the left side."
        )}
      </p>
    </div>
  );
}
