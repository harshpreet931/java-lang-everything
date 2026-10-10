"use client";

import { useState } from "react";
import { ByteCell, Row, Words, NARR } from "./kit";

// new String(text.getBytes(writeAs), readAs), for real. every string below was produced
// by jdk 25 (temurin 25.0.4), not computed in the browser, so the replacement characters
// and the C1 control characters are exactly what java gives you.

type Cs = "UTF-8" | "ISO-8859-1" | "windows-1252";

const DATA: Record<string, Record<Cs, { bytes: string; as: Record<Cs, string> }>> = {
  "naïve café": {
    "UTF-8": { bytes: "6e 61 c3 af 76 65 20 63 61 66 c3 a9", as: { "UTF-8": "naïve café", "ISO-8859-1": "naÃ¯ve cafÃ©", "windows-1252": "naÃ¯ve cafÃ©" } },
    "ISO-8859-1": { bytes: "6e 61 ef 76 65 20 63 61 66 e9", as: { "UTF-8": "na�ve caf�", "ISO-8859-1": "naïve café", "windows-1252": "naïve café" } },
    "windows-1252": { bytes: "6e 61 ef 76 65 20 63 61 66 e9", as: { "UTF-8": "na�ve caf�", "ISO-8859-1": "naïve café", "windows-1252": "naïve café" } },
  },
  "it’s €5": {
    "UTF-8": { bytes: "69 74 e2 80 99 73 20 e2 82 ac 35", as: { "UTF-8": "it’s €5", "ISO-8859-1": "itâ\u0080\u0099s â\u0082¬5", "windows-1252": "itâ€™s â‚¬5" } },
    "ISO-8859-1": { bytes: "69 74 3f 73 20 3f 35", as: { "UTF-8": "it?s ?5", "ISO-8859-1": "it?s ?5", "windows-1252": "it?s ?5" } },
    "windows-1252": { bytes: "69 74 92 73 20 80 35", as: { "UTF-8": "it�s �5", "ISO-8859-1": "it\u0092s \u00805", "windows-1252": "it’s €5" } },
  },
  "日本": {
    "UTF-8": { bytes: "e6 97 a5 e6 9c ac", as: { "UTF-8": "日本", "ISO-8859-1": "æ\u0097¥æ\u009c¬", "windows-1252": "æ—¥æœ¬" } },
    "ISO-8859-1": { bytes: "3f 3f", as: { "UTF-8": "??", "ISO-8859-1": "??", "windows-1252": "??" } },
    "windows-1252": { bytes: "3f 3f", as: { "UTF-8": "??", "ISO-8859-1": "??", "windows-1252": "??" } },
  },
};

const CS: Cs[] = ["UTF-8", "ISO-8859-1", "windows-1252"];

export function Mojibake() {
  const [text, setText] = useState("naïve café");
  const [w, setW] = useState<Cs>("UTF-8");
  const [r, setR] = useState<Cs>("ISO-8859-1");
  const row = DATA[text][w];
  const out = row.as[r];
  const bytes = row.bytes.split(" ").map((h) => parseInt(h, 16));
  const lostAtWrite = bytes.includes(0x3f) && !text.includes("?");
  const ok = out === text;
  const replacement = out.includes("�");

  const verdict = ok
    ? { tone: "live", text: "same charset on both sides (or two that agree on these bytes). the text survives." }
    : lostAtWrite
      ? { tone: "dead", text: "lost when it was written: the charset had no byte for these characters, so java wrote 3f ('?'). no decoder can bring them back." }
      : replacement
        ? { tone: "dead", text: "these bytes aren't valid UTF-8. the decoder doesn't throw, it swaps each broken sequence for U+FFFD, the � replacement character." }
        : { tone: "dead", text: "mojibake. every multi-byte UTF-8 sequence got read as 2 or 3 one-byte characters. nothing is lost yet: encode it back the wrong way and you get the bytes again." };

  return (
    <div className="text-13">
      <Row k="text =" w="10ch">
        <Words label="text" options={Object.keys(DATA)} value={text} onChange={setText} />
      </Row>
      <Row k="write as =" w="10ch">
        <Words label="charset used to write" options={CS} value={w} onChange={setW} />
      </Row>
      <Row k="read as =" w="10ch" last>
        <Words label="charset used to read" options={CS} value={r} onChange={setR} />
      </Row>

      <div className="mt-5 grid gap-4">
        <div>
          <div className="mb-1.5 text-11 text-faint">
            text.getBytes({w}) · {bytes.length} bytes
          </div>
          <div className="flex flex-wrap gap-1">
            {bytes.map((b, i) => (
              <ByteCell key={i} b={b} tone={b === 0x3f && lostAtWrite ? "dead" : b >= 0x80 ? "hot" : undefined} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-11 text-faint">new String(bytes, {r})</div>
          <div className="text-28 leading-tight font-light break-all" style={{ color: ok ? "var(--live)" : "var(--dead)" }} aria-live="polite">
            {Array.from(out).map((c, i) => {
              const code = c.codePointAt(0)!;
              if (code >= 0x80 && code <= 0x9f)
                return (
                  <span key={i} className="mx-px align-middle text-12 text-faint" title={`invisible control character U+00${code.toString(16)}`}>
                    [{code.toString(16)}]
                  </span>
                );
              return <span key={i}>{c}</span>;
            })}
          </div>
        </div>
        <p className={`border-t border-line pt-3 ${NARR}`}>
          <span style={{ color: `var(--${verdict.tone})` }}>{ok ? "round trip ok. " : "broken. "}</span>
          {verdict.text}
        </p>
      </div>
    </div>
  );
}
