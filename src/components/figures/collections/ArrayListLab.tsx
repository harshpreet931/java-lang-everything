"use client";

import { useRef, useState } from "react";
import { Console, Row, useReducedMotion, useTimers, useWidth } from "./kit";

// an ArrayList you can poke. the rules are the ones in jdk 25's ArrayList.java:
//   - new ArrayList<>() shares one empty array. the first add allocates 10 slots
//   - when size == elementData.length, grow: newLength(old, 1, old >> 1) = old + old/2
//     and Arrays.copyOf moves every element into the new array
//   - add(0, x) / remove(0) shift everything with System.arraycopy
// (checked with reflection on jdk 25: 0 → 10 → 15 → 22 → 33 → 49 → 73 ...)

type Cell = number | null;
type Op = { label: string; cost: number; grew: boolean };
type Grow = { old: Cell[]; cap: number; copied: number; done: boolean };

const MAX_CAP = 33;
const CELL = 30;

export function ArrayListLab() {
  const [data, setData] = useState<Cell[]>([]); // [] is the shared DEFAULTCAPACITY_EMPTY_ELEMENTDATA
  const [size, setSize] = useState(0);
  const [nextVal, setNextVal] = useState(1);
  const [ops, setOps] = useState<Op[]>([]);
  const [grow, setGrow] = useState<Grow | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [log, setLog] = useState<React.ReactNode>(
    <span className="text-faint">{"List<Integer> list = new ArrayList<>();\n// elementData = {}  (a shared empty array. nothing allocated yet)"}</span>,
  );
  const reduce = useReducedMotion();
  const t = useTimers();
  const busy = grow !== null && !grow.done;
  const [wrap, width] = useWidth<HTMLDivElement>(700);
  const perRow = Math.max(8, Math.floor(width / CELL));
  const live = useRef({ data, size });
  live.current = { data, size };

  const totals = ops.reduce(
    (a, o) => {
      if (o.label.startsWith("add")) {
        a.adds++;
        a.work += o.cost;
      }
      return a;
    },
    { adds: 0, work: 0 },
  );

  const record = (op: Op) => setOps((o) => [...o, op].slice(-48));

  /** make room for one more. returns the array to write into (maybe after an animated copy). */
  function ensure(then: (arr: Cell[], copies: number) => void) {
    const { data: d, size: s } = live.current;
    if (s < d.length) return then([...d], 0);
    if (d.length === 0) {
      // first add on a default-constructed list: allocate DEFAULT_CAPACITY, nothing to copy
      return then(Array(10).fill(null), 0);
    }
    const cap = d.length + (d.length >> 1);
    const fresh: Cell[] = Array(cap).fill(null);
    if (reduce) {
      for (let i = 0; i < s; i++) fresh[i] = d[i];
      setGrow({ old: d, cap, copied: s, done: true });
      t.after(900, () => setGrow(null));
      return then(fresh, s);
    }
    setGrow({ old: d, cap, copied: 0, done: false });
    setLog(
      <>
        <span className="text-faint">{`// size ${s} == elementData.length ${s}: no room\n`}</span>
        <span className="text-hot">{`Object[] bigger = new Object[${cap}];  // ${d.length} + (${d.length} >> 1)\n`}</span>
        <span className="say text-mute">{`copying ${s} references across, one by one...`}</span>
      </>,
    );
    const step = Math.max(18, Math.min(60, 700 / s));
    for (let i = 1; i <= s; i++) {
      t.after(220 + i * step, () => setGrow((g) => (g ? { ...g, copied: i } : g)));
    }
    t.after(220 + s * step + 140, () => {
      for (let i = 0; i < s; i++) fresh[i] = d[i];
      setGrow((g) => (g ? { ...g, done: true } : g));
      then(fresh, s);
      t.after(1100, () => setGrow(null));
    });
  }

  const addLast = () => {
    const v = nextVal;
    const s = size;
    const wasEmpty = data.length === 0;
    ensure((arr, copies) => {
      arr[s] = v;
      setData(arr);
      setSize(s + 1);
      setNextVal(v + 1);
      setHot(s);
      record({ label: "add", cost: 1 + copies, grew: copies > 0 || wasEmpty });
      setLog(
        copies > 0 ? (
          <>
            <span className="text-faint">{`list.add(${v});  // size ${s} == length ${s}: full\n`}</span>
            <span className="text-hot">{`elementData = Arrays.copyOf(elementData, ${arr.length});  // ${s} + (${s} >> 1)\n`}</span>
            <span className="say text-mute">{`copied ${copies} references, then wrote 1. this add cost ${copies + 1}.`}</span>
          </>
        ) : wasEmpty ? (
          <>
            <span className="text-faint">{`list.add(${v});  // first add\n`}</span>
            <span className="text-hot">{"elementData = new Object[10];  // DEFAULT_CAPACITY, allocated lazily\n"}</span>
            <span className="say text-mute">wrote 1. nothing to copy.</span>
          </>
        ) : (
          <>
            <span className="text-faint">{`list.add(${v});\n`}</span>
            <span className="text-ink">{`elementData[${s}] = ${v};  size = ${s + 1}\n`}</span>
            <span className="say text-mute">one write. O(1).</span>
          </>
        ),
      );
    });
  };

  const addFirst = () => {
    const v = nextVal;
    const s = size;
    ensure((arr, copies) => {
      for (let i = s; i > 0; i--) arr[i] = arr[i - 1];
      arr[0] = v;
      setData(arr);
      setSize(s + 1);
      setNextVal(v + 1);
      setHot(0);
      record({ label: "add(0)", cost: 1 + copies + s, grew: copies > 0 });
      setLog(
        <>
          <span className="text-faint">{`list.add(0, ${v});\n`}</span>
          {copies > 0 && <span className="text-hot">{`elementData = Arrays.copyOf(elementData, ${arr.length});  // full, grew first\n`}</span>}
          <span className="text-ink">{`System.arraycopy(elementData, 0, elementData, 1, ${s});\n`}</span>
          <span className="say text-mute">{`shifted ${s} element${s === 1 ? "" : "s"} right to make a hole at 0. O(n).`}</span>
        </>,
      );
    });
  };

  const removeFirst = () => {
    if (!size) return;
    const arr = [...data];
    const gone = arr[0];
    for (let i = 0; i < size - 1; i++) arr[i] = arr[i + 1];
    arr[size - 1] = null;
    setData(arr);
    setSize(size - 1);
    setHot(null);
    record({ label: "remove(0)", cost: size - 1, grew: false });
    setLog(
      <>
        <span className="text-faint">{`list.remove(0);  // → ${gone}\n`}</span>
        <span className="text-ink">{`System.arraycopy(elementData, 1, elementData, 0, ${size - 1});  elementData[${size - 1}] = null;\n`}</span>
        <span className="say text-mute">{`shifted ${size - 1} left. the capacity stays ${data.length}: ArrayList never shrinks on its own.`}</span>
      </>,
    );
  };

  const removeLast = () => {
    if (!size) return;
    const arr = [...data];
    const gone = arr[size - 1];
    arr[size - 1] = null;
    setData(arr);
    setSize(size - 1);
    setHot(null);
    record({ label: "removeLast", cost: 1, grew: false });
    setLog(
      <>
        <span className="text-faint">{`list.removeLast();  // → ${gone}\n`}</span>
        <span className="text-ink">{`elementData[${size - 1}] = null;  size = ${size - 1}\n`}</span>
        <span className="say text-mute">nothing moves. O(1). the slot is nulled so the GC can reclaim the element.</span>
      </>,
    );
  };

  const reset = () => {
    t.clear();
    setData([]);
    setSize(0);
    setNextVal(1);
    setOps([]);
    setGrow(null);
    setHot(null);
    setLog(<span className="text-faint">{"List<Integer> list = new ArrayList<>();\n// elementData = {}  (a shared empty array. nothing allocated yet)"}</span>);
  };

  const full = size >= MAX_CAP || (size === data.length && data.length + (data.length >> 1) > MAX_CAP);
  const cap = data.length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="list.">
          <button className="act solid" onClick={addLast} disabled={busy || full}>
            add({nextVal})
          </button>
          <button className="act" onClick={addFirst} disabled={busy || full}>
            add(0, {nextVal})
          </button>
          <button className="act" onClick={removeFirst} disabled={busy || !size}>
            remove(0)
          </button>
          <button className="act" onClick={removeLast} disabled={busy || !size}>
            removeLast()
          </button>
          <button className="act" onClick={reset}>
            reset
          </button>
        </Row>
        <Row k="state =" last>
          <span className="tabular text-mute">
            size <span className="text-hi">{size}</span>
            <span className="text-faint"> · </span>
            capacity <span className="text-hi">{cap}</span>
            <span className="text-faint"> · </span>
            free <span className="text-hi">{Math.max(0, cap - size)}</span>
          </span>
        </Row>
      </div>

      <div ref={wrap} className="min-w-0">
        {grow && (
          <ArrayRow
            label={`old elementData · Object[${grow.old.length}]`}
            cells={grow.old}
            size={grow.old.length}
            perRow={perRow}
            state={grow.done ? "dead" : "old"}
            copied={grow.copied}
          />
        )}
        {grow && !grow.done ? (
          <ArrayRow
            label={`new elementData · Object[${grow.cap}]  ← ${grow.old.length} + (${grow.old.length} >> 1)`}
            cells={Array.from({ length: grow.cap }, (_, i) => (i < grow.copied ? grow.old[i] : null))}
            size={grow.copied}
            perRow={perRow}
            state="new"
            copied={grow.copied}
          />
        ) : (
          <ArrayRow
            label={cap ? `elementData · Object[${cap}]` : "elementData · {} (shared, empty)"}
            cells={data}
            size={size}
            perRow={perRow}
            hot={hot}
            state="cur"
          />
        )}
      </div>

      <CostChart ops={ops} />

      <Console label="what ArrayList just did">{log}</Console>
      <div className="font-serif text-16 text-mute tabular">
        {totals.adds ? (
          <>
            {totals.adds} adds cost {totals.work} element writes in total →{" "}
            <span className="text-live">{(totals.work / totals.adds).toFixed(2)} per add</span>, on average. keep going forever and it levels off around 4. a constant.
          </>
        ) : (
          <span className="text-faint">add a few. watch the spikes, then watch the average.</span>
        )}
        {full && <span className="text-faint"> (the lab stops at {MAX_CAP} slots. the real one keeps going: 49, 73, 109, 163...)</span>}
      </div>
    </div>
  );
}

