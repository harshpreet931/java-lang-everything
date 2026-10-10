// platform threads are 1:1 with OS threads. virtual threads are M:N: many virtual
// threads share a few carrier (platform) threads, and only the mounted ones occupy one.

export function ThreadModels() {
  const vt = Array.from({ length: 12 }, (_, i) => i);
  const mounted = new Map([
    [1, 0],
    [6, 1],
    [10, 2],
  ]);
  return (
    <div className="grid gap-6 font-mono sm:grid-cols-2">
      <svg viewBox="0 0 260 190" className="block w-full" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="four platform threads, each its own OS thread">
        <text x={0} y={14} fontSize={12} fill="var(--hi)">
          platform threads: 1:1
        </text>
        {[0, 1, 2, 3].map((i) => {
          const x = 20 + i * 60;
          return (
            <g key={i}>
              <rect x={x} y={34} width={44} height={26} rx={5} fill="var(--well)" stroke="var(--line-2)" />
              <text x={x + 22} y={51} textAnchor="middle" fontSize={11} fill="var(--ink)">
                T{i}
              </text>
              <line x1={x + 22} y1={60} x2={x + 22} y2={120} stroke="var(--line-2)" />
              <rect x={x} y={120} width={44} height={26} rx={5} fill="var(--well-2)" stroke="var(--meta)" />
              <text x={x + 22} y={137} textAnchor="middle" fontSize={10} fill="var(--meta)">
                OS
              </text>
            </g>
          );
        })}
        <text x={0} y={176} fontSize={10} fill="var(--mute)">
          each one: an OS thread + a reserved stack
        </text>
      </svg>
      <svg viewBox="0 0 260 190" className="block w-full" style={{ fontFamily: "var(--font-code)" }} role="img" aria-label="twelve virtual threads sharing three carrier threads">
        <text x={0} y={14} fontSize={12} fill="var(--hi)">
          virtual threads: M:N
        </text>
        {vt.map((i) => {
          const x = 8 + (i % 12) * 21;
          const on = mounted.has(i);
          return (
            <g key={i}>
              <rect x={x} y={34} width={17} height={17} rx={4} fill="var(--well)" stroke={on ? "var(--live)" : "var(--line-2)"} strokeDasharray={on ? undefined : "2 2"} />
              {on && <line x1={x + 8.5} y1={51} x2={40 + mounted.get(i)! * 80 + 22} y2={86} stroke="var(--live)" />}
            </g>
          );
        })}
        {[0, 1, 2].map((c) => {
          const x = 40 + c * 80;
          return (
            <g key={c}>
              <rect x={x} y={86} width={44} height={24} rx={5} fill="var(--well)" stroke="var(--live)" />
              <text x={x + 22} y={102} textAnchor="middle" fontSize={10} fill="var(--live)">
                carrier
              </text>
              <line x1={x + 22} y1={110} x2={x + 22} y2={124} stroke="var(--line-2)" />
              <rect x={x} y={124} width={44} height={24} rx={5} fill="var(--well-2)" stroke="var(--meta)" />
              <text x={x + 22} y={140} textAnchor="middle" fontSize={10} fill="var(--meta)">
                OS
              </text>
            </g>
          );
        })}
        <text x={0} y={176} fontSize={10} fill="var(--mute)">
          3 of 12 mounted; the rest on the heap
        </text>
      </svg>
    </div>
  );
}
