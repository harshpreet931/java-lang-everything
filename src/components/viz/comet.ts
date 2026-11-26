// a comet along any svg path: a bright head with a short tail, the way a reference
// is followed from the slot to the object. for dot fields use DotField's `comets`;
// this one is for figures whose references are drawn as curves.
//
// returns a cancel function. skips itself (and returns a no-op) under reduced
// motion, in a hidden tab, or when the path has no length. never runs on load:
// callers fire it from a reader action or a step change.

export type CometOpts = {
  /** css colour, default var(--ref) */
  colour?: string;
  ms?: number;
  /** head radius in svg units */
  r?: number;
  /** dots in the tail */
  tail?: number;
  /** travel from the end back to the start */
  back?: boolean;
  onDone?: () => void;
};

const NS = "http://www.w3.org/2000/svg";

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function comet(path: SVGPathElement | SVGGeometryElement, host: SVGGElement | SVGSVGElement, o: CometOpts = {}): () => void {
  if (reducedMotion() || document.hidden) {
    o.onDone?.();
    return () => {};
  }
  let len = 0;
  try {
    len = path.getTotalLength();
  } catch {
    len = 0;
  }
  if (!len) {
    o.onDone?.();
    return () => {};
  }
  const { colour = "var(--ref)", r = 3.6, tail = 5, back } = o;
  const ms = o.ms ?? Math.min(900, Math.max(320, len * 2.4));
  const nodes = Array.from({ length: tail + 1 }, (_, k) => {
    const e = document.createElementNS(NS, "circle");
    e.setAttribute("r", String(k === 0 ? r : Math.max(0.9, r * (0.72 - k * 0.1))));
    e.setAttribute("fill", colour);
    e.setAttribute("aria-hidden", "true");
    e.style.opacity = "0";
    e.style.pointerEvents = "none";
    host.appendChild(e);
    return e;
  });
  const gap = Math.max(5, r * 1.9);
  const t0 = performance.now();
  let id = 0;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(id);
    nodes.forEach((e) => e.remove());
  };
  const frame = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    // ease out: leaves quickly, lands softly on the object
    const e = 1 - (1 - t) ** 2.2;
    const head = e * len;
    nodes.forEach((n, k) => {
      const at = head - k * gap;
      if (at < 0) {
        n.style.opacity = "0";
        return;
      }
      const pt = path.getPointAtLength(back ? len - at : at);
      n.setAttribute("cx", pt.x.toFixed(1));
      n.setAttribute("cy", pt.y.toFixed(1));
      n.style.opacity = String(k === 0 ? 1 : Math.max(0, 0.7 - k * 0.13));
    });
    if (t < 1) id = requestAnimationFrame(frame);
    else {
      stop();
      o.onDone?.();
    }
  };
  id = requestAnimationFrame(frame);
  return stop;
}
