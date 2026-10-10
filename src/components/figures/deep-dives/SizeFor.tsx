"use client";

import { useState } from "react";
import { BitStrip } from "./BitStrip";
import { Row } from "./kit";

// HashMap.tableSizeFor(cap): -1 >>> Integer.numberOfLeadingZeros(cap - 1), plus one.
// and what that means for new HashMap<>(n) vs HashMap.newHashMap(n) (java 19+), which
// sizes for n / 0.75. checked on jdk 25 with reflection: new HashMap<>(100) gets a
// Node[128] and resizes to 256 on the 97th put; newHashMap(100) starts at 256.

function tableSizeFor(cap: number) {
  const nlz = Math.clz32(cap - 1);
  const n = nlz === 32 ? -1 : (-1 >>> nlz) | 0; // java: shift by 32 is a shift by 0
  return n < 0 ? 1 : n + 1;
}

function grow(n: number, table: number) {
  let t = table;
  let resizes = 0;
  while (n > Math.floor(t * 0.75)) {
    t *= 2;
    resizes++;
  }
  return { t, resizes };
}

export function SizeFor() {
  const [n, setN] = useState(100);
  const nlz = Math.clz32(n - 1);
  const ones = nlz === 32 ? 0 : -1 >>> nlz;
  const t1 = tableSizeFor(n);
  const a = grow(n, t1);
  const t2 = tableSizeFor(Math.ceil(n / 0.75));
  const b = grow(n, t2);
  const lowBits = 32 - nlz;

  return (
    <div className="@container text-13">
      <Row k="n =" w="6ch" last>
        <div className="flex items-center gap-3">
          <input
            type="range"
            className="slider min-w-0 flex-1"
            min={2}
            max={300}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            aria-label="expected number of entries"
          />
          <span className="w-[4ch] text-right text-hi tabular">{n}</span>
        </div>
      </Row>

      <div className="grid gap-y-2.5 border-t border-line pt-4">
        {[
          { l: `cap - 1 = ${n - 1}`, v: n - 1 },
          { l: `-1 >>> ${nlz}`, v: ones, hint: `numberOfLeadingZeros(${n - 1}) = ${nlz}` },
          { l: `+ 1 = ${t1}`, v: t1 },
        ].map((r, i) => (
          <div key={i} className="grid items-center gap-x-4 gap-y-0.5 @[640px]:grid-cols-[18ch_auto_minmax(0,1fr)]">
            <span className={`text-12 ${i === 2 ? "text-hot" : "text-ink"}`}>{r.l}</span>
            <BitStrip value={r.v} toneAt={(bit) => (i === 1 && bit < lowBits ? "hot" : i === 2 && bit === lowBits ? "hot" : undefined)} />
            <span className="hidden text-11 text-faint @[640px]:block">{r.hint ?? ""}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-12 text-mute">every bit below the highest set bit of cap - 1 becomes a 1, then + 1 carries it up to the next power of two.</p>

      <div className="mt-5 grid gap-3 @[560px]:grid-cols-2" aria-live="polite">
        <Card
          title={`new HashMap<>(${n})`}
          table={t1}
          resizes={a.resizes}
          final={a.t}
          n={n}
        />
        <Card title={`HashMap.newHashMap(${n})`} table={t2} resizes={b.resizes} final={b.t} n={n} />
      </div>
    </div>
  );
}

function Card({ title, table, resizes, final, n }: { title: string; table: number; resizes: number; final: number; n: number }) {
  const ok = resizes === 0;
  return (
    <div className="rounded-md bg-bg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="truncate text-12 text-hi">{title}</div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-12 tabular">
        <span className="text-faint">table</span>
        <span className="text-ink">Node[{table}]</span>
        <span className="text-faint">fits</span>
        <span className="text-ink">{Math.floor(table * 0.75)} before resizing</span>
        <span className="text-faint">{n} puts</span>
        <span style={{ color: ok ? "var(--live)" : "var(--dead)" }}>
          {ok ? "no resize" : `${resizes} resize${resizes > 1 ? "s" : ""}, ends at Node[${final}]`}
        </span>
      </div>
    </div>
  );
}
