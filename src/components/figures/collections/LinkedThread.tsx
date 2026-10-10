"use client";

import { useId, useState } from "react";
import { Console, Row } from "./kit";
import { indexFor, javaHash, spread } from "./hashmapSim";

// a LinkedHashMap is a HashMap whose entries ALSO form a doubly linked list.
// new LinkedHashMap<>(8, 0.75f, accessOrder): table of 8, so six keys fit without a resize.
// bucket positions are the real ones (String.hashCode, spread, & 7), checked on jdk 25.
// access order: get, and put on an existing key, move the entry to the tail (afterNodeAccess).

const KEYS = ["bob", "dan", "ada", "eve", "cat", "tom"];
const N = 8;
const bucketOf = (k: string) => indexFor(spread(javaHash(k)), N);

// list = the linked list (iteration order). ins = order of insertion into the table, which is
// also each bucket's chain order (HashMap appends at the tail of a chain).
type S = { list: string[]; ins: string[] };
const init = (): S => ({ list: [...KEYS], ins: [...KEYS] });

export function LinkedThread() {
  const [access, setAccess] = useState(false);
  const [s, setS] = useState<S>(init);
  const [key, setKey] = useState("dan");
  const [moved, setMoved] = useState<string | null>(null);
  const [log, setLog] = useState<React.ReactNode>(
    <span className="text-faint">{"six puts, in this order: bob, dan, ada, eve, cat, tom."}</span>,
  );
  const uid = useId().replace(/:/g, "");

  const toEnd = (k: string) => setS((x) => ({ ...x, list: [...x.list.filter((y) => y !== k), k] }));

  const get = () => {
    if (!s.ins.includes(key)) {
      setLog(<span className="text-faint">{`map.get("${key}");  // → null. not in the map.`}</span>);
      setMoved(null);
      return;
    }
    if (access) {
      toEnd(key);
      setMoved(key);
      setLog(
        <>
          <span className="text-faint">{`map.get("${key}");\n`}</span>
          <span className="say text-hot">access order: unlink the entry, relink it at the tail. it&apos;s now the most recently used.</span>
        </>,
      );
    } else {
      setMoved(null);
      setLog(
        <>
          <span className="text-faint">{`map.get("${key}");\n`}</span>
          <span className="say text-ink">insertion order: reading changes nothing. the list stays put.</span>
        </>,
      );
    }
  };

  const put = () => {
    if (s.ins.includes(key)) {
      if (access) {
        toEnd(key);
        setMoved(key);
      } else setMoved(null);
      setLog(
        <>
          <span className="text-faint">{`map.put("${key}", 42);  // key already there\n`}</span>
          <span className={`say ${access ? "text-hot" : "text-ink"}`}>
            {access ? "access order: replacing the value counts as an access, so it moves to the tail." : "insertion order: re-putting an existing key keeps its original position."}
          </span>
        </>,
      );
      return;
    }
    setS((x) => ({ list: [...x.list, key], ins: [...x.ins, key] }));
    setMoved(key);
    setLog(
      <>
        <span className="text-faint">{`map.put("${key}", 42);  // new key\n`}</span>
        <span className="say text-ink">{`goes into bucket ${bucketOf(key)} like any HashMap entry, and gets appended at the tail of the list.`}</span>
      </>,
    );
  };

  const remove = () => {
    if (!s.ins.includes(key)) return;
    setS((x) => ({ list: x.list.filter((y) => y !== key), ins: x.ins.filter((y) => y !== key) }));
    setMoved(null);
    setLog(
      <>
        <span className="text-faint">{`map.remove("${key}");\n`}</span>
        <span className="say text-ink">unlinked twice: from its bucket&apos;s chain, and from the list (its neighbours get pointed at each other).</span>
      </>,
    );
  };

  const setMode = (a: boolean) => {
    setAccess(a);
    setS(init());
    setMoved(null);
    setLog(<span className="text-faint">{`new LinkedHashMap<>(8, 0.75f, ${a}), then the same six puts.`}</span>);
  };

  // ---- geometry
  const cw = 46;
  const pad = 14;
  const slotY = 26;
  const entY = 66;
  const eh = 24;
  const ew = 38;
  const stack: Record<number, number> = {};
  const pos: Record<string, { x: number; y: number }> = {};
  // entries are placed in their bucket in chain order (= the order they were first inserted)
  s.ins.forEach((k) => {
    const b = bucketOf(k);
    const depth = stack[b] ?? 0;
    stack[b] = depth + 1;
    pos[k] = { x: pad + b * cw + (cw - ew) / 2, y: entY + depth * (eh + 30) };
  });
  const maxDepth = Math.max(1, ...Object.values(stack));
  const vbW = pad * 2 + N * cw;
  // the list is drawn as a bus under the table: each link drops from its entry to its own
  // lane, runs across, and climbs into the next entry. readable even when it zigzags.
  const laneBase = entY + maxDepth * (eh + 30) - 14;
  const lane = (i: number) => laneBase + i * 7;
  const vbH = lane(Math.max(0, s.list.length - 1)) + 14;
  const r = 4;
  const depthOf: Record<string, number> = {};
  {
    const seen: Record<number, number> = {};
    s.ins.forEach((k) => {
      const b = bucketOf(k);
      depthOf[k] = seen[b] ?? 0;
      seen[b] = depthOf[k] + 1;
    });
  }
  const hasBelow = (k: string) => depthOf[k] < (stack[bucketOf(k)] ?? 0) - 1;
  // where a link attaches: the bottom, or (if another entry hangs below) the side margin
  // in and out links on the same side get separate tracks so they never overlap
  const port = (k: string, right: boolean, out: boolean) => {
    const p = pos[k];
    if (!hasBelow(k)) return { x: p.x + ew / 2 + (right ? 6 : -6), y: p.y + eh, edge: null as number | null };
    const off = out ? 9 : 3;
    return { x: right ? p.x + ew + off : p.x - off, y: p.y + eh / 2 + (out ? 5 : -5), edge: right ? p.x + ew : p.x };
  };
  const links = s.list.slice(1).map((k, i) => {
    const pa = pos[s.list[i]];
    const pb = pos[k];
    const key = `${s.list[i]}-${k}`;
    if (Math.abs(pa.x - pb.x) < 1) {
      const mx = pa.x + ew + 3;
      return { key, d: `M${pa.x + ew} ${pa.y + eh / 2 - 4} H ${mx} V ${pb.y + eh / 2 - 4} H ${pb.x + ew + 1}` };
    }
    const dir = pb.x > pa.x ? 1 : -1;
    const a = port(s.list[i], dir > 0, true);
    const b = port(k, dir < 0, false);
    const ly = lane(i);
    let d = a.edge !== null ? `M${a.edge} ${a.y} H ${a.x} ` : `M${a.x} ${a.y} `;
    d += `V ${ly - r} Q ${a.x} ${ly}, ${a.x + dir * r} ${ly} H ${b.x - dir * r} Q ${b.x} ${ly}, ${b.x} ${ly - r} `;
    d += b.edge !== null ? `V ${b.y} H ${b.edge + (dir < 0 ? 1 : -1)}` : `V ${b.y + 2}`;
    return { key, d };
  });
  const first = s.list[0];
  const last = s.list[s.list.length - 1];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="order =">
          <button className="word" aria-pressed={!access} onClick={() => setMode(false)}>
            insertion
          </button>
          <button className="word" aria-pressed={access} onClick={() => setMode(true)}>
            access
          </button>
        </Row>
        <Row k="key =">
          {KEYS.map((k) => (
            <button key={k} className="word" aria-pressed={key === k} onClick={() => setKey(k)} style={s.ins.includes(k) ? undefined : { opacity: 0.5 }}>
              {k}
            </button>
          ))}
        </Row>
        <Row k="map." last>
          <button className="act solid" onClick={get}>
            get(&quot;{key}&quot;)
          </button>
          <button className="act" onClick={put}>
            put(&quot;{key}&quot;, 42)
          </button>
          <button className="act" onClick={remove} disabled={!s.ins.includes(key)}>
            remove(&quot;{key}&quot;)
          </button>
          <button className="act" onClick={() => setMode(access)}>
            reset
          </button>
        </Row>
      </div>

      <svg fontFamily="var(--font-code)" viewBox={`0 0 ${vbW} ${vbH}`} className="block w-full max-w-[640px]" role="img" aria-label={`a hash table of 8 buckets, with the entries also linked in this order: ${s.list.join(", ")}`}>
        <defs>
          <marker id={`lt-${uid}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
          </marker>
        </defs>
        {/* table */}
        {Array.from({ length: N }, (_, j) => (
          <g key={j}>
            <text x={pad + j * cw + cw / 2} y={14} textAnchor="middle" fontSize={9} fill="var(--faint)">
              {j}
            </text>
            <rect x={pad + j * cw} y={slotY - 4} width={cw} height={24} fill="var(--bg)" stroke="var(--line-2)" />
            {stack[j] ? <circle cx={pad + j * cw + cw / 2} cy={slotY + 8} r={3} fill="var(--mute)" /> : <text x={pad + j * cw + cw / 2} y={slotY + 12} textAnchor="middle" fontSize={10} fill="var(--faint)">·</text>}
          </g>
        ))}
        {/* bucket chains (the HashMap part), drawn quietly */}
        {s.ins.map((k) => {
          const p = pos[k];
          return <line key={`c-${k}`} x1={p.x + ew / 2} y1={p.y - (p.y === entY ? 18 : 30)} x2={p.x + ew / 2} y2={p.y} stroke="var(--line-2)" />;
        })}
        {/* the linked list (the Linked part) */}
        {links.map((l) => (
          <path key={l.key} d={l.d} fill="none" stroke="var(--ref)" strokeWidth={1.4} markerEnd={`url(#lt-${uid})`} className="arrow-in" />
        ))}
        {s.ins.map((k) => {
          const p = pos[k];
          const isMoved = moved === k;
          const isSel = key === k;
          return (
            <g key={k}>
              <rect
                x={p.x}
                y={p.y}
                width={ew}
                height={eh}
                rx={2}
                fill="var(--bg)"
                stroke={isMoved ? "var(--hot)" : isSel ? "var(--ink)" : "var(--line-2)"}
                strokeWidth={isMoved ? 1.5 : 1}
              />
              <text x={p.x + ew / 2} y={p.y + 16} textAnchor="middle" fontSize={11} fill={isMoved ? "var(--hot)" : "var(--hi)"}>
                {k}
              </text>
              <text x={p.x + 3} y={p.y + 8} fontSize={7} fill="var(--ref)">
                {s.list.indexOf(k) + 1}
              </text>
            </g>
          );
        })}
        {first && (
          <text x={pos[first].x + ew / 2} y={pos[first].y - 4} textAnchor="middle" fontSize={9} fill="var(--ref)">
            head
          </text>
        )}
        {last && last !== first && (
          <text x={pos[last].x + ew / 2} y={pos[last].y - 4} textAnchor="middle" fontSize={9} fill="var(--ref)">
            tail
          </text>
        )}
      </svg>

      <div className="text-12 text-mute">
        <span className="text-faint">iteration order (head → tail): </span>
        <span className="text-hi">{s.list.join(" → ")}</span>
      </div>
      <Console label="what LinkedHashMap just did">{log}</Console>
    </div>
  );
}
