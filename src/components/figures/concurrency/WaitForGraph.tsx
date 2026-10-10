import { useId } from "react";

// the wait-for graph for the alice/bob deadlock: threads hold locks (purple, solid)
// and wait for locks (red, dashed). follow the arrows and you come back where you started.

export function WaitForGraph() {
  const id = useId().replace(/:/g, "");
  const box = (x: number, y: number, label: string, sub: string, stroke: string) => (
    <g>
      <rect x={x - 52} y={y - 20} width={104} height={40} rx={6} fill="var(--well)" stroke={stroke} strokeWidth={1.3} />
      <text x={x} y={y - 2} textAnchor="middle" fontSize={13} fill="var(--hi)">
        {label}
      </text>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="var(--faint)">
        {sub}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 360 200" className="mx-auto block w-full max-w-[520px]" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="alice holds account A and waits for account B; bob holds B and waits for A: a cycle">
      <defs>
        <marker id={`${id}-m`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--meta)" />
        </marker>
        <marker id={`${id}-d`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--dead)" />
        </marker>
      </defs>
      {box(70, 45, "alice", "thread", "var(--dead)")}
      {box(290, 45, "bob", "thread", "var(--dead)")}
      {box(70, 160, "accountA", "lock", "var(--meta)")}
      {box(290, 160, "accountB", "lock", "var(--meta)")}
      {/* holds */}
      <path d="M 70 140 L 70 68" stroke="var(--meta)" strokeWidth={1.4} markerEnd={`url(#${id}-m)`} />
      <text x={78} y={108} fontSize={10} fill="var(--meta)">held by</text>
      <path d="M 290 140 L 290 68" stroke="var(--meta)" strokeWidth={1.4} markerEnd={`url(#${id}-m)`} />
      <text x={244} y={108} fontSize={10} fill="var(--meta)">held by</text>
      {/* waits */}
      <path d="M 122 55 C 190 75, 220 120, 240 145" fill="none" stroke="var(--dead)" strokeWidth={1.4} strokeDasharray="5 4" markerEnd={`url(#${id}-d)`} />
      <path d="M 238 55 C 170 75, 140 120, 120 145" fill="none" stroke="var(--dead)" strokeWidth={1.4} strokeDasharray="5 4" markerEnd={`url(#${id}-d)`} />
      <text x={180} y={42} textAnchor="middle" fontSize={10} fill="var(--dead)">
        waits for
      </text>
    </svg>
  );
}
