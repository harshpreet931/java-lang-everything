"use client";

import type { ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { Chip, NARR, tint } from "./kit";

// a full TLS 1.3 handshake (RFC 8446), one round trip, as java 27's SunJSSE does it by default:
// the client offers a hybrid X25519MLKEM768 key share next to a plain x25519 one (JEP 527).
// on java 25 the default first share is plain x25519; everything else is the same.
// {braces} = encrypted with the handshake keys, as the RFC writes it.

type Prim = "hash" | "key exchange" | "KDF" | "signature" | "MAC" | "AEAD" | "certificates";

type Step = {
  c?: string;
  s?: string;
  msg?: { dir: "r" | "l" | "both"; label: string; enc?: boolean };
  prims: Prim[];
  note: ReactNode;
  locked: boolean;
};

const STEPS: Step[] = [
  {
    c: "ClientHello",
    msg: { dir: "r", label: "versions, cipher suites, random, key shares" },
    prims: ["key exchange"],
    locked: false,
    note: <>the client says what it supports and, betting on what the server will pick, already sends its half of a key exchange: an X25519MLKEM768 share and a plain x25519 one. sending the share up front is why TLS 1.3 needs one round trip, not two.</>,
  },
  {
    s: "ServerHello",
    msg: { dir: "l", label: "chosen suite + server's key share" },
    prims: ["key exchange"],
    locked: false,
    note: <>the server picks TLS 1.3, a cipher suite (say TLS_AES_128_GCM_SHA256) and one of the offered groups, and answers with its half: an x25519 public key plus an ML-KEM ciphertext encapsulated to the client&apos;s ML-KEM key.</>,
  },
  {
    c: "shared secret → keys",
    s: "shared secret → keys",
    prims: ["key exchange", "KDF", "hash"],
    locked: true,
    note: <>both sides now compute the same secret without ever sending it: x25519 gives one part, ML-KEM decapsulation the other. HKDF stretches it, mixed with a hash of every message so far, into handshake keys. from here on, everything is encrypted.</>,
  },
  {
    s: "{EncryptedExtensions}",
    msg: { dir: "l", label: "ALPN (h2?), other settings", enc: true },
    prims: ["AEAD"],
    locked: true,
    note: <>settings that don&apos;t need to be public, like which application protocol was chosen (this is where HTTP/2 gets agreed). already encrypted, unlike TLS 1.2.</>,
  },
  {
    s: "{Certificate}",
    msg: { dir: "l", label: "server's certificate chain", enc: true },
    prims: ["certificates", "signature"],
    locked: true,
    note: <>the server&apos;s certificate: its public key and name, signed by a certificate authority, whose certificate is signed by a root the client trusts. encrypted too, so an eavesdropper can&apos;t even see which site&apos;s certificate it is.</>,
  },
  {
    s: "{CertificateVerify}",
    msg: { dir: "l", label: "signature over the transcript", enc: true },
    prims: ["signature", "hash"],
    locked: true,
    note: <>the proof: the server signs a hash of the whole handshake so far with the private key that matches the certificate. anyone can copy a certificate, only the real server can make this signature.</>,
  },
  {
    s: "{Finished}",
    msg: { dir: "l", label: "MAC over the transcript", enc: true },
    prims: ["MAC", "hash"],
    locked: true,
    note: <>an HMAC over the transcript with a key only the two endpoints can have. if anything in the handshake was tampered with (say, someone stripped the strong groups out of the ClientHello), the MACs won&apos;t match.</>,
  },
  {
    c: "verify everything",
    prims: ["certificates", "signature", "MAC"],
    locked: true,
    note: <>the client walks the chain up to a root in the JDK&apos;s trust store (<code>lib/security/cacerts</code>), checks dates and that the name matches the host it dialled, verifies the CertificateVerify signature and the Finished MAC. any failure: <code>SSLHandshakeException</code>, connection closed.</>,
  },
  {
    c: "{Finished}",
    msg: { dir: "r", label: "client's MAC", enc: true },
    prims: ["MAC"],
    locked: true,
    note: <>the client sends its own Finished. the client can send application data right along with it: one round trip total.</>,
  },
  {
    c: "{application data}",
    s: "{application data}",
    msg: { dir: "both", label: "GET / HTTP/2 ...", enc: true },
    prims: ["AEAD"],
    locked: true,
    note: <>fresh application keys from HKDF, and every record is sealed with an AEAD cipher (AES-GCM or ChaCha20-Poly1305): encrypted and tamper-evident in one go. the expensive public-key work happened once; this part is fast symmetric crypto.</>,
  },
];

const ALL: Prim[] = ["hash", "MAC", "KDF", "key exchange", "AEAD", "signature", "certificates"];

export function TlsHandshake() {
  const s = useStepper(STEPS.length, { interval: 2400 });
  const st = STEPS[s.i];
  return (
    <div {...s.keys} className="outline-none">
      <div className="mb-3 flex flex-wrap gap-1" aria-label="primitives used in this step">
        {ALL.map((p) => (
          <Chip key={p} tone={st.prims.includes(p) ? "hot" : undefined} className={st.prims.includes(p) ? "" : "opacity-50"}>
            {p}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-end gap-x-2 border-b border-line pb-2 text-12">
        <span className="text-hi">client</span>
        <span className="text-center text-11 text-faint">{st.locked ? "encrypted from here on" : "in the clear"}</span>
        <span className="text-right text-hi">server</span>
      </div>
      <ol className="mt-1">
        {STEPS.map((row, i) => {
          const on = i === s.i;
          const seen = i <= s.i;
          return (
            <li
              key={i}
              className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-x-2 rounded-md px-1 text-11 transition-[opacity,background-color] duration-200 sm:text-12"
              style={{ opacity: seen ? (on ? 1 : 0.55) : 0.12, background: on ? tint("hot", 8) : undefined }}
            >
              <span className={`min-w-0 break-words ${on ? "text-hot" : "text-ink"}`}>{row.c}</span>
              <span className="relative flex h-7 items-center">
                {row.msg && (
                  <>
                    <span className="absolute inset-x-0 top-1/2 h-px" style={{ background: row.msg.enc ? "var(--live)" : "var(--ref)" }} />
                    {(row.msg.dir === "r" || row.msg.dir === "both") && (
                      <span className="absolute top-1/2 -right-0.5 -translate-y-1/2 text-[10px]" style={{ color: row.msg.enc ? "var(--live)" : "var(--ref)" }}>
                        ▶
                      </span>
                    )}
                    {(row.msg.dir === "l" || row.msg.dir === "both") && (
                      <span className="absolute top-1/2 -left-0.5 -translate-y-1/2 text-[10px]" style={{ color: row.msg.enc ? "var(--live)" : "var(--ref)" }}>
                        ◀
                      </span>
                    )}
                    <span
                      className="relative mx-auto -mt-6 max-w-full truncate bg-well px-1.5 text-[10px] sm:text-11"
                      style={{ color: row.msg.enc ? "var(--live)" : "var(--ref)" }}
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
      <p className={`mt-4 min-h-[5em] ${NARR}`} aria-live="polite">
        {st.note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
