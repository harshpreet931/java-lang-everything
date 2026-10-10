"use client";

import { useMemo, useState, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Java, Row, Words, ring, tint, tv } from "../functional/kit";

// a record pattern taking a Line(Point, Point) apart, one accessor call at a time.
// the order of calls is what javac 25 actually does (checked by logging from every
// accessor): at each level, call each component's accessor and test it against its
// pattern, left to right, stopping at the first failure; then descend into nested
// record patterns. variables are only bound once everything matched.

type XP = { k: "var"; name: string } | { k: "any" };
type CP = { k: "type"; name: string } | { k: "rec"; x: XP; y: XP } | { k: "any" };
type Pat = { k: "type"; name: string } | { k: "rec"; start: CP; end: CP };
type Pt = { x: number; y: number } | null;
type Val = { start: Pt; end: Pt };
type NodeId = "line" | "start" | "end" | "start.x" | "start.y" | "end.x" | "end.y";
type St = "hot" | "ok" | "fail" | "skip";
type Bind = { name: string; value: string; ref: boolean };
type Step = { states: Partial<Record<NodeId, St>>; log: string[]; binds: Bind[]; done?: "match" | "fail"; note: string };

const PATTERNS: { id: string; label: string; src: string; p: Pat }[] = [
  { id: "type", label: "Line l", src: "o instanceof Line l", p: { k: "type", name: "l" } },
  { id: "shallow", label: "Line(Point s, Point e)", src: "o instanceof Line(Point s, Point e)", p: { k: "rec", start: { k: "type", name: "s" }, end: { k: "type", name: "e" } } },
  {
    id: "deep",
    label: "Line(Point(var x1, var y1), Point(var x2, var y2))",
    src: "o instanceof Line(Point(var x1, var y1), Point(var x2, var y2))",
    p: { k: "rec", start: { k: "rec", x: { k: "var", name: "x1" }, y: { k: "var", name: "y1" } }, end: { k: "rec", x: { k: "var", name: "x2" }, y: { k: "var", name: "y2" } } },
  },
  {
    id: "unnamed",
    label: "Line(Point(var x, _), _)",
    src: "o instanceof Line(Point(var x, _), _)",
    p: { k: "rec", start: { k: "rec", x: { k: "var", name: "x" }, y: { k: "any" } }, end: { k: "any" } },
  },
];

const VALUES: { id: string; label: string; v: Val }[] = [
  { id: "full", label: "Line(Point(1, 2), Point(4, 6))", v: { start: { x: 1, y: 2 }, end: { x: 4, y: 6 } } },
  { id: "nullend", label: "Line(Point(1, 2), null)", v: { start: { x: 1, y: 2 }, end: null } },
];

const show = (p: Pt) => (p ? `Point[x=${p.x}, y=${p.y}]` : "null");
const lineStr = (v: Val) => `Line[start=${show(v.start)}, end=${show(v.end)}]`;

