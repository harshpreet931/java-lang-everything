"use client";

import { useState } from "react";
import { NARR, ring, tint } from "./kit";

// what a data-binding library (Jackson's JsonMapper.readValue(json, Order.class)) matches up.
// a picture of the rules, not a run: jackson isn't part of the JDK.

type Key = "id" | "customer" | "items" | "name" | "qty" | "placed_at" | "coupon";

const NOTES: Record<Key, string> = {
  id: "number → long. matched by name: the JSON key \"id\" and the record component id.",
  customer: "string → String. same name, nothing to configure.",
  items: "array → List<Item>. the generic type survives in the record's component signature, so the library knows to build Items.",
  name: "inside each array element: a nested object → an Item, recursively.",
  qty: "number → int. a value too big for int is an error, not a silent overflow.",
  placed_at: "names differ (placed_at vs placedAt), so the record says @JsonProperty(\"placed_at\"). the string becomes an Instant (built into Jackson 3; a separate module in 2.x).",
  coupon: "no component called coupon. Jackson 2.x throws on unknown properties by default (FAIL_ON_UNKNOWN_PROPERTIES); Jackson 3 flipped that default and skips them. which one bites you depends on the version, so say what you want explicitly.",
};

const JSON_LINES: { t: string; k?: Key }[] = [
  { t: "{" },
  { t: '  "id": 42,', k: "id" },
  { t: '  "customer": "ada",', k: "customer" },
  { t: '  "items": [', k: "items" },
  { t: '    { "name": "chai", "qty": 2 },', k: "name" },
  { t: '    { "name": "samosa", "qty": 1 }', k: "qty" },
  { t: "  ],", k: "items" },
  { t: '  "placed_at": "2026-10-09T10:15:00Z",', k: "placed_at" },
  { t: '  "coupon": "CHAI10"', k: "coupon" },
  { t: "}" },
];

const JAVA_LINES: { t: string; k?: Key }[] = [
  { t: "record Order(" },
  { t: "    long id,", k: "id" },
  { t: "    String customer,", k: "customer" },
  { t: "    List<Item> items,", k: "items" },
  { t: '    @JsonProperty("placed_at")', k: "placed_at" },
  { t: "    Instant placedAt", k: "placed_at" },
  { t: ") {}" },
  { t: "" },
  { t: "record Item(String name, int qty) {}", k: "name" },
];

export function JsonMapping() {
  const [k, setK] = useState<Key>("placed_at");
  const line = (l: { t: string; k?: Key }, i: number, side: "json" | "java") => {
    const on = l.k === k || (k === "qty" && l.k === "name" && side === "java") || (k === "name" && l.k === "qty" && side === "json");
    const odd = on && k === "coupon";
    return (
      <button
        key={i}
        disabled={!l.k}
        onClick={() => l.k && setK(l.k)}
        className="block w-full rounded-[3px] px-1.5 text-left whitespace-pre transition-[background-color,color] duration-150 enabled:hover:bg-well-2"
        style={{
          background: on ? tint(odd ? "hot" : "ref", 14) : undefined,
          color: on ? (odd ? "var(--hot)" : "var(--ref)") : "var(--ink)",
        }}
      >
        {l.t || " "}
      </button>
    );
  };
  return (
    <div className="@container text-12">
      <div className="grid gap-4 @[560px]:grid-cols-2">
        <div className="rounded-md bg-well py-2 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="mb-1 px-3 text-11 text-faint">order.json</div>
          <div className="overflow-x-auto px-1.5">{JSON_LINES.map((l, i) => line(l, i, "json"))}</div>
        </div>
        <div className="rounded-md bg-well py-2 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]" style={{ boxShadow: ring("line") }}>
          <div className="mb-1 px-3 text-11 text-faint">Order.java</div>
          <div className="overflow-x-auto px-1.5">{JAVA_LINES.map((l, i) => line(l, i, "java"))}</div>
        </div>
      </div>
      <p className={`mt-4 ${NARR}`} aria-live="polite">
        <span className={k === "coupon" ? "text-hot" : "text-ref"}>{k}: </span>
        {NOTES[k]}
      </p>
    </div>
  );
}
