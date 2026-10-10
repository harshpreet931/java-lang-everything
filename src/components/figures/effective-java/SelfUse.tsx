// item 18. a subclass of ArrayList that rejects nulls in add(). you'd assume addAll and
// add(index, e) go through add(). they don't: ArrayList copies straight into its array.
// static svg. ref = the calls that really happen, hot dashed = the call you assumed,
// dead = what ends up in the array.

export function SelfUse() {
  return (
    <svg
      viewBox="0 0 640 256"
      fontFamily="var(--font-code)"
      className="block w-full"
      role="img"
      aria-label="NoNullList overrides add to reject null. names.addAll and names.add(0, null) go into ArrayList's own code, which copies into the array directly without calling the overridden add, so nulls get in."
    >
      <defs>
        <marker id="su-ref" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--ref)" />
        </marker>
        <marker id="su-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 L7.5 4 L0 7.5 z" fill="var(--hot)" />
        </marker>
      </defs>

      {/* caller */}
      <text x={16} y={22} fontSize={11} fill="var(--faint)">
        your code
      </text>
      <rect x={16} y={32} width={170} height={96} rx={6} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={28} y={58} fontSize={11} fill="var(--ink)">names.add(&quot;ada&quot;)</text>
      <text x={28} y={86} fontSize={11} fill="var(--ink)">names.addAll(…, null)</text>
      <text x={28} y={114} fontSize={11} fill="var(--ink)">names.add(0, null)</text>

      {/* subclass */}
      <text x={236} y={22} fontSize={11} fill="var(--faint)">
        NoNullList (yours)
      </text>
      <rect x={236} y={32} width={160} height={46} rx={6} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={248} y={52} fontSize={11} fill="var(--hi)">add(e)</text>
      <text x={248} y={68} fontSize={10} fill="var(--live)">checks for null ✓</text>

      {/* superclass */}
      <text x={236} y={112} fontSize={11} fill="var(--faint)">
        ArrayList (JDK)
      </text>
      <rect x={236} y={122} width={160} height={70} rx={6} fill="var(--bg)" stroke="var(--line-2)" />
      <text x={248} y={144} fontSize={11} fill="var(--hi)">addAll(c)</text>
      <text x={248} y={172} fontSize={11} fill="var(--hi)">add(index, e)</text>

      {/* the array */}
      <text x={460} y={176} fontSize={11} fill="var(--faint)">
        Object[] elementData
      </text>
      {["null", "ada", "bo", "null"].map((v, i) => (
        <g key={i}>
          <rect
            x={460 + i * 42}
            y={122}
            width={42}
            height={34}
            fill="var(--bg)"
            stroke={v === "null" ? "var(--dead)" : "var(--line-2)"}
          />
          <text x={481 + i * 42} y={143} fontSize={11} textAnchor="middle" fill={v === "null" ? "var(--dead)" : "var(--ink)"}>
            {v}
          </text>
        </g>
      ))}

      {/* real calls */}
      <path d="M 186 54 L 232 54" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <path d="M 396 55 C 480 55, 523 70, 523 118" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <path d="M 186 82 C 210 82, 210 140, 232 140" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <path d="M 186 110 C 205 110, 210 168, 232 168" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <path d="M 396 140 L 456 140" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <path d="M 396 168 C 420 168, 430 150, 456 148" stroke="var(--ref)" strokeWidth={1.25} markerEnd="url(#su-ref)" fill="none" />
      <text x={236} y={210} fontSize={10} fill="var(--mute)">copies into the array, no add()</text>

      {/* assumed call */}
      <path
        d="M 378 122 C 378 104, 378 98, 378 82"
        stroke="var(--hot)"
        strokeWidth={1.25}
        strokeDasharray="4 3"
        markerEnd="url(#su-hot)"
        fill="none"
      />
      <text x={386} y={106} fontSize={10} fill="var(--hot)">
        what you assumed
      </text>

      <text x={16} y={240} fontSize={11} fill="var(--mute)">
        the subclass&apos;s promise depends on how the superclass happens to be written.
      </text>
    </svg>
  );
}
