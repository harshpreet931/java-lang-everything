"use client";

import { useState } from "react";
import { Console, Row, useReducedMotion, useTimers } from "./kit";

// the 6-line LRU cache from the chapter, run by hand: an access-ordered LinkedHashMap
// whose removeEldestEntry says size() > 3. put runs afterNodeInsertion → removeEldestEntry(head).

const KEYS = ["a", "b", "c", "d", "e"];
const CAP = 3;
type E = { k: string; v: number };

export function LruLab() {
  const [list, setList] = useState<E[]>([]); // eldest first
  const [ghost, setGhost] = useState<E | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [next, setNext] = useState(1);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [log, setLog] = useState<React.ReactNode>(<span className="text-faint">{"var cache = new Lru<String, Integer>(3);"}</span>);
  const t = useTimers();
  const reduce = useReducedMotion();

  const get = (k: string) => {
    t.clear();
    setGhost(null);
    const e = list.find((x) => x.k === k);
    if (!e) {
      setMisses(misses + 1);
      setHot(null);
      setLog(
        <>
          <span className="text-faint">{`cache.get("${k}");  // → null\n`}</span>
          <span className="say text-dead">miss.</span> <span className="say text-mute">a real cache would now load it and put it.</span>
        </>,
      );
      return;
    }
    setHits(hits + 1);
    setList([...list.filter((x) => x.k !== k), e]);
    setHot(k);
    setLog(
      <>
        <span className="text-faint">{`cache.get("${k}");  // → ${e.v}\n`}</span>
        <span className="say text-live">hit.</span> <span className="say text-ink">moved to the newest end. it&apos;s the last one that will be evicted now.</span>
      </>,
    );
  };

  const put = (k: string) => {
    t.clear();
    const v = next;
    setNext(v + 1);
    const had = list.find((x) => x.k === k);
    let l = [...list.filter((x) => x.k !== k), { k, v }];
    let evicted: E | null = null;
    if (!had && l.length > CAP) {
      evicted = l[0];
      l = l.slice(1);
    }
    setList(l);
    setHot(k);
    setGhost(evicted);
    if (evicted) t.after(reduce ? 10 : 1400, () => setGhost(null));
    setLog(
      <>
        <span className="text-faint">{`cache.put("${k}", ${v});  // → ${had ? had.v : "null"}\n`}</span>
        {had ? (
          <span className="say text-ink">already cached: value replaced, and it counts as an access, so it moves to the newest end.</span>
        ) : evicted ? (
          <>
            <span className="say text-ink">{`appended at the newest end. size is now ${CAP + 1}, so removeEldestEntry("${evicted.k}") returns true\n`}</span>
            <span className="say text-dead">{`and "${evicted.k}" (the least recently used) is evicted.`}</span>
          </>
        ) : (
          <span className="say text-ink">{`appended at the newest end. size ${l.length} ≤ ${CAP}: removeEldestEntry returns false, nothing evicted.`}</span>
        )}
      </>,
    );
  };

  const reset = () => {
    t.clear();
    setList([]);
    setGhost(null);
    setHot(null);
    setNext(1);
    setHits(0);
    setMisses(0);
    setLog(<span className="text-faint">{"var cache = new Lru<String, Integer>(3);"}</span>);
  };

  const cells: (E | null)[] = [...list, ...Array(CAP - list.length).fill(null)];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="text-13">
        <Row k="get =">
          {KEYS.map((k) => (
            <button key={k} className="act !min-w-[6.5ch]" onClick={() => get(k)}>
              get({k})
            </button>
          ))}
        </Row>
        <Row k="put =">
          {KEYS.map((k) => (
            <button key={k} className="act !min-w-[6.5ch]" onClick={() => put(k)}>
              put({k})
            </button>
          ))}
        </Row>
        <Row k="stats =" last>
          <span className="tabular text-mute">
            hits <span className="text-live">{hits}</span>
            <span className="text-faint"> · </span>
            misses <span className="text-dead">{misses}</span>
          </span>
          <button className="act ml-auto" onClick={reset}>
            reset
          </button>
        </Row>
      </div>

      <div>
        <div className="mb-2 flex justify-between text-11 text-faint">
          <span>← eldest (evicted first)</span>
          <span>newest →</span>
        </div>
        <div className="flex items-stretch gap-2">
          <div className="flex w-[64px] shrink-0 items-center justify-center">
            {ghost && (
              <div key={`g-${ghost.k}-${ghost.v}`} className="obj-in flex h-[54px] w-full flex-col items-center justify-center rounded-xs text-dead opacity-70 shadow-[inset_0_0_0_1px_var(--dead)]">
                <span className="text-14">{ghost.k}</span>
                <span className="text-[10px]">evicted</span>
              </div>
            )}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {cells.map((e, i) =>
              e ? (
                <div
                  key={`${e.k}`}
                  className="flex h-[54px] flex-col items-center justify-center rounded-xs bg-bg transition-[box-shadow] duration-200"
                  style={{ boxShadow: `inset 0 0 0 1px ${hot === e.k ? "var(--hot)" : "var(--line-2)"}` }}
                >
                  <span className={`text-15 ${hot === e.k ? "text-hot" : "text-hi"}`}>{e.k}</span>
                  <span className="text-11 text-faint tabular">= {e.v}</span>
                </div>
              ) : (
                <div key={`empty-${i}`} className="flex h-[54px] items-center justify-center rounded-xs text-12 text-faint shadow-[inset_0_0_0_1px_var(--line)]">
                  ·
                </div>
              ),
            )}
          </div>
        </div>
        <div className="mt-2 font-serif text-15 text-mute">capacity 3. the order is the LinkedHashMap&apos;s linked list, in access order.</div>
      </div>

      <Console label="what the cache just did">{log}</Console>
    </div>
  );
}
