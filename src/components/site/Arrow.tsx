/**
 * a small drawn arrow. the faces are latin subsets with no arrow glyphs (→ ← ↵ fall back to
 * whatever the system has), so chrome draws its arrows. inherits colour, sized in px.
 */
const PATHS = {
  left: "M9 5H1.5M4.5 2 1.5 5l3 3",
  right: "M1 5h7.5M5.5 2l3 3-3 3",
  up: "M5 8.5V1.5M2 4.5l3-3 3 3",
  down: "M5 1.5v7M2 5.5l3 3 3-3",
  enter: "M8.5 1.5v4h-7M4 3 1.5 5.5 4 8",
} as const;

export function Arrow({ dir, size = 10, className }: { dir: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[dir]} />
    </svg>
  );
}
