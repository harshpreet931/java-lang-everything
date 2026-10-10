"use client";

import { useState } from "react";
import { Java, Narr } from "./kit";

// where Optional belongs. the intent (from the JDK's own docs and its designers): a return type
// for "there might be no result". everything else here has a simpler, cheaper answer.

type Place = { id: string; where: string; code: string; ok: boolean; why: string; instead?: string };

const PLACES: Place[] = [
  {
    id: "ret",
    where: "return type of a lookup",
    code: "Optional<User> findById(long id)",
    ok: true,
    why: "the one job it was made for. the signature itself tells callers \"this can come back empty\", and the compiler won't let them use a User without deciding what to do when there isn't one.",
  },
  {
    id: "field",
    where: "a field",
    code: "private Optional<String> nickname;",
    ok: false,
    why: "the field can still be null (now there are three states), it costs an extra object per instance, and Optional isn't Serializable.",
    instead: "private String nickname;  // nullable\nOptional<String> nickname() { return Optional.ofNullable(nickname); }",
  },
  {
    id: "param",
    where: "a method parameter",
    code: "void send(Mail m, Optional<String> cc)",
    ok: false,
    why: "every caller has to wrap, and nothing stops them passing null anyway. the method gets harder to call and no safer.",
    instead: "void send(Mail m)\nvoid send(Mail m, String cc)",
  },
  {
    id: "list",
    where: "wrapping a collection",
    code: "Optional<List<Order>> orders()",
    ok: false,
    why: "a collection already has a way to say \"nothing\": being empty. now callers have to check twice.",
    instead: "List<Order> orders()   // List.of() when there are none",
  },
  {
    id: "elem",
    where: "inside a collection",
    code: "List<Optional<Order>>",
    ok: false,
    why: "a list of maybe-orders is just a list of orders with holes in it. drop the empties when you build it.",
    instead: "list.stream().flatMap(Optional::stream).toList()",
  },
  {
    id: "prim",
    where: "a primitive result",
    code: "OptionalInt max()",
    ok: true,
    why: "use OptionalInt, OptionalLong or OptionalDouble so the value isn't boxed. IntStream.max() returns exactly this.",
  },
];

export function OptionalWhere() {
  const [id, setId] = useState("field");
  const p = PLACES.find((x) => x.id === id)!;

  return (
    <div className="@container grid gap-4 font-mono">
      <div className="grid grid-cols-1 gap-1.5 @[520px]:grid-cols-2 @[760px]:grid-cols-3">
        {PLACES.map((x) => {
          const on = x.id === id;
          return (
            <button
              key={x.id}
              onClick={() => setId(x.id)}
              aria-pressed={on}
              className="min-w-0 rounded-md px-3 py-2 text-left transition-[box-shadow,background-color] duration-150"
              style={{
                boxShadow: `inset 0 0 0 1px ${on ? "var(--hi)" : "var(--line-2)"}`,
                background: on ? "var(--well-2)" : undefined,
              }}
            >
              <span className="flex items-baseline justify-between gap-2 text-11">
                <span className="text-faint">{x.where}</span>
                <span style={{ color: x.ok ? "var(--live)" : "var(--dead)" }}>{x.ok ? "yes" : "no"}</span>
              </span>
              <span className="mt-1 block truncate text-12">
                <Java code={x.code} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 border-t border-line pt-3">
        <Narr>{p.why}</Narr>
        {p.instead && (
          <div className="overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-pre shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="mb-1 text-11 text-live">instead</div>
            {p.instead.split("\n").map((l, k) => (
              <div key={k}>
                <Java code={l} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