function steps(p: Pat, v: Val): Step[] {
  const out: Step[] = [];
  const states: Partial<Record<NodeId, St>> = {};
  const log: string[] = [];
  const binds: Bind[] = [];
  const push = (focus: NodeId | null, line: string, note: string, extra: Partial<Step> = {}) => {
    for (const k of Object.keys(states) as NodeId[]) if (states[k] === "hot") states[k] = "ok";
    if (focus) states[focus] = "hot";
    log.push(line);
    out.push({ states: { ...states }, log: [...log], binds: [...binds], note, ...extra });
  };
  const fail = (at: NodeId, note: string) => {
    for (const k of Object.keys(states) as NodeId[]) if (states[k] === "hot") states[k] = "ok";
    states[at] = "fail";
    out.push({ states: { ...states }, log: [...log, "→ no match, nothing is bound"], binds: [...binds], done: "fail", note });
  };

  push("line", "o instanceof Line   ✓", "first, the outer type test, exactly like instanceof: is o a Line (and not null)? it is.");
  if (p.k === "type") {
    binds.push({ name: p.name, value: lineStr(v), ref: true });
    out.push({ states: { line: "ok" }, log: [...log, `→ match: ${p.name} bound`], binds: [...binds], done: "match", note: "a plain type pattern stops there. no accessors are called; l is just a reference to the whole Line, and you dig into it yourself." });
    return out;
  }

  const comps: ["start" | "end", Pt, CP][] = [
    ["start", v.start, p.start],
    ["end", v.end, p.end],
  ];
  for (const [name, val, cp] of comps) {
    const got = `${name}() → ${show(val)}`;
    if (cp.k === "rec") {
      if (!val) {
        log.push(`${got}   ✗`);
        fail(name, `${name}() returned null, and a record pattern never matches null: there's nothing to take apart. matching stops right here.`);
        return out;
      }
      push(name, `${got}   ✓ a Point`, `call ${name}(), the accessor, and test the result against Point(...): it's a Point, not null. its insides are checked later.`);
    } else if (cp.k === "type") {
      binds.push({ name: cp.name, value: show(val), ref: true });
      push(name, `${got}   ✓ Point ${cp.name}`, val ? `call ${name}(). Point ${cp.name} is a type pattern for the component's own type, so it matches any Point.` : `call ${name}(), which returns null. Point ${cp.name} is the component's own type, so the pattern is unconditional and matches null too. ${cp.name} will be null.`);
    } else {
      states[name] = "skip";
      push(null, `${got}   _ matches anything`, `${name}() is still called, but _ matches whatever comes back${val ? "" : ", null included"}. nothing is tested and nothing is bound.`);
      states[name] = "skip";
      out[out.length - 1].states = { ...states };
    }
  }

  for (const [name, val, cp] of comps) {
    if (cp.k !== "rec" || !val) continue;
    for (const f of ["x", "y"] as const) {
      const xp = cp[f];
      const id = `${name}.${f}` as NodeId;
      if (xp.k === "var") {
        binds.push({ name: xp.name, value: String(val[f]), ref: false });
        push(id, `${name}.${f}() → ${val[f]}   var ${xp.name}`, `now inside: ${name}.${f}() returns ${val[f]}. var always matches, and will hold an int.`);
      } else {
        push(null, `${name}.${f}() → ${val[f]}   _`, `${name}.${f}() is called too, even though _ throws the result away.`);
        states[id] = "skip";
        out[out.length - 1].states = { ...states };
      }
    }
  }

  for (const k of Object.keys(states) as NodeId[]) if (states[k] === "hot") states[k] = "ok";
  out.push({ states: { ...states }, log: [...log, `→ match: ${binds.map((b) => b.name).join(", ")} bound`], binds: [...binds], done: "match", note: "every part matched, so now, and only now, all the variables are bound at once. one line of pattern did the work of a type test, a cast and a handful of accessor calls." });
  return out;
}

const COLOR: Record<St, string> = { hot: "var(--hot)", ok: "var(--live)", fail: "var(--dead)", skip: "var(--faint)" };

function Node({ st, children, className = "", label }: { st?: St; children: ReactNode; className?: string; label?: ReactNode }) {
  return (
    <div
      className={`rounded-md transition-[box-shadow,background-color,opacity] duration-200 ease-jle ${className}`}
      style={{
        boxShadow: st ? `inset 0 0 0 ${st === "hot" ? 2 : 1.5}px ${COLOR[st]}` : "inset 0 0 0 1px var(--line-2)",
        background: st === "hot" ? tint("hot", 10) : st === "fail" ? tint("dead", 8) : "var(--bg)",
        opacity: st === "skip" ? 0.5 : 1,
        borderStyle: st === "skip" ? "dashed" : undefined,
      }}
    >
      {label && <div className="px-2.5 pt-1.5 text-11 text-faint">{label}</div>}
      {children}
    </div>
  );
}

function PointBox({ p, prefix, states }: { p: Pt; prefix: "start" | "end"; states: Partial<Record<NodeId, St>> }) {
  if (!p)
    return (
      <Node st={states[prefix]} label={prefix} className="min-w-[9rem] flex-1">
        <div className="px-2.5 pt-1 pb-2.5 text-13 text-faint">null</div>
      </Node>
    );
  return (
    <Node st={states[prefix]} label={`${prefix}: Point`} className="min-w-[9rem] flex-1">
      <div className="flex gap-1.5 px-2.5 pt-1 pb-2.5">
        {(["x", "y"] as const).map((f) => (
          <Node key={f} st={states[`${prefix}.${f}` as NodeId]} className="flex-1">
            <div className="flex items-baseline justify-between gap-2 px-2 py-1 text-12">
              <span className="text-faint">{f}</span>
              <span className="text-hi tabular">{p[f]}</span>
            </div>
          </Node>
        ))}
      </div>
    </Node>
  );
}

