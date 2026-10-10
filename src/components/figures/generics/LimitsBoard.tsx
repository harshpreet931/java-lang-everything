"use client";

import { useState } from "react";
import { CodePanel, Narrate, ring, tint } from "../functional/kit";

// eight things generic code can't do. each error is what javac 25 prints for exactly
// that line (inside class Lim<T>, compiled with -Xlint:all). the workarounds compile.

type L = { id: string; label: string; bad: string; err: string[]; why: "erasure" | "primitives" | "static"; good: string; note: string };

const LIMITS: L[] = [
  {
    id: "new",
    label: "new T()",
    bad: "T make() { return new T(); }",
    err: ["error: unexpected type", "  required: class", "  found:    type parameter T"],
    why: "erasure",
    good: `static <T> List<T> fill(int n, Supplier<T> make) {
    List<T> out = new ArrayList<>();
    for (int i = 0; i < n; i++) out.add(make.get());
    return out;
}
fill(3, StringBuilder::new);`,
    note: "at run time there's no T to call a constructor on, it's erased to Object. so ask the caller for a way to make one: a Supplier<T> (usually a constructor reference)."
  },
  {
    id: "arr",
    label: "new T[n]",
    bad: "T[] arr() { return new T[10]; }",
    err: ["error: generic array creation"],
    why: "erasure",
    good: `static <T> T[] newArray(IntFunction<T[]> make, int n) {
    return make.apply(n);
}
String[] slots = newArray(String[]::new, 3);`,
    note: "an array has to know its element type when it's created (it checks every store against it). T isn't known at run time. take an IntFunction<T[]>, the way toArray(String[]::new) does, or keep an Object[] privately like ArrayList."
  },
  {
    id: "garr",
    label: "new List<String>[3]",
    bad: "List<String>[] lists = new List<String>[3];",
    err: ["error: generic array creation"],
    why: "erasure",
    good: `List<List<String>> lists = new ArrayList<>();
List<?>[] wild = new List<?>[3];      // legal, but you lose the type`,
    note: "the array would really be a List[], so its store check couldn't tell a List<String> from a List<Integer>. the next section shows exactly how that goes wrong. use a list of lists."
  },
  {
    id: "prim",
    label: "List<int>",
    bad: "List<int> counts;",
    err: ["error: unexpected type", "  required: reference", "  found:    int"],
    why: "primitives",
    good: `List<Integer> counts = new ArrayList<>();   // boxed
int[] raw = new int[100];                    // or an array
IntStream.range(0, 100).sum();               // or a primitive stream`,
    note: "type arguments must be reference types, because erased code stores everything as Object. so List<Integer> boxes every element, which costs memory and time. valhalla is the long-term fix."
  },
  {
    id: "inst",
    label: "o instanceof T",
    bad: "boolean is(Object o) { return o instanceof T; }",
    err: ["error: Object cannot be safely cast to T"],
    why: "erasure",
    good: `static <T> boolean is(Object o, Class<T> type) {
    return type.isInstance(o);
}`,
    note: "instanceof is a run-time check, and at run time T is gone. pass a Class<T> and ask it: Class objects do exist at run time."
  },
  {
    id: "cls",
    label: "T.class",
    bad: "Class<T> k = T.class;",
    err: ["error: cannot select from a type variable"],
    why: "erasure",
    good: `class Repo<T> {
    private final Class<T> type;
    Repo(Class<T> type) { this.type = type; }
}
new Repo<>(String.class);`,
    note: "same problem, same fix. a class literal needs a real class, and T isn't one. the caller knows the class, so let them pass it in: that's a type token."
  },
  {
    id: "stat",
    label: "static T",
    bad: "static T counter;",
    err: ["error: non-static type variable T cannot be referenced", "  from a static context"],
    why: "static",
    good: `static <T> Box<T> of(T value) {   // a generic method
    return new Box<>(value);
}`,
    note: "this one isn't about erasure: a static field is shared by every Box<String> and Box<Integer>, so it can't depend on T. static methods can declare their own type parameters."
  },
  {
    id: "exc",
    label: "generic exception",
    bad: "class Oops<T> extends Exception {}",
    err: ["error: a generic class may not extend java.lang.Throwable"],
    why: "erasure",
    good: `class Oops extends Exception {
    final Object detail;           // carry data in a field instead
    Oops(Object detail) { this.detail = detail; }
}`,
    note: "catch picks a block by checking the exception's class at run time. catch (Oops<String> e) and catch (Oops<Integer> e) would be indistinguishable, so javac bans generic exceptions altogether."
  },
];

const WHY = { erasure: "because of erasure", primitives: "because type arguments are references", static: "because statics are shared" } as const;

export function LimitsBoard() {
  const [id, setId] = useState("new");
  const l = LIMITS.find((x) => x.id === id)!;
  return (
    <div className="@container grid gap-4">
      <div className="grid grid-cols-2 gap-1.5 @[620px]:grid-cols-4" role="group" aria-label="limitation">
        {LIMITS.map((x) => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            aria-pressed={x.id === id}
            className="truncate rounded-md px-2.5 py-2 text-left text-12 transition-[box-shadow,background-color,color] duration-200 ease-jle"
            style={{
              boxShadow: ring(x.id === id ? "dead" : null, x.id === id ? 70 : 100),
              background: x.id === id ? tint("dead", 7) : "var(--bg)",
              color: x.id === id ? "var(--dead)" : "var(--ink)",
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <CodePanel file="Lim.java" code={l.bad} dead={[1]} nolines />
        <div
          className="overflow-x-auto rounded-md px-4 py-2.5 text-12 leading-[1.7] whitespace-pre text-dead"
          style={{ boxShadow: ring("dead", 45), background: tint("dead", 5) }}
          aria-live="polite"
        >
          {l.err.join("\n")}
        </div>
      </div>

      <div className="flex items-center gap-2 text-11 text-faint">
        <span>{WHY[l.why]}</span>
        <span className="h-px flex-1 bg-line" />
        <span className="text-live">what to do instead</span>
      </div>

      <CodePanel file="instead" code={l.good} live={[]} />
      <Narrate minH="4.6em">{l.note}</Narrate>
    </div>
  );
}
