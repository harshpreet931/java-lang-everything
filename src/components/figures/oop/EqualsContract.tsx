"use client";

import { useState } from "react";

// the equals contract as a checklist. pick an implementation, see which promise it breaks,
// with the exact expressions that prove it. every probe below was run on jdk 25 (see the chapter).

type Check = { ok: boolean; probe: string };
type Impl = {
  id: string;
  label: string;
  code: string;
  checks: Record<"reflexive" | "symmetric" | "transitive" | "consistent" | "non-null", Check>;
  moral: string;
};

const IMPLS: Impl[] = [
  {
    id: "good",
    label: "a good one",
    code: `@Override
public boolean equals(Object o) {
    return o instanceof Point p
        && x == p.x && y == p.y;
}`,
    checks: {
      reflexive: { ok: true, probe: "a.equals(a) → true" },
      symmetric: { ok: true, probe: "a.equals(b) → true, b.equals(a) → true" },
      transitive: { ok: true, probe: "a=b, b=c → a.equals(c) → true" },
      consistent: { ok: true, probe: "only reads final fields, so the answer never changes" },
      "non-null": { ok: true, probe: "a.equals(null) → false  (instanceof is false for null)" },
    },
    moral: "instanceof pattern, compare the significant fields, done. a record writes exactly this for you.",
  },
  {
    id: "friendly",
    label: "friendly to String",
    code: `// CIString: a case-insensitive string
public boolean equals(Object o) {
    if (o instanceof CIString c)
        return s.equalsIgnoreCase(c.s);
    if (o instanceof String str)       // one-way
        return s.equalsIgnoreCase(str);
    return false;
}`,
    checks: {
      reflexive: { ok: true, probe: 'cis.equals(cis) → true' },
      symmetric: { ok: false, probe: 'cis.equals("polish") → true\n"polish".equals(cis) → false' },
      transitive: { ok: true, probe: "fine among CIStrings themselves" },
      consistent: { ok: true, probe: "only reads a final field" },
      "non-null": { ok: true, probe: "cis.equals(null) → false" },
    },
    moral: 'String has no idea CIString exists, so the friendship is one-way. the fallout: a List holding cis says list.contains("polish") is false, because List asks "polish".equals(cis).',
  },
  {
    id: "subclass",
    label: "subclass adds a field",
    code: `// ColorPoint extends Point, adds color
public boolean equals(Object o) {
    return o instanceof ColorPoint c
        && x == c.x
        && color.equals(c.color);
}`,
    checks: {
      reflexive: { ok: true, probe: "cp.equals(cp) → true" },
      symmetric: { ok: false, probe: "p.equals(cp) → true   (Point's equals: same x)\ncp.equals(p) → false  (p isn't a ColorPoint)" },
      transitive: { ok: true, probe: "fine among ColorPoints" },
      consistent: { ok: true, probe: "only reads final fields" },
      "non-null": { ok: true, probe: "cp.equals(null) → false" },
    },
    moral: "a plain Point and a ColorPoint disagree about whether they're equal. there's no way to extend an instantiable class with a new value field and keep the contract: prefer composition (a ColorPoint that has a Point).",
  },
  {
    id: "lenient",
    label: "ignore color vs Point",
    code: `// ColorPoint, take two: if o is a plain
// Point, compare as Points (ignore color)
public boolean equals(Object o) {
    if (!(o instanceof Point)) return false;
    if (!(o instanceof ColorPoint c))
        return o.equals(this);
    return x == c.x && color.equals(c.color);
}`,
    checks: {
      reflexive: { ok: true, probe: "red.equals(red) → true" },
      symmetric: { ok: true, probe: "red.equals(plain) → true, plain.equals(red) → true" },
      transitive: { ok: false, probe: "red.equals(plain) → true\nplain.equals(blue) → true\nred.equals(blue) → false" },
      consistent: { ok: true, probe: "only reads final fields" },
      "non-null": { ok: true, probe: "red.equals(null) → false" },
    },
    moral: "fixing symmetry broke transitivity. red equals plain, plain equals blue, red doesn't equal blue. same conclusion: don't add value fields in a subclass of a class with a meaningful equals.",
  },
  {
    id: "cast",
    label: "cast first",
    code: `public boolean equals(Object o) {
    Raw r = (Raw) o;      // no check
    return x == r.x;
}`,
    checks: {
      reflexive: { ok: true, probe: "r.equals(r) → true" },
      symmetric: { ok: true, probe: "fine among Raws" },
      transitive: { ok: true, probe: "fine among Raws" },
      consistent: { ok: true, probe: "only reads a final field" },
      "non-null": { ok: false, probe: 'r.equals(null) → NullPointerException\nr.equals("x") → ClassCastException' },
    },
    moral: "equals must return false for null and for unrelated types, never throw. collections call equals on whatever they're holding, mixed types included.",
  },
];

const RULES: { id: keyof Impl["checks"]; says: string }[] = [
  { id: "reflexive", says: "x.equals(x)" },
  { id: "symmetric", says: "x.equals(y) ⇔ y.equals(x)" },
  { id: "transitive", says: "x=y and y=z ⇒ x=z" },
  { id: "consistent", says: "same answer every time, if nothing changed" },
  { id: "non-null", says: "x.equals(null) is false" },
];

export function EqualsContract() {
  const [id, setId] = useState("friendly");
  const impl = IMPLS.find((i) => i.id === id)!;

  return (
    <div className="grid gap-5 text-13">
      <div className="grid grid-cols-[7ch_minmax(0,1fr)] items-start border-b border-line py-2">
        <span className="pt-1.5 text-faint">impl =</span>
        <div className="flex flex-wrap gap-1">
          {IMPLS.map((i) => (
            <button key={i.id} className="word" aria-pressed={i.id === id} onClick={() => setId(i.id)}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <pre className="overflow-x-auto rounded-md bg-well px-3.5 py-3 text-11 leading-[1.7] text-ink shadow-[inset_0_0_0_1px_var(--line)]">{impl.code}</pre>
        <div className="grid content-start" role="table" aria-label="the equals contract, checked">
          {RULES.map((r) => {
            const c = impl.checks[r.id];
            return (
              <div key={r.id} role="row" className="grid grid-cols-[2ch_minmax(0,1fr)] gap-x-2 border-b border-line py-1.5 first:pt-0">
                <span role="cell" className="text-14" style={{ color: c.ok ? "var(--live)" : "var(--dead)" }} aria-label={c.ok ? "holds" : "broken"}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <div role="cell" className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-12">
                    <span className={c.ok ? "text-hi" : "text-dead"}>{r.id}</span>
                    <span className="text-faint">{r.says}</span>
                  </div>
                  <div className={`mt-0.5 text-11 whitespace-pre-wrap ${c.ok ? "text-mute" : "text-dead"}`}>{c.probe}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="font-serif text-15 leading-[1.6] text-ink" aria-live="polite">
        {impl.moral}
      </p>
    </div>
  );
}