function ArrayRow({
  label,
  cells,
  size,
  perRow,
  state,
  copied = 0,
  hot,
}: {
  label: string;
  cells: Cell[];
  size: number;
  perRow: number;
  state: "cur" | "old" | "new" | "dead";
  copied?: number;
  hot?: number | null;
}) {
  const dead = state === "dead";
  return (
    <div className={`mb-4 ${state === "new" ? "obj-in" : ""}`}>
      <div className="mb-1.5 flex items-baseline gap-3 text-11">
        <span className={dead ? "text-dead" : state === "new" ? "text-hot" : "text-mute"}>{label}</span>
        {dead && <span className="text-dead">garbage now. nothing points at it.</span>}
      </div>
      {cells.length === 0 ? (
        <div className="flex h-[34px] w-[60px] items-center justify-center rounded-xs text-12 text-faint shadow-[inset_0_0_0_1px_var(--line-2)]">
          {"{}"}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(perRow, cells.length)}, ${CELL}px)` }}>
          {cells.map((v, i) => {
            const used = i < size;
            const isHot = hot === i;
            const copying = state === "old" && i === copied - 1;
            const justCopied = state === "new" && i === copied - 1;
            const tone = dead ? "dead" : isHot || justCopied || copying ? "hot" : null;
            return (
              <div key={i} className="mb-1 flex flex-col items-center">
                <div
                  className={`-ml-px flex h-[30px] w-full items-center justify-center text-12 tabular transition-[background-color,box-shadow,opacity] duration-150 ${
                    !used && state !== "old" && !dead ? "opacity-40" : ""
                  } ${dead ? "opacity-60" : ""}`}
                  style={{
                    boxShadow: `inset 0 0 0 1px ${tone ? `var(--${tone})` : "var(--line-2)"}`,
                    background: tone ? `color-mix(in srgb, var(--${tone}) 14%, transparent)` : undefined,
                    color: v === null ? "var(--faint)" : tone ? `var(--${tone})` : "var(--hi)",
                    zIndex: tone ? 1 : 0,
                  }}
                >
                  {v === null ? "·" : v}
                </div>
                <div className="mt-0.5 text-[9px] leading-3 text-faint tabular">{i}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CostChart({ ops }: { ops: Op[] }) {
  const W = 480;
  const Hh = 64;
  const n = 48;
  const max = Math.max(4, ...ops.map((o) => o.cost));
  const bw = W / n;
  // running average of adds only
  let adds = 0;
  let work = 0;
  const avg: [number, number][] = [];
  ops.forEach((o, i) => {
    if (o.label.startsWith("add")) {
      adds++;
      work += o.cost;
    }
    if (adds) avg.push([i * bw + bw / 2, Hh - (work / adds / max) * Hh]);
  });
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 text-11 text-faint">
        <span>cost of each operation (element writes + copies + shifts)</span>
        <span>
          <span className="text-hot">■</span> grew <span className="ml-2 text-ink">■</span> shifted <span className="ml-2 inline-block h-[2px] w-3 -translate-y-[3px] bg-live" /> average per add
        </span>
      </div>
      <svg fontFamily="var(--font-code)" viewBox={`0 0 ${W} ${Hh + 2}`} className="block h-[70px] w-full" preserveAspectRatio="none" role="img" aria-label="bar chart of the cost of each operation">
        <line x1={0} y1={Hh + 0.5} x2={W} y2={Hh + 0.5} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" />
        {ops.map((o, i) => {
          const h = Math.max(1.5, (o.cost / max) * Hh);
          return (
            <rect
              key={i}
              x={i * bw + 1}
              y={Hh - h}
              width={bw - 2}
              height={h}
              fill={o.grew ? "var(--hot)" : o.label === "add" || o.label === "removeLast" ? "var(--faint)" : "var(--ink)"}
            />
          );
        })}
        {avg.length > 1 && (
          <polyline points={avg.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--live)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}