export function Deconstruct() {
  const [pid, setPid] = useState("deep");
  const [vid, setVid] = useState("full");
  const pat = PATTERNS.find((x) => x.id === pid)!;
  const val = VALUES.find((x) => x.id === vid)!;
  const all = useMemo(() => steps(pat.p, val.v), [pat, val]);
  const key = `${pid}-${vid}`;
  return <Inner key={key} all={all} pat={pat} val={val} pid={pid} vid={vid} setPid={setPid} setVid={setVid} />;
}

function Inner({
  all,
  pat,
  val,
  pid,
  vid,
  setPid,
  setVid,
}: {
  all: Step[];
  pat: (typeof PATTERNS)[number];
  val: (typeof VALUES)[number];
  pid: string;
  vid: string;
  setPid: (v: string) => void;
  setVid: (v: string) => void;
}) {
  const s = useStepper(all.length, { interval: 1500 });
  const st = all[s.i];
  const final = st.done;

  return (
    <div {...s.keys} className="@container grid gap-4 outline-none">
      <div>
        <Row k="pattern" w="8ch">
          <Words options={PATTERNS.map((x) => ({ v: x.id, label: x.label }))} value={pid} onChange={setPid} label="pattern" />
        </Row>
        <Row k="o =" w="8ch" last>
          <Words options={VALUES.map((x) => ({ v: x.id, label: x.label }))} value={vid} onChange={setVid} label="value" />
        </Row>
      </div>

      <div className="overflow-x-auto rounded-md bg-bg px-4 py-3 text-12 whitespace-pre shadow-[inset_0_0_0_1px_var(--line-2)] @[560px]:text-13">
        <Java code={`if (${pat.src}) { ... }`} />
      </div>

      <div className="grid gap-3 @[680px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <div className="text-11 text-faint">the value, on the heap</div>
          <Node st={st.states.line} label="o: Line">
            <div className="flex flex-wrap gap-2 px-2.5 pt-1 pb-2.5">
              <PointBox p={val.v.start} prefix="start" states={st.states} />
              <PointBox p={val.v.end} prefix="end" states={st.states} />
            </div>
          </Node>
          <div className="mt-1 text-11 text-faint">variables</div>
          <div className="flex min-h-[28px] flex-wrap gap-1.5" aria-live="polite">
            {st.binds.length === 0 && <span className="text-12 text-faint">none yet</span>}
            {st.binds.map((b) => {
              const tone = final === "match" ? (b.ref ? "ref" : "live") : final === "fail" ? "dead" : "faint";
              return (
                <span
                  key={b.name}
                  className="inline-flex items-center gap-1.5 rounded-sm px-2 text-12 leading-[24px] transition-[box-shadow,color,opacity] duration-200"
                  style={{
                    boxShadow: ring(tone === "faint" ? null : tone, 60),
                    color: tv(tone),
                    textDecoration: final === "fail" ? "line-through" : undefined,
                  }}
                >
                  <span className="text-hi" style={{ color: final === "match" ? "var(--hi)" : undefined }}>
                    {b.name}
                  </span>
                  <span>{b.ref ? "→" : "="}</span>
                  <span>{b.value}</span>
                </span>
              );
            })}
          </div>
          {final !== "match" && st.binds.length > 0 && <div className="text-11 text-faint">(pending: bound only if everything matches)</div>}
        </div>

        <div className="grid content-start gap-2">
          <div className="text-11 text-faint">what runs</div>
          <pre className="min-h-[9.5em] overflow-x-auto rounded-md bg-well px-3.5 py-2.5 text-12 leading-[1.75] shadow-[inset_0_0_0_1px_var(--line)]">
            {st.log.map((l, i) => (
              <div
                key={i}
                style={{
                  color: l.startsWith("→ match") ? "var(--live)" : l.startsWith("→ no") || l.endsWith("✗") ? "var(--dead)" : i === st.log.length - 1 && !final ? "var(--hot)" : "var(--ink)",
                }}
              >
                {l}
              </div>
            ))}
          </pre>
        </div>
      </div>

      <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} />
    </div>
  );
}
