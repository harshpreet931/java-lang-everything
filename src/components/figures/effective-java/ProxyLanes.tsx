import type { ReactNode } from "react";

// items 88 and 90. two ways an object can come back from bytes. default serialization
// allocates the object and pokes its fields in directly: your constructor never runs, so
// neither does your validation (dead). a serialization proxy writes a tiny "description"
// object instead, and readResolve rebuilds the real one through the public constructor,
// so every check runs again (live). records always take the second road.

type Step = { t: ReactNode; sub?: ReactNode; tone?: "live" | "dead" };

function Lane({ title, steps }: { title: ReactNode; steps: Step[] }) {
  return (
    <div className="grid gap-2">
      <div className="text-12 text-faint">{title}</div>
      <ol className="flex flex-col gap-1.5 @[640px]:flex-row @[640px]:items-stretch @[640px]:gap-0">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-col @[640px]:flex-1 @[640px]:flex-row @[640px]:items-stretch">
            <div
              className="flex min-w-0 flex-1 flex-col justify-center rounded-md px-3 py-2.5"
              style={{
                background: s.tone ? `color-mix(in srgb, var(--${s.tone}) 8%, var(--bg))` : "var(--bg)",
                boxShadow: `inset 0 0 0 1px ${s.tone ? `color-mix(in srgb, var(--${s.tone}) 55%, transparent)` : "var(--line-2)"}`,
              }}
            >
              <span className="text-12" style={{ color: s.tone ? `var(--${s.tone})` : "var(--hi)" }}>
                {s.t}
              </span>
              {s.sub && <span className="mt-0.5 text-11 leading-[1.4] text-mute">{s.sub}</span>}
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden className="flex items-center justify-center text-faint @[640px]:w-6">
                <span className="@[640px]:hidden">↓</span>
                <span className="hidden @[640px]:inline">→</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProxyLanes() {
  return (
    <div className="@container grid gap-6 font-mono">
      <Lane
        title="default serialization"
        steps={[
          { t: "Range(1, 5)", sub: "a valid object" },
          { t: "bytes", sub: "every field, as written" },
          { t: "readObject()", sub: "allocates, sets fields directly" },
          { t: "Range(?, ?)", sub: "no constructor ran. no checks ran.", tone: "dead" },
        ]}
      />
      <Lane
        title="serialization proxy (and every record)"
        steps={[
          { t: "Range(1, 5)", sub: "writeReplace() swaps in…" },
          { t: "Proxy(lo, hi)", sub: "just the logical data" },
          { t: "bytes", sub: "the proxy's fields" },
          { t: "readResolve()", sub: "calls new Range(lo, hi)" },
          { t: "Range(1, 5)", sub: "built by the constructor. checked.", tone: "live" },
        ]}
      />
    </div>
  );
}
