"use client";

import { useState, type ReactNode } from "react";
import { Row, Term, Words } from "./kit";

// three real modules, compiled with javac 25 in every combination shown here.
// the error messages are copied from javac's output (paths shortened).

type Use = "money" | "tax";

export function ModuleGraph() {
  const [transitive, setTransitive] = useState(true);
  const [exportInternal, setExportInternal] = useState(false);
  const [use, setUse] = useState<Use>("money");

  const appReadsMoney = transitive;
  const ok = use === "money" ? appReadsMoney : exportInternal;

  const mainSrc =
    use === "money"
      ? `import shop.money.Money;\nimport shop.orders.api.Orders;\n...\nMoney m = Orders.total(1000);\nSystem.out.println(m);`
      : `import shop.orders.internal.Tax;\n...\nSystem.out.println(Tax.add(1000));`;

  const result = ok
    ? `$ javac -d mods --module-source-path src $(find src -name "*.java")\n$ java -p mods -m shop.app/shop.app.Main\n${use === "money" ? "$11.80" : "1180"}`
    : use === "money"
      ? `$ javac -d mods --module-source-path src $(find src -name "*.java")\nsrc/shop.app/shop/app/Main.java:2: error: package shop.money is not visible\nimport shop.money.Money;\n           ^\n  (package shop.money is declared in module shop.money, but module shop.app does not read it)\n1 error`
      : `$ javac -d mods --module-source-path src $(find src -name "*.java")\nsrc/shop.app/shop/app/Main.java:2: error: package shop.orders.internal is not visible\nimport shop.orders.internal.Tax;\n                  ^\n  (package shop.orders.internal is declared in module shop.orders, which does not export it)\n1 error`;

  const target = (pkg: "money" | "internal") =>
    (use === "money" && pkg === "money") || (use === "tax" && pkg === "internal") ? (ok ? "live" : "dead") : null;

  return (
    <div className="@container">
      <div className="mb-5">
        <Row k="orders =">
          <Words
            label="how shop.orders requires shop.money"
            options={[
              { v: "plain", label: "requires shop.money" },
              { v: "transitive", label: "requires transitive shop.money" },
            ]}
            value={transitive ? "transitive" : "plain"}
            onChange={(v) => setTransitive(v === "transitive")}
          />
        </Row>
        <Row k="exports =">
          <Words
            label="what shop.orders exports"
            options={[
              { v: "api", label: "shop.orders.api" },
              { v: "both", label: "api + internal" },
            ]}
            value={exportInternal ? "both" : "api"}
            onChange={(v) => setExportInternal(v === "both")}
          />
        </Row>
        <Row k="app uses =" last>
          <Words
            label="what shop.app imports"
            options={[
              { v: "money" as Use, label: "shop.money.Money" },
              { v: "tax" as Use, label: "shop.orders.internal.Tax" },
            ]}
            value={use}
            onChange={setUse}
          />
        </Row>
      </div>

      {/* the three modules */}
      <div className="grid gap-2 @[600px]:grid-cols-[minmax(0,1fr)_28px_minmax(0,1.15fr)_28px_minmax(0,1fr)] @[600px]:gap-0">
        <Mod name="shop.app" lines={["requires shop.orders;"]}>
          <div className="mt-2 text-11 text-faint">reads</div>
          <ul className="mt-1 grid gap-0.5 text-12">
            <li className="text-ref">→ shop.orders</li>
            <li
              className="transition-opacity duration-200 ease-jle"
              style={{ color: "var(--ref)", opacity: appReadsMoney ? 1 : 0.25, textDecoration: appReadsMoney ? undefined : "line-through" }}
            >
              ⇢ shop.money <span className="text-faint">{appReadsMoney ? "(implied)" : "(not read)"}</span>
            </li>
            <li className="text-faint">→ java.base (always)</li>
          </ul>
          <pre className="mt-3 overflow-x-auto border-t border-line pt-2 text-11 leading-[1.6] whitespace-pre text-mute">{mainSrc}</pre>
        </Mod>
        <Arrow />
        <Mod name="shop.orders" lines={[transitive ? "requires transitive shop.money;" : "requires shop.money;", "exports shop.orders.api;", ...(exportInternal ? ["exports shop.orders.internal;"] : [])]} hotLine={0}>
          <Pkg name="shop.orders.api" exported />
          <Pkg name="shop.orders.internal" exported={exportInternal} tone={target("internal")} />
        </Mod>
        <Arrow />
        <Mod name="shop.money" lines={["exports shop.money;"]}>
          <Pkg name="shop.money" exported tone={target("money")} />
        </Mod>
      </div>

      <div className="mt-5" aria-live="polite">
        <Term
          label={ok ? "compiles and runs" : "javac says no"}
          text={result}
          marks={{ "error:": "dead", "$11.80": "live", "1180": "live" }}
          minH="8.5em"
        />
      </div>
    </div>
  );
}

function Mod({ name, lines, children, hotLine }: { name: string; lines: string[]; children: ReactNode; hotLine?: number }) {
  return (
    <div className="min-w-0 rounded-md bg-bg p-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="text-13 text-hi">{name}</div>
      <div className="mt-1 grid gap-0.5 text-11 leading-[1.5]">
        {lines.map((l, i) => (
          <span key={l} className={i === hotLine ? "text-hot" : "text-mute"}>
            {l}
          </span>
        ))}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Pkg({ name, exported, tone }: { name: string; exported: boolean; tone?: "live" | "dead" | null }) {
  const c = tone ? `var(--${tone})` : exported ? "var(--line-2)" : "var(--line)";
  return (
    <div
      className="mt-1.5 flex items-baseline justify-between gap-2 rounded-sm px-2 py-1 text-12 transition-[box-shadow,background-color] duration-200 ease-jle"
      style={{
        boxShadow: `inset 0 0 0 1px ${c}`,
        background: tone ? `color-mix(in srgb, var(--${tone}) 10%, transparent)` : undefined,
      }}
    >
      <span className={`truncate ${exported ? "text-ink" : "text-faint"}`}>{name}</span>
      <span className="shrink-0 text-11" style={{ color: exported ? "var(--mute)" : "var(--faint)" }}>
        {exported ? "exported" : "hidden"}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-12 text-ref" aria-hidden>
      <span className="@[600px]:hidden">↓ reads</span>
      <span className="hidden w-full items-center @[600px]:flex">
        <span className="h-px flex-1 bg-ref" />
        <span className="-ml-1 text-[10px] leading-none">▶</span>
      </span>
    </div>
  );
}
