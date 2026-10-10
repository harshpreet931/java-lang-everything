"use client";

import { useId, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Console, Java, Narrate, Row, Words, ring, tint, useReducedMotion } from "./kit";

// words dropping into groupingBy / partitioningBy buckets, one element at a time.
// bucket order is the iteration order of the real result (a HashMap for groupingBy),
// and every printed map here is exactly what jdk 25 prints for this input.

const WORDS = ["fig", "kiwi", "plum", "pear", "apple", "mango", "banana", "cherry", "avocado"];

type Cls = "length" | "first" | "partition";
type Down = "list" | "count" | "join";

const CLS: Record<Cls, { label: string; code: string; key: (w: string) => string; order: string[]; eager?: boolean }> = {
  length: { label: "by length", code: "groupingBy(String::length", key: (w) => String(w.length), order: ["3", "4", "5", "6", "7"] },
  // HashMap order for Character keys a..p with 16 buckets: 'p' (112) lands in bucket 0
  first: { label: "by first letter", code: "groupingBy(w -> w.charAt(0)", key: (w) => w[0], order: ["p", "a", "b", "c", "f", "k", "m"] },
  partition: { label: "partitioningBy", code: "partitioningBy(w -> w.length() > 4", key: (w) => String(w.length > 4), order: ["false", "true"], eager: true },
};

const DOWN: Record<Down, { label: string; code: string }> = {
  list: { label: "toList()", code: "" },
  count: { label: "counting()", code: ", counting()" },
  join: { label: 'joining("|")', code: ', joining("|")' },
};

const value = (d: Down, ws: string[], done: boolean) =>
  d === "list" ? `[${ws.join(", ")}]` : d === "count" ? String(ws.length) : done ? ws.join("|") : `"${ws.join("|")}"`;

export function BucketDrop() {
  const [cls, setCls] = useState<Cls>("length");
  const [down, setDown] = useState<Down>("list");
  return (
    <div className="grid gap-4">
      <div>
        <Row k="classify =" w="13ch">
          <Words options={(Object.keys(CLS) as Cls[]).map((v) => ({ v, label: CLS[v].label }))} value={cls} onChange={setCls} label="classifier" />
        </Row>
        <Row k="downstream =" w="13ch" last>
          <Words options={(Object.keys(DOWN) as Down[]).map((v) => ({ v, label: DOWN[v].label }))} value={down} onChange={setDown} label="downstream collector" />
        </Row>
      </div>
      <Run key={`${cls}-${down}`} cls={cls} down={down} />
    </div>
  );
}

function Run({ cls, down }: { cls: Cls; down: Down }) {
  const c = CLS[cls];
  const s = useStepper(WORDS.length + 2, { interval: 1100 });
  const reduce = useReducedMotion();
  const gid = useId();
  const dropped = Math.min(s.i, WORDS.length); // how many words are in buckets
  const finished = s.i === WORDS.length + 1;
  const current = s.i >= 1 && s.i <= WORDS.length ? WORDS[s.i - 1] : null;

  const buckets = new Map<string, string[]>();
  if (c.eager) c.order.forEach((k) => buckets.set(k, []));
  WORDS.slice(0, dropped).forEach((w) => {
    const k = c.key(w);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(w);
  });
  const keys = c.order.filter((k) => buckets.has(k));
  const printed = `{${c.order.map((k) => `${k}=${value(down, buckets.get(k) ?? [], true)}`).join(", ")}}`;

  const code = `words.stream().collect(${c.code}${DOWN[down].code}))`;
  const t = { duration: reduce ? 0 : 0.38, ease: [0.2, 0, 0, 1] as const };

  const note = finished
    ? cls === "partition"
      ? "done. partitioningBy always has exactly two keys, false and true, even if one side is empty."
      : cls === "first"
        ? "done. the result is a HashMap, so it prints in hash order: p comes first because 'p' happens to land in bucket 0. pass TreeMap::new if you need sorted keys."
        : "done. the result is a HashMap. small Integer keys happen to come out in order, but nothing promises that."
    : current
      ? `${current} → key ${c.key(current)}. ${
          c.eager ? "" : buckets.get(c.key(current))!.length === 1 ? "first time this key shows up, so a new bucket is created. " : ""
        }the downstream collector ${down === "list" ? "adds it to that bucket's list" : down === "count" ? "bumps that bucket's counter" : "appends it to that bucket's StringJoiner"}.`
      : c.eager
        ? "partitioningBy starts with both buckets already there."
        : "groupingBy starts with an empty map. buckets are created the first time a key shows up.";

  return (
    <div {...s.keys} className="grid gap-4 outline-none">
      <div className="overflow-x-auto text-13 whitespace-pre">
        <Java code={code} />
      </div>
      <LayoutGroup id={gid}>
        <div className="flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-md bg-bg/60 p-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="w-full text-11 text-faint">words</span>
          {WORDS.slice(dropped).map((w) => (
            <motion.span key={w} layoutId={`${gid}-${w}`} transition={t} className="rounded-sm px-1.5 text-12 leading-[22px] text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
              {w}
            </motion.span>
          ))}
          {dropped === WORDS.length && <span className="text-12 text-faint">(empty)</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 @container sm:grid-cols-3 md:grid-cols-4">
          {keys.map((k) => {
            const ws = buckets.get(k)!;
            const hot = current !== null && c.key(current) === k;
            return (
              <motion.div
                key={k}
                layout
                transition={t}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex min-h-[104px] flex-col gap-1.5 rounded-md bg-bg/60 p-2.5"
                style={{ boxShadow: hot ? ring("hot", 80) : ring(null) }}
              >
                <span className="flex items-baseline justify-between text-11">
                  <span className="text-faint">key</span>
                  <span className={hot ? "text-hot" : "text-hi"}>{k}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {ws.map((w) => (
                    <motion.span
                      key={w}
                      layoutId={`${gid}-${w}`}
                      transition={t}
                      className="rounded-sm px-1.5 text-12 leading-[22px]"
                      style={{
                        color: w === current ? "var(--hot)" : "var(--ink)",
                        background: w === current ? tint("hot", 14) : undefined,
                        boxShadow: w === current ? ring("hot", 60) : ring(null),
                        opacity: down === "list" ? 1 : 0.55,
                      }}
                    >
                      {w}
                    </motion.span>
                  ))}
                </div>
                <span className="mt-auto border-t border-line pt-1.5 text-11 break-all" style={{ color: "var(--meta)" }}>
                  {value(down, ws, false)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>

      <Console label="IO.println(result)" minH="1.7em">
        {finished ? <span className="text-hot">{printed}</span> : <span className="text-faint">·</span>}
      </Console>
      <Narrate>{note}</Narrate>
      <StepControls s={s} />
    </div>
  );
}
