"use client";

import { useState } from "react";

// a HashSet<Point> where Point overrides equals. toggle whether it also overrides hashCode.
// HashSet is a HashMap: bucket = (h ^ (h >>> 16)) & (table length - 1), 16 buckets to start.
// identity hash codes below are real values from one run on jdk 25 (temurin 25.0.4), one per new Point.
// Objects.hash(1, 2) = 994 = 0x3e2, which lands in bucket 2.

const IDENTITY = ["33cb5951", "4148db48", "282003e1", "7fad8c79", "71a794e5", "76329302"];
const bucketOf = (hex: string) => {
  const h = parseInt(hex, 16) | 0;
  return (h ^ (h >>> 16)) & 15;
};
const OVERRIDE = { hex: "3e2", bucket: 2 };

type Entry = { hex: string; bucket: number; n: number };
type Probe = { kind: "add" | "contains"; hex: string; bucket: number; found: boolean; equalsRan: boolean; n: number };

export function HashSetBuckets() {
  const [override, setOverride] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [made, setMade] = useState(0);
  const [probe, setProbe] = useState<Probe | null>(null);

  const fresh = () => {
    const n = made;
    const hex = override ? OVERRIDE.hex : IDENTITY[n % IDENTITY.length];
    return { n, hex, bucket: override ? OVERRIDE.bucket : bucketOf(hex) };
  };

  const act = (kind: "add" | "contains") => {
    const p = fresh();
    setMade(made + 1);
    // HashMap compares the full hash first, then calls equals: all our Points are (1, 2), so equals would say yes
    const sameHash = entries.find((e) => e.bucket === p.bucket && e.hex === p.hex);
    const found = !!sameHash;
    setProbe({ kind, hex: p.hex, bucket: p.bucket, found, equalsRan: found, n: p.n });
    if (kind === "add" && !found) setEntries([...entries, { hex: p.hex, bucket: p.bucket, n: p.n }]);
  };

  const reset = (o = override) => {
    setOverride(o);
    setEntries([]);
    setMade(0);
    setProbe(null);
  };

  const story = (() => {
    if (!probe) return "empty set. add a Point(1, 2), then ask if it contains a Point(1, 2).";
    const who = `new Point(1, 2) #${probe.n + 1}`;
    const h = override ? `hashCode() = Objects.hash(1, 2) = 0x${probe.hex}` : `hashCode() is Object's identity hash: 0x${probe.hex}`;
    const where = `bucket ${probe.bucket}.`;
    if (probe.kind === "add")
      return probe.found
        ? `${who}: ${h} → ${where} an entry with the same hash is there, and equals says yes. already in the set, nothing added. size stays ${entries.length}.`
        : `${who}: ${h} → ${where} ${entries.length > 1 ? "no entry with that hash, so it's added. a duplicate, as far as equals is concerned." : "stored."} size is ${entries.length}.`;
    return probe.found
      ? `contains(${who}): ${h} → ${where} same hash, equals says yes. true.`
      : `contains(${who}): ${h} → ${where} ${entries.some((e) => e.bucket === probe.bucket) ? "something's here, but its hash is different, so equals never runs." : "empty bucket."} false, even though an equal Point is in the set.`;
  })();

  return (
    <div className="grid gap-5 text-13">
      <div>
        <div className="grid grid-cols-[11ch_minmax(0,1fr)] items-center border-b border-line py-2">
          <span className="text-faint">hashCode =</span>
          <div className="flex flex-wrap gap-1">
            <button className="word" aria-pressed={!override} onClick={() => reset(false)}>
              inherited from Object
            </button>
            <button className="word" aria-pressed={override} onClick={() => reset(true)}>
              Objects.hash(x, y)
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-3">
          <button className="act solid" onClick={() => act("add")}>
            set.add(new Point(1, 2))
          </button>
          <button className="act" onClick={() => act("contains")} disabled={!entries.length}>
            set.contains(new Point(1, 2))
          </button>
          <button className="act" onClick={() => reset()} disabled={!probe}>
            reset
          </button>
          <span className="ml-auto text-12 text-faint tabular">
            size() = <span className="text-hi">{entries.length}</span>
          </span>
        </div>
      </div>

      {/* the table: 16 buckets */}
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" role="img" aria-label={`hash table with 16 buckets. entries in buckets ${entries.map((e) => e.bucket).join(", ") || "none"}`}>
        {Array.from({ length: 16 }, (_, b) => {
          const here = entries.filter((e) => e.bucket === b);
          const lit = probe?.bucket === b;
          const tone = lit ? (probe!.found ? "var(--live)" : probe!.kind === "contains" ? "var(--dead)" : "var(--hot)") : undefined;
          return (
            <div key={b} className="flex min-w-0 flex-col items-stretch gap-1">
              <div
                className="flex min-h-[64px] flex-col gap-1 rounded-md bg-well p-1 transition-[box-shadow] duration-200 ease-jle"
                style={{ boxShadow: `inset 0 0 0 1px ${tone ?? "var(--line-2)"}` }}
              >
                {here.map((e) => (
                  <div
                    key={e.n}
                    className="obj-in truncate rounded-sm px-1 py-0.5 text-center text-[10px] leading-tight text-hi"
                    style={{ boxShadow: "inset 0 0 0 1px var(--line-2)", background: "var(--well-2)" }}
                    title={`Point #${e.n + 1}, hash 0x${e.hex}`}
                  >
                    #{e.n + 1}
                    <span className="block text-faint">{e.hex.slice(-3)}</span>
                  </div>
                ))}
              </div>
              <span className={`text-center text-[10px] tabular ${lit ? "text-hi" : "text-faint"}`}>{b}</span>
            </div>
          );
        })}
      </div>

      <p className="min-h-[3.4em] font-serif text-15 leading-[1.6] text-ink" aria-live="polite">
        {story}
      </p>
    </div>
  );
}
