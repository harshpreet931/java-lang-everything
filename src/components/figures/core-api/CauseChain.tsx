"use client";

import { useState } from "react";
import { Java, Narr } from "./kit";

// one failure (the database refuses the connection) travelling up three layers,
// handled four different ways. the "logs" column is what printStackTrace would show:
// the headline, then one "Caused by:" per link in the chain.

type Mode = "chain" | "drop" | "leak" | "swallow";

type Layer = { name: string; code: Record<Mode, string>; bad?: Partial<Record<Mode, boolean>> };

const LAYERS: Layer[] = [
  {
    name: "OrderController",
    code: {
      chain: "catch (CheckoutException e) → 503 + log(e)",
      drop: "catch (CheckoutException e) → 503 + log(e)",
      leak: "catch (SQLException e) → 503 + log(e)",
      swallow: "catch (Exception e) → 500 + log(e)",
    },
    bad: { leak: true },
  },
  {
    name: "CheckoutService",
    code: {
      chain: "throw new CheckoutException(id, e);",
      drop: "throw new CheckoutException(id);",
      leak: "Order checkout(long id) throws SQLException",
      swallow: "order.total()  // order is null",
    },
    bad: { drop: true, leak: true, swallow: true },
  },
  {
    name: "OrderRepository",
    code: {
      chain: "throw new DataAccessException(\"find order \" + id, e);",
      drop: "throw new DataAccessException(\"find order \" + id, e);",
      leak: "Order find(long id) throws SQLException",
      swallow: "catch (SQLException e) { return null; }",
    },
    bad: { leak: true, swallow: true },
  },
  {
    name: "JDBC driver",
    code: {
      chain: "throws SQLException: Connection refused",
      drop: "throws SQLException: Connection refused",
      leak: "throws SQLException: Connection refused",
      swallow: "throws SQLException: Connection refused",
    },
  },
];

const CHAINS: Record<Mode, { cls: string; msg: string; lost?: boolean }[]> = {
  chain: [
    { cls: "CheckoutException", msg: "checkout failed for order 42" },
    { cls: "DataAccessException", msg: "find order 42" },
    { cls: "SQLException", msg: "Connection refused" },
  ],
  drop: [{ cls: "CheckoutException", msg: "checkout failed for order 42" }, { cls: "(cause: null)", msg: "the SQLException is gone", lost: true }],
  leak: [{ cls: "SQLException", msg: "Connection refused" }],
  swallow: [{ cls: "NullPointerException", msg: 'Cannot invoke "Order.total()" because "order" is null' }],
};

const MODES: { v: Mode; label: string }[] = [
  { v: "chain", label: "translate + keep the cause" },
  { v: "drop", label: "translate, drop the cause" },
  { v: "leak", label: "let SQLException leak up" },
  { v: "swallow", label: "swallow it" },
];

const VERDICT: Record<Mode, string> = {
  chain:
    "each layer speaks its own language (the controller only knows about checkouts), and the log still reaches all the way down to the real problem: connection refused.",
  drop: "the controller gets a nice exception and a useless log. 'checkout failed' and nothing else. someone will spend an afternoon finding out it was the database.",
  leak: "it works, but now the web layer imports java.sql and every signature on the way says throws SQLException. move orders to a REST service and you rewrite all three layers.",
  swallow: "the repository pretended nothing happened. the failure surfaces one layer later as an NPE that says nothing about databases. the worst of all four.",
};

export function CauseChain() {
  const [mode, setMode] = useState<Mode>("chain");
  const chain = CHAINS[mode];
  const good = mode === "chain";

  return (
    <div className="@container grid gap-5 font-mono">
      <div className="flex flex-wrap gap-1" role="group" aria-label="how each layer handles it">
        {MODES.map((m) => (
          <button key={m.v} className="word text-left" aria-pressed={m.v === mode} onClick={() => setMode(m.v)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 @[660px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* the layers, top of the call stack first */}
        <ol className="grid min-w-0 content-start gap-1.5">
          {LAYERS.map((l, i) => {
            const bad = l.bad?.[mode];
            return (
              <li key={l.name} className="grid min-w-0 gap-1">
                <div
                  className="min-w-0 rounded-md px-3 py-2 transition-[box-shadow] duration-200"
                  style={{ boxShadow: `inset 0 0 0 1px ${bad ? "var(--dead)" : "var(--line-2)"}` }}
                >
                  <div className="text-11 text-faint">{l.name}</div>
                  <div className="mt-0.5 overflow-x-auto text-12 whitespace-pre">
                    <Java code={l.code[mode]} />
                  </div>
                </div>
                {i < LAYERS.length - 1 && (
                  <div className="pl-4 text-11 text-faint" aria-hidden>
                    ↑ calls down, failure comes up
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* what the controller ends up holding */}
        <div className="grid content-start gap-2">
          <div className="text-11 text-faint">what the controller catches</div>
          {chain.map((x, i) => (
            <div key={`${mode}-${i}`} className="grid gap-1">
              {i > 0 && (
                <div className="flex items-center gap-2 pl-4 text-11" style={{ color: x.lost ? "var(--dead)" : "var(--ref)" }}>
                  <span aria-hidden>↓</span> getCause()
                </div>
              )}
              <div
                className="obj-in rounded-md px-3 py-2"
                style={{
                  boxShadow: `inset 0 0 0 1px ${x.lost ? "var(--dead)" : i === chain.length - 1 && good ? "var(--hot)" : "var(--line-2)"}`,
                  opacity: x.lost ? 0.75 : 1,
                }}
              >
                <div className={`text-12 ${x.lost ? "text-dead" : "text-hi"}`}>{x.cls}</div>
                <div className={`text-11 ${x.lost ? "text-dead" : "text-mute"}`}>{x.msg}</div>
                {i === chain.length - 1 && good && <div className="mt-1 text-11 text-hot">root cause</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Narr>{VERDICT[mode]}</Narr>
    </div>
  );
}
