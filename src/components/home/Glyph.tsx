import type { Glyph as G } from "@/content/curriculum";

// one tiny drawing per part. stroke-only, 28px, they move a little on hover (see .glyph in globals.css).

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "square" as const };

const shapes: Record<G, React.ReactNode> = {
  cup: (
    <>
      <path {...s} d="M7 13h12v6a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" />
      <path {...s} d="M19 15h2a2 2 0 0 1 0 4h-2" />
      <path {...s} className="g-steam" d="M10 10c0-2 2-2 2-4M14 10c0-2 2-2 2-4" />
    </>
  ),
  bits: (
    <>
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}${c}`}
            x={5 + c * 5}
            y={5 + r * 5}
            width={3}
            height={3}
            fill={(r * 3 + c * 5) % 3 === 0 ? "currentColor" : "none"}
            fillOpacity={0.3}
            stroke="currentColor"
            strokeWidth={0.8}
            className={(r + c) % 2 ? "g-blink" : ""}
          />
        )),
      )}
    </>
  ),
  objects: (
    <>
      <rect {...s} x={4} y={8} width={7} height={7} />
      <rect {...s} x={17} y={14} width={7} height={7} />
      <path {...s} className="g-dash" d="M11 11.5c4 0 4 6 6 6" />
      <circle cx={7.5} cy={11.5} r={1.2} fill="currentColor" />
    </>
  ),
  toolbox: (
    <>
      <rect {...s} x={4} y={11} width={20} height={11} />
      <path {...s} d="M10 11V8h8v3M4 15h20" />
    </>
  ),
  brackets: (
    <>
      <path {...s} d="M10 8l-5 6 5 6M18 8l5 6-5 6" />
      <path {...s} className="g-blink" d="M13 14h2" />
    </>
  ),
  buckets: (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} {...s} x={4 + i * 5.5} y={6} width={4} height={4} />
      ))}
      <path {...s} d="M6 10v4M17 10v8" />
      <rect {...s} x={4} y={14} width={4} height={4} />
      <rect {...s} x={15} y={18} width={4} height={4} className="g-pop" />
    </>
  ),
  stream: (
    <>
      <path {...s} d="M3 14h22" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={7 + i * 7} cy={14} r={1.6} fill="currentColor" className="g-flow" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </>
  ),
  spark: (
    <>
      <path {...s} className="g-spin" style={{ transformOrigin: "14px 14px" }} d="M14 5v6M14 17v6M5 14h6M17 14h6M8 8l3 3M17 17l3 3M20 8l-3 3M11 17l-3 3" />
    </>
  ),
  threads: (
    <>
      <path {...s} className="g-dash" d="M4 9c4-3 6 3 10 0s6 3 10 0" />
      <path {...s} d="M4 14c4-3 6 3 10 0s6 3 10 0" />
      <path {...s} className="g-dash" d="M4 19c4-3 6 3 10 0s6 3 10 0" />
    </>
  ),
  pipes: (
    <>
      <rect {...s} x={3} y={11} width={6} height={6} />
      <rect {...s} x={19} y={11} width={6} height={6} />
      <path {...s} className="g-dash" d="M9 14h10" />
    </>
  ),
  mirror: (
    <>
      <path {...s} d="M14 4v20" strokeDasharray="2 2" />
      <path {...s} d="M11 9l-5 5 5 5" />
      <path {...s} className="g-fade" d="M17 9l5 5-5 5" />
    </>
  ),
  wrench: (
    <>
      <path {...s} d="M17 5a5 5 0 0 0-4 7l-8 8 3 3 8-8a5 5 0 0 0 7-4l-3 1-2-2 1-3z" />
    </>
  ),
  bytecode: (
    <>
      <rect {...s} x={7} y={18} width={14} height={4} />
      <rect {...s} x={7} y={13} width={14} height={4} className="g-pop" />
      <rect {...s} x={7} y={8} width={14} height={4} className="g-fade" />
    </>
  ),
  sweep: (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={5 + i * 4.5}
          cy={14 + (i % 2 ? 4 : -2)}
          r={1.8}
          fill={i % 2 ? "none" : "currentColor"}
          stroke="currentColor"
          strokeWidth={0.9}
          className={i % 2 ? "g-fade" : ""}
        />
      ))}
      <path {...s} d="M3 23h22" />
    </>
  ),
  gauge: (
    <>
      <path {...s} d="M5 20a9 9 0 0 1 18 0" />
      <path {...s} className="g-needle" style={{ transformOrigin: "14px 20px" }} d="M14 20l5-6" />
    </>
  ),
  book: (
    <>
      <path {...s} d="M4 7h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM24 7h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z" />
    </>
  ),
  magnifier: (
    <>
      <circle {...s} cx={12} cy={12} r={6} />
      <path {...s} d="M17 17l6 6" />
      <path {...s} className="g-blink" d="M10 12h4" />
    </>
  ),
  horizon: (
    <>
      <path {...s} d="M3 19h22" />
      <path {...s} className="g-rise" d="M8 19a6 6 0 0 1 12 0" />
      <path {...s} d="M5 23h18" strokeDasharray="2 3" />
    </>
  ),
};

export function Glyph({ name, className }: { name: G; className?: string }) {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} className={`glyph ${className ?? ""}`} aria-hidden>
      {shapes[name]}
    </svg>
  );
}
