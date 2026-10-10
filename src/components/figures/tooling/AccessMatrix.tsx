"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// exports vs opens, measured: shop.app poking shop.orders.internal.Secret in all four
// configurations on jdk 25. messages are the real ones (identity hashes removed).

type Mode = "none" | "exports" | "opens" | "both";

const ROWS = [
  { what: "compile against it", code: "import shop.orders.internal.Secret;" },
  { what: "reflect on public members", code: 'c.getMethod("hello").invoke(null)' },
  { what: "deep reflection on private", code: 'm.setAccessible(true) // what jackson, hibernate, spring do' },
];

const OK: Record<Mode, [boolean, boolean, boolean]> = {
  none: [false, false, false],
  exports: [true, true, false],
  opens: [false, true, true],
  both: [true, true, true],
};

const WHY: Record<Mode, [string, string, string]> = {
  none: [
    "error: package shop.orders.internal is not visible",
    "IllegalAccessException: ... because module shop.orders does not export shop.orders.internal to module shop.app",
    'InaccessibleObjectException: Unable to make private static java.lang.String shop.orders.internal.Secret.hidden() accessible: module shop.orders does not "opens shop.orders.internal" to module shop.app',
  ],
  exports: [
    "compiles.",
    'prints "public method"',
    'InaccessibleObjectException: ... module shop.orders does not "opens shop.orders.internal" to module shop.app',
  ],
  opens: ["error: package shop.orders.internal is not visible", 'prints "public method"', 'prints "private method"'],
  both: ["compiles.", 'prints "public method"', 'prints "private method"'],
};

const DECL: Record<Mode, string> = {
  none: "// shop.orders.internal not mentioned",
  exports: "exports shop.orders.internal;",
  opens: "opens shop.orders.internal;",
  both: "exports shop.orders.internal;\nopens shop.orders.internal;",
};

export function AccessMatrix() {
  const [mode, setMode] = useState<Mode>("exports");
  const ok = OK[mode];
  return (
    <div className="@container">
      <Row k="module-info =" w="14ch" last>
        <Words
          label="what shop.orders declares for its internal package"
          options={[
            { v: "none" as Mode, label: "nothing" },
            { v: "exports" as Mode, label: "exports" },
            { v: "opens" as Mode, label: "opens" },
            { v: "both" as Mode, label: "both" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Row>
      <pre className="mt-2 mb-5 rounded-md bg-bg px-4 py-2.5 text-12 leading-[1.7] whitespace-pre text-hot shadow-[inset_0_0_0_1px_var(--line-2)]">
        {DECL[mode]}
      </pre>
      <ul className="grid gap-2" aria-live="polite">
        {ROWS.map((r, i) => (
          <li
            key={r.what}
            className="grid gap-x-4 gap-y-1 rounded-md bg-bg px-3 py-2.5 transition-[box-shadow] duration-200 ease-jle @[560px]:grid-cols-[3ch_22ch_minmax(0,1fr)]"
            style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--${ok[i] ? "live" : "dead"}) 40%, transparent)` }}
          >
            <span className="text-14" style={{ color: `var(--${ok[i] ? "live" : "dead"})` }} aria-label={ok[i] ? "allowed" : "refused"}>
              {ok[i] ? "✓" : "✗"}
            </span>
            <span className="text-13 text-hi">{r.what}</span>
            <span className="min-w-0 text-12 leading-[1.6]">
              <span className="block truncate text-mute">{r.code}</span>
              <span className="block break-words" style={{ color: ok[i] ? "var(--mute)" : "var(--dead)" }}>
                {WHY[mode][i]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
