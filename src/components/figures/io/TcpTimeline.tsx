"use client";

import type { ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { NARR, tint } from "./kit";

// a TCP connection's whole life, with the java call that causes each packet.
// the handshake (SYN, SYN-ACK, ACK) is done by the two kernels: java only sees
// new Socket(...) return on one side and accept() return on the other.

type Row = {
  c?: string; // client side: the java call, or the state
  s?: string; // server side
  msg?: { dir: "r" | "l"; label: string; os?: boolean };
  note: ReactNode;
  cState: string;
  sState: string;
};

const ROWS: Row[] = [
  { s: "new ServerSocket(8080)", cState: "·", sState: "LISTEN", note: <>the server binds port 8080 and tells the OS to start queueing connections for it. nothing is connected yet.</> },
  { s: "server.accept()", cState: "·", sState: "LISTEN", note: <>accept() blocks. this thread sleeps until a client finishes connecting.</> },
  { c: 'new Socket("host", 8080)', msg: { dir: "r", label: "SYN" }, cState: "SYN_SENT", sState: "LISTEN", note: <>the client&apos;s constructor sends a SYN: &quot;i&apos;d like to talk, here&apos;s my starting sequence number&quot;. it blocks too.</> },
  { msg: { dir: "l", label: "SYN-ACK", os: true }, cState: "SYN_SENT", sState: "SYN_RCVD", note: <>the server&apos;s kernel answers by itself, no java code involved: &quot;ok, and here&apos;s mine&quot;.</> },
  { c: "constructor returns", s: "accept() returns a Socket", msg: { dir: "r", label: "ACK", os: true }, cState: "ESTABLISHED", sState: "ESTABLISHED", note: <>the third packet completes the handshake. both calls return. the server gets a brand new Socket for this client; the ServerSocket goes back to listening for the next one.</> },
  { c: 'out.write("hello\\n")', msg: { dir: "r", label: "data: hello\\n" }, cState: "ESTABLISHED", sState: "ESTABLISHED", note: <>a write just copies bytes into the kernel&apos;s send buffer and returns. TCP gets them there, in order, retrying if a packet is lost.</> },
  { s: 'in.readLine() → "hello"', msg: { dir: "l", label: "ACK", os: true }, cState: "ESTABLISHED", sState: "ESTABLISHED", note: <>the server&apos;s read returns once bytes arrive. note it&apos;s a stream: TCP never promised that one write equals one read.</> },
  { c: 'in.readLine() → "HELLO"', s: 'out.write("HELLO\\n")', msg: { dir: "l", label: "data: HELLO\\n" }, cState: "ESTABLISHED", sState: "ESTABLISHED", note: <>same thing the other way. a connection is two independent byte streams, one in each direction.</> },
  { c: "socket.close()", msg: { dir: "r", label: "FIN" }, cState: "FIN_WAIT", sState: "CLOSE_WAIT", note: <>closing sends a FIN: &quot;i&apos;m done sending&quot;. the server&apos;s next readLine() returns <code>null</code>, which is how your read loop ends.</> },
  { s: "socket.close()", msg: { dir: "l", label: "FIN", os: false }, cState: "TIME_WAIT", sState: "CLOSED", note: <>the server closes its side too. the client lingers in TIME_WAIT for a while (up to a few minutes), so stray late packets can&apos;t leak into a new connection on the same port.</> },
];

export function TcpTimeline() {
  const s = useStepper(ROWS.length, { interval: 1800 });
  const r = ROWS[s.i];
  return (
    <div {...s.keys} className="outline-none">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] items-end gap-x-2 border-b border-line pb-2 text-12">
        <div>
          <div className="text-hi">client</div>
          <div className="text-11 text-faint tabular">{r.cState}</div>
        </div>
        <div className="text-center text-11 text-faint">packets</div>
        <div className="text-right">
          <div className="text-hi">server</div>
          <div className="text-11 text-faint tabular">{r.sState}</div>
        </div>
      </div>
      <ol className="mt-1">
        {ROWS.map((row, i) => {
          const on = i === s.i;
          const seen = i <= s.i;
          return (
            <li
              key={i}
              className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-x-2 rounded-md px-1 text-11 transition-[opacity,background-color] duration-200 sm:text-12"
              style={{ opacity: seen ? (on ? 1 : 0.55) : 0.12, background: on ? tint("hot", 8) : undefined }}
            >
              <span className={`min-w-0 break-words ${on ? "text-hot" : "text-ink"}`}>{row.c}</span>
              <span className="relative flex h-6 items-center">
                {row.msg && (
                  <>
                    <span
                      className="absolute inset-x-0 top-1/2 h-px"
                      style={{ background: row.msg.os ? "var(--mute)" : "var(--ref)" }}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px]"
                      style={{
                        [row.msg.dir === "r" ? "right" : "left"]: -2,
                        color: row.msg.os ? "var(--mute)" : "var(--ref)",
                      }}
                    >
                      {row.msg.dir === "r" ? "▶" : "◀"}
                    </span>
                    <span
                      className="relative mx-auto -mt-5 bg-well px-1.5 text-[10px] whitespace-nowrap sm:text-11"
                      style={{ color: row.msg.os ? "var(--mute)" : "var(--ref)" }}
                    >
                      {row.msg.label}
                    </span>
                  </>
                )}
              </span>
              <span className={`min-w-0 text-right break-words ${on ? "text-hot" : "text-ink"}`}>{row.s}</span>
            </li>
          );
        })}
      </ol>
      <p className={`mt-4 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {r.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
