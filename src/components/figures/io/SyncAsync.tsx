"use client";

import { useState } from "react";
import { NARR, Row, Words, ring, tint } from "./kit";

// five requests to a local server that takes 300 ms per request (the chapter's runnable
// example). measured on jdk 25, M4 Pro: send() in a loop ≈ 1,500 ms, sendAsync() all
// five then join ≈ 300 ms. the bars below are drawn from that model.

type Mode = "send" | "sendAsync";
const REQ = 5;
const LAT = 300;
const MAX = 1600;

export function SyncAsync() {
  const [mode, setMode] = useState<Mode>("send");
  const total = mode === "send" ? REQ * LAT : LAT;

  return (
    <div className="@container text-13">
      <Row k="call =" w="7ch" last>
        <Words label="send or sendAsync" options={["send", "sendAsync"] as Mode[]} value={mode} onChange={setMode} />
      </Row>

      <div className="mt-4 grid gap-1.5">
        {/* the calling thread */}
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-3">
          <span className="text-11 text-faint">your thread</span>
          <div className="relative h-6 rounded-md bg-well-2">
            <div
              className="absolute inset-y-0 left-0 rounded-md transition-[width,background-color] duration-300 ease-jle"
              style={{
                width: `${((mode === "send" ? total : 12) / MAX) * 100}%`,
                background: mode === "send" ? tint("dead", 30) : tint("live", 40),
              }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center text-[10px] whitespace-nowrap text-ink">
              {mode === "send" ? "blocked, waiting on each response" : "fires 5 requests, free right away"}
            </span>
          </div>
        </div>
        <div className="my-1 h-px bg-line" />
        {Array.from({ length: REQ }, (_, i) => {
          const start = mode === "send" ? i * LAT : i * 4;
          return (
            <div key={i} className="grid grid-cols-[9ch_minmax(0,1fr)] items-center gap-3">
              <span className="text-11 text-mute tabular">request {i}</span>
              <div className="relative h-5">
                <div
                  className="absolute inset-y-0 rounded-[3px] transition-[left] duration-300 ease-jle"
                  style={{
                    left: `${(start / MAX) * 100}%`,
                    width: `${(LAT / MAX) * 100}%`,
                    background: tint("ref", 22),
                    boxShadow: ring("ref", 60),
                  }}
                />
              </div>
            </div>
          );
        })}
        {/* axis */}
        <div className="grid grid-cols-[9ch_minmax(0,1fr)] gap-3">
          <span />
          <div className="relative mt-1 h-4 border-t border-line-2 text-[10px] text-faint tabular">
            {[0, 500, 1000, 1500].map((t) => (
              <span key={t} className={`absolute top-1 whitespace-nowrap ${t === 0 ? "" : t === 1500 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(t / MAX) * 100}%` }}>
                {t === 1500 ? "1500 ms" : t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line pt-3 text-12">
        <span className="text-faint">
          all five done after ≈ <span className={`text-16 tabular ${mode === "send" ? "text-dead" : "text-live"}`}>{total.toLocaleString("en-US")} ms</span>
        </span>
      </div>
      <p className={`mt-2 ${NARR}`} aria-live="polite">
        {mode === "send"
          ? "send() blocks until the whole response is in. in a loop, the latencies add up: five round trips, one after another."
          : "sendAsync() returns a CompletableFuture immediately. all five are in flight at once, so you wait for the slowest one, not the sum."}
      </p>
    </div>
  );
}
