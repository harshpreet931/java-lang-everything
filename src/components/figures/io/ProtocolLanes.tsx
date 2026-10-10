"use client";

import { useMemo, useState } from "react";
import { NARR, Row, Words, ring, tint } from "./kit";

// three responses (a, b, c), three frames each, one frame sent per time slot.
// a conceptual model of the delivery rules, not a packet capture:
//   http/1.1: one response at a time on a connection.
//   http/2:  frames of all three interleaved on ONE tcp connection. tcp delivers bytes in order,
//            so one lost packet holds back everything behind it (head-of-line blocking).
//   http/3:  the same interleaving over QUIC (udp). ordering is per stream, so a loss only
//            holds back its own stream.
// a lost frame is resent and arrives 3 slots after it was first sent.

type Proto = "http/1.1" | "http/2" | "http/3";
type Frame = { s: "a" | "b" | "c"; n: number };

const H1: Frame[] = ["a", "b", "c"].flatMap((s) => [1, 2, 3].map((n) => ({ s: s as Frame["s"], n })));
const MUX: Frame[] = [1, 2, 3].flatMap((n) => ["a", "b", "c"].map((s) => ({ s: s as Frame["s"], n })));
const SLOTS = 12;
const RESEND = 3;

function deliver(proto: Proto, lose: boolean) {
  const frames = proto === "http/1.1" ? H1 : MUX;
  const lostIdx = lose ? frames.findIndex((f) => f.s === "b" && f.n === 2) : -1;
  const out: { f: Frame; sent: number; arrive: number; at: number }[] = [];
  const lastPerStream: Record<string, number> = {};
  let last = 0;
  frames.forEach((f, i) => {
    const sent = i + 1;
    const arrive = i === lostIdx ? sent + RESEND : sent;
    // the receiver hands the app at most one frame per slot, in order (per connection for tcp, per stream for quic)
    const at = proto === "http/3" ? Math.max(arrive, (lastPerStream[f.s] ?? 0) + 1) : Math.max(arrive, last + 1);
    last = Math.max(last, at);
    lastPerStream[f.s] = at;
    out.push({ f, sent, arrive, at });
  });
  return { out, lostSlot: lostIdx >= 0 ? lostIdx + 1 : -1 };
}

export function ProtocolLanes() {
  const [proto, setProto] = useState<Proto>("http/2");
  const [lose, setLose] = useState(false);
  const { out, lostSlot } = useMemo(() => deliver(proto, lose), [proto, lose]);
  const done = (s: string) => Math.max(...out.filter((x) => x.f.s === s).map((x) => x.at));

  return (
    <div className="@container text-13">
      <Row k="protocol =" w="10ch">
        <Words label="protocol" options={["http/1.1", "http/2", "http/3"] as Proto[]} value={proto} onChange={setProto} />
      </Row>
      <Row k="network =" w="10ch" last>
        <Words
          label="packet loss"
          options={[
            { v: "ok", label: "no loss" },
            { v: "lose", label: "lose one packet" },
          ]}
          value={lose ? "lose" : "ok"}
          onChange={(v) => setLose(v === "lose")}
        />
      </Row>

      <div className="mt-2 mb-3 text-11 text-faint">
        {proto === "http/1.1" ? "1 TCP connection, one response at a time" : proto === "http/2" ? "1 TCP connection, 3 streams interleaved" : "1 QUIC connection over UDP, 3 independent streams"}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[440px]">
          {(["a", "b", "c"] as const).map((s) => (
            <div key={s} className="grid grid-cols-[10ch_minmax(0,1fr)_5ch] items-center gap-2 py-1">
              <span className="text-12 text-mute">response {s}</span>
              <div className="relative grid h-8" style={{ gridTemplateColumns: `repeat(${SLOTS}, minmax(0,1fr))` }}>
                {Array.from({ length: SLOTS }, (_, i) => (
                  <span key={i} className="border-l border-line" />
                ))}
                {out
                  .filter((x) => x.f.s === s)
                  .map((x) => {
                    const held = x.at > x.arrive;
                    const resent = x.arrive > x.sent;
                    const tone = resent ? "dead" : held ? "hot" : undefined;
                    return (
                      <span
                        key={`${x.f.s}${x.f.n}`}
                        className="absolute top-1 bottom-1 flex items-center justify-center rounded-[3px] text-11 transition-[left] duration-300 ease-jle"
                        style={{
                          left: `calc(${((x.at - 1) / SLOTS) * 100}% + 2px)`,
                          width: `calc(${(1 / SLOTS) * 100}% - 4px)`,
                          color: tone ? `var(--${tone})` : "var(--hi)",
                          boxShadow: tone ? ring(tone, 70) : ring("line-2"),
                          background: tone ? tint(tone, 12) : "var(--well-2)",
                        }}
                      >
                        {x.f.s}
                        {x.f.n}
                      </span>
                    );
                  })}
                {lose && out.some((x) => x.f.s === s && x.arrive > x.sent) && (
                  <span
                    className="absolute top-1 bottom-1 flex items-center justify-center rounded-[3px] text-[10px] text-dead line-through opacity-70"
                    style={{
                      left: `calc(${((lostSlot - 1) / SLOTS) * 100}% + 2px)`,
                      width: `calc(${(1 / SLOTS) * 100}% - 4px)`,
                      boxShadow: `inset 0 0 0 1px var(--dead)`,
                      outline: "1px dashed var(--dead)",
                      outlineOffset: -1,
                    }}
                    title="lost on the wire"
                  >
                    lost
                  </span>
                )}
              </div>
              <span className="text-right text-11 text-faint tabular">t{done(s)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[10ch_minmax(0,1fr)_5ch] gap-2">
            <span />
            <div className="grid text-[10px] text-faint tabular" style={{ gridTemplateColumns: `repeat(${SLOTS}, minmax(0,1fr))` }}>
              {Array.from({ length: SLOTS }, (_, i) => (
                <span key={i} className="pl-1">
                  t{i + 1}
                </span>
              ))}
            </div>
            <span className="text-right text-[10px] text-faint">done</span>
          </div>
        </div>
      </div>

      <p className={`mt-4 border-t border-line pt-3 ${NARR}`} aria-live="polite">
        {proto === "http/1.1"
          ? lose
            ? "one lost packet stalls the response it's in, and everything queued behind it on this connection. browsers open about six connections per host to get any parallelism at all."
            : "response b can't start until a is finished, and c waits for both. a slow first response holds up the rest."
          : proto === "http/2"
            ? lose
              ? "b2 is lost. TCP must hand over bytes in order, so a3, c2 and everything after them sit in the kernel (amber) until b2 is resent, even though they arrived fine. that's TCP head-of-line blocking."
              : "frames from all three responses share one connection, interleaved. nobody waits for anybody. one TCP connection, one TLS handshake."
            : lose
              ? "same loss, but QUIC orders bytes per stream. only response b waits for its resend. a and c finish on time."
              : "same interleaving as http/2, but over QUIC on UDP, with streams the transport keeps separate."}
      </p>
    </div>
  );
}
