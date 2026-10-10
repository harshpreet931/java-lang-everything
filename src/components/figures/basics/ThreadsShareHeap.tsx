// static svg figure: two threads, two stacks, one heap.
// pattern for hand-drawn svg figures: fixed viewBox, text in the page font,
// every colour from a token so both themes work, nothing decorative.

const frame = (x: number, y: number, w: number, label: string, top?: boolean) => (
  <g key={`${x}-${y}`}>
    <rect
      x={x}
      y={y}
      width={w}
      height={30}
      rx={2}
      fill="var(--well)"
      stroke={top ? "var(--line-2)" : "var(--line)"}
    />
    <text x={x + 10} y={y + 19} fontSize={11} fill={top ? "var(--hi)" : "var(--mute)"}>
      {label}
    </text>
  </g>
);

export function ThreadsShareHeap() {
  return (
    <svg viewBox="0 0 640 250" className="block w-full" role="img" aria-label="two threads each have their own stack, both point into one shared heap">
      <defs>
        <marker id="tsh-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
        </marker>
      </defs>

      {/* thread 1 */}
      <text x={20} y={22} fontSize={11} fill="var(--faint)">thread main · stack</text>
      <line x1={20} y1={32} x2={170} y2={32} stroke="var(--line)" />
      {frame(20, 150, 150, "main()")}
      {frame(20, 114, 150, "handle(req)", true)}

      {/* thread 2 */}
      <text x={470} y={22} fontSize={11} fill="var(--faint)">thread worker · stack</text>
      <line x1={470} y1={32} x2={620} y2={32} stroke="var(--line)" />
      {frame(470, 150, 150, "run()")}
      {frame(470, 114, 150, "flush()", true)}

      {/* heap */}
      <text x={240} y={22} fontSize={11} fill="var(--faint)">heap · shared by every thread</text>
      <line x1={240} y1={32} x2={400} y2={32} stroke="var(--line)" />
      <rect x={250} y={58} width={140} height={44} rx={2} fill="var(--well)" stroke="var(--hot)" />
      <text x={262} y={77} fontSize={12} fill="var(--hi)">ArrayList</text>
      <text x={262} y={93} fontSize={10} fill="var(--hot)">reachable from both</text>
      <rect x={250} y={150} width={140} height={34} rx={2} fill="var(--well)" stroke="var(--line-2)" />
      <text x={262} y={171} fontSize={12} fill="var(--hi)">Request</text>

      {/* references */}
      <path d="M 166 129 C 210 129, 210 80, 248 80" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#tsh-ah)" />
      <path d="M 166 133 C 205 140, 210 167, 248 167" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#tsh-ah)" />
      <path d="M 474 129 C 430 129, 430 80, 392 80" fill="none" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#tsh-ah)" />
      <circle cx={166} cy={129} r={3} fill="var(--ref)" />
      <circle cx={166} cy={133} r={0} />
      <circle cx={474} cy={129} r={3} fill="var(--ref)" />

      <text x={20} y={222} fontSize={11} fill="var(--mute)">locals: private to their thread.</text>
      <text x={250} y={222} fontSize={11} fill="var(--mute)">objects: anyone with a reference can touch them.</text>
    </svg>
  );
}
