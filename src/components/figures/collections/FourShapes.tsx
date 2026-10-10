// four shapes of data, side by side. static svg, tokens only.
// List = slots by index. Set = a bag that says no to duplicates.
// Deque = a line with two open ends. Map = keys that each lead to one value.

const box = (x: number, y: number, label: string, opts: { w?: number; dim?: boolean; hi?: boolean } = {}) => (
  <g key={`${x}-${y}-${label}`}>
    <rect
      x={x}
      y={y}
      width={opts.w ?? 26}
      height={26}
      rx={2}
      fill="var(--bg)"
      stroke={opts.hi ? "var(--ink)" : "var(--line-2)"}
      strokeDasharray={opts.dim ? "3 3" : undefined}
    />
    <text x={x + (opts.w ?? 26) / 2} y={y + 17} textAnchor="middle" fontSize={12} fill={opts.dim ? "var(--faint)" : "var(--hi)"}>
      {label}
    </text>
  </g>
);

function ListShape() {
  const xs = ["a", "b", "a", "c"];
  return (
    <svg fontFamily="var(--font-code)" viewBox="0 0 150 96" className="block w-full" role="img" aria-label="a list: slots 0 to 3 holding a, b, a, c. duplicates are fine.">
      {xs.map((v, i) => box(14 + i * 30, 26, v))}
      {xs.map((_, i) => (
        <text key={i} x={27 + i * 30} y={68} textAnchor="middle" fontSize={10} fill="var(--faint)">
          {i}
        </text>
      ))}
      <text x={14} y={14} fontSize={10} fill="var(--faint)">
        get(2) → a
      </text>
    </svg>
  );
}

function SetShape() {
  return (
    <svg fontFamily="var(--font-code)" viewBox="0 0 150 96" className="block w-full" role="img" aria-label="a set: a bag holding a, b and c. adding a again is refused.">
      <rect x={10} y={20} width={96} height={64} rx={14} fill="none" stroke="var(--line-2)" />
      {box(18, 28, "b")}
      {box(70, 32, "a")}
      {box(46, 54, "c")}
      <g>
        {box(116, 40, "a", { dim: true })}
        <line x1={112} y1={53} x2={146} y2={53} stroke="var(--faint)" />
      </g>
      <text x={10} y={12} fontSize={10} fill="var(--faint)">
        add(a) → false
      </text>
    </svg>
  );
}

function DequeShape() {
  return (
    <svg fontFamily="var(--font-code)" viewBox="0 0 150 96" className="block w-full" role="img" aria-label="a deque: a line of x, y, z with both ends open for adding and removing.">
      <line x1={30} y1={24} x2={120} y2={24} stroke="var(--line-2)" />
      <line x1={30} y1={62} x2={120} y2={62} stroke="var(--line-2)" />
      {box(36, 30, "x")}
      {box(62, 30, "y")}
      {box(88, 30, "z")}
      <path d="M4 38 L24 38 M18 33 L24 38 L18 43" fill="none" stroke="var(--ink)" />
      <path d="M24 50 L4 50 M10 45 L4 50 L10 55" fill="none" stroke="var(--ink)" />
      <path d="M126 38 L146 38 M140 33 L146 38 L140 43" fill="none" stroke="var(--ink)" />
      <path d="M146 50 L126 50 M132 45 L126 50 L132 55" fill="none" stroke="var(--ink)" />
      <text x={4} y={82} fontSize={10} fill="var(--faint)">
        first
      </text>
      <text x={146} y={82} textAnchor="end" fontSize={10} fill="var(--faint)">
        last
      </text>
    </svg>
  );
}

function MapShape() {
  const rows: [string, string][] = [
    ["ada", "36"],
    ["bob", "41"],
    ["eve", "36"],
  ];
  return (
    <svg fontFamily="var(--font-code)" viewBox="0 0 150 96" className="block w-full" role="img" aria-label="a map: keys ada, bob, eve, each leading to one value. values can repeat, keys can't.">
      {rows.map(([k, v], i) => (
        <g key={k}>
          {box(14, 6 + i * 30, k, { w: 44 })}
          <line x1={62} y1={19 + i * 30} x2={92} y2={19 + i * 30} stroke="var(--mute)" />
          <path d={`M87 ${15 + i * 30} L92 ${19 + i * 30} L87 ${23 + i * 30}`} fill="none" stroke="var(--mute)" />
          {box(96, 6 + i * 30, v, { w: 34 })}
        </g>
      ))}
    </svg>
  );
}

const SHAPES = [
  { name: "List", note: "by position. duplicates fine.", el: <ListShape /> },
  { name: "Set", note: "no duplicates. that's the whole job.", el: <SetShape /> },
  { name: "Deque", note: "in and out at either end.", el: <DequeShape /> },
  { name: "Map", note: "unique keys, each to one value.", el: <MapShape /> },
];

export function FourShapes() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      {SHAPES.map((s) => (
        <div key={s.name} className="min-w-0">
          <div className="mb-2 border-b border-line pb-1.5 text-12 text-hi">{s.name}</div>
          {s.el}
          <div className="mt-2 text-11 leading-[1.5] text-mute">{s.note}</div>
        </div>
      ))}
    </div>
  );
}
