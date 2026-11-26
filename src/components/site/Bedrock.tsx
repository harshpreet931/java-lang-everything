import type { CSSProperties } from "react";
import { BEDROCK } from "./bedrock-data";
import { BedrockLamp } from "./BedrockLamp";
import s from "./bedrock.module.css";

/**
 * the floor at the bottom of every page: the dot grid as a heap, with "everything" built from real
 * grid dots sampled from Redaction 20 (scripts/bedrock.mjs). the server draws it as svg, one layout
 * per container width, so the first frame is the whole picture and the height never moves. the lamp
 * (a canvas that lights dots near the pointer) loads only when the footer nears the viewport.
 * decorative: the footer's text above carries every link.
 */
export function Bedrock() {
  const vars = {} as Record<string, number>;
  for (const [k, l] of Object.entries(BEDROCK)) {
    vars[`--vc-${k}`] = l.vc;
    vars[`--dc-${k}`] = l.dc;
    vars[`--rows-${k}`] = l.rows;
  }
  return (
    <div className={s.band} style={vars as CSSProperties} aria-hidden>
      <div className={s.floor}>
        <div className={s.paper}>
          {(["p", "t", "d"] as const).map((k) => (
            <svg key={k} className={s[k]} viewBox={`0 0 ${BEDROCK[k].dc} ${BEDROCK[k].rows}`} focusable="false">
              <use href={`/bedrock.svg#${k}`} />
            </svg>
          ))}
        </div>
        <BedrockLamp />
      </div>
    </div>
  );
}
