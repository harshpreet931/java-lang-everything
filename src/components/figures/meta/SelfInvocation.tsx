"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// why `this.audit()` skips @Transactional: the advice lives in the proxy, and `this` is the
// target, not the proxy. schematic (no spring on this site), but the behaviour is the one
// spring documents for proxy-based AOP.

type Mode = "outside" | "self" | "fixed";

const PATHS: Record<Mode, { proxy: boolean; place: boolean; audit: "proxied" | "bare" | "idle"; trace: string[]; note: string }> = {
  outside: {
    proxy: true,
    place: true,
    audit: "idle",
    trace: ["controller → proxy.placeOrder()", "proxy: begin transaction", "proxy → target.placeOrder()", "proxy: commit"],
    note: "the controller was injected with the proxy, not your object. so its call goes through the proxy, which wraps it in a transaction and then calls the real placeOrder.",
  },
  self: {
    proxy: false,
    place: true,
    audit: "bare",
    trace: ["target.placeOrder()", "this.audit()   // this == the target", "audit runs in placeOrder's transaction"],
    note: "inside placeOrder, this means the target object itself. a call on it is a plain java call that never leaves the object, so the proxy (and its REQUIRES_NEW) never hears about it. no error, no warning: the annotation is simply ignored.",
  },
  fixed: {
    proxy: true,
    place: true,
    audit: "proxied",
    trace: ["target.placeOrder()", "self.audit()   // self == the injected proxy", "proxy: begin NEW transaction", "proxy → target.audit()", "proxy: commit"],
    note: "the fix is to make the call go through a proxy: move audit() into another bean, or inject the proxy of yourself and call that. now the advice runs.",
  },
};

export function SelfInvocation() {
  const [mode, setMode] = useState<Mode>("outside");
  const p = PATHS[mode];
  const auditTone = p.audit === "proxied" ? "var(--live)" : p.audit === "bare" ? "var(--dead)" : "var(--line-2)";

  return (
    <div className="@container">
      <Row k="call =" w="6ch">
        <Words
          options={[
            { v: "outside", label: "from the controller" },
            { v: "self", label: "this.audit()" },
            { v: "fixed", label: "through the proxy" },
          ]}
          value={mode}
          onChange={setMode}
          label="which call"
        />
      </Row>

      <div className="mt-5 grid gap-4 @[600px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div
          className="rounded-md px-3 pt-2 pb-3 transition-[box-shadow,opacity] duration-200 ease-jle"
          style={{ boxShadow: `inset 0 0 0 1px ${p.proxy ? "var(--meta)" : "var(--line-2)"}`, opacity: p.proxy ? 1 : 0.85 }}
        >
          <div className="flex items-baseline justify-between gap-2 text-12">
            <span className="text-meta">OrderService proxy</span>
            <span className="text-11 text-faint">{p.proxy ? "transaction advice runs" : "never asked"}</span>
          </div>
          <div className="mt-2 rounded-md bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
            <div className="text-12 text-hi">OrderService (your object)</div>
            <div className="mt-2 flex flex-col gap-1.5 text-12">
              <div
                className="rounded-xs px-2 py-1"
                style={{ boxShadow: `inset 0 0 0 1px ${p.place ? "var(--hot)" : "var(--line-2)"}` }}
              >
                <span className="text-faint">@Transactional</span> placeOrder()
              </div>
              <div className="pl-3 text-11 text-faint">{mode === "outside" ? "" : mode === "self" ? "↓ this.audit()" : "↓ self.audit() leaves, re-enters via the proxy"}</div>
              <div className="rounded-xs px-2 py-1" style={{ boxShadow: `inset 0 0 0 1px ${auditTone}` }}>
                <span className="text-faint">@Transactional(REQUIRES_NEW)</span> audit()
              </div>
            </div>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-md bg-well px-3 py-2.5 text-12 leading-[1.7] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line)]">
          {p.trace.map((t, i) => (
            <span key={i} style={{ color: t.startsWith("proxy:") ? "var(--meta)" : t.startsWith("audit runs") ? "var(--dead)" : undefined }}>
              {t}
              {"\n"}
            </span>
          ))}
        </pre>
      </div>
      <p className="mt-4 min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {p.note}
      </p>
    </div>
  );
}
