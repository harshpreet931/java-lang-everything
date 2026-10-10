/**
 * the mark: three layers, fading as they go down. java, all the way down.
 * never recolour it, never light all three.
 */
export function Mark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden
      className={className}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="1" width="14" height="3" fill="var(--hi)" />
      <rect x="2" y="6" width="10" height="3" fill="var(--mute)" />
      <rect x="4" y="11" width="6" height="2" fill="var(--line-2)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Mark />
      <span className="font-mono text-13 tracking-[-0.01em]">
        <span className="text-faint">java.lang.</span>
        <span className="font-medium text-hi">everything</span>
      </span>
    </span>
  );
}
