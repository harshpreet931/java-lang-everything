import type { ReactNode } from "react";

// "2026 lens": what modern java changed about an item. styled like the site's callouts
// (2px rule, italic display label, serif body), in hot = "look here, this changed".
// server component, no state.
//
//   <Lens v={16}>records write equals, hashCode and toString for you.</Lens>

export function Lens({ v, children }: { v?: number | string; children: ReactNode }) {
  return (
    <aside
      className="measure lens mx-auto my-8 border-l-2 pl-6 text-[1.06rem] leading-[1.75] [&>p+p]:mt-2"
      style={{ borderColor: "color-mix(in srgb, var(--hot) 55%, transparent)" }}
    >
      <div className="mb-0.5 flex items-center gap-2.5">
        <span className="font-display text-[1.15rem] text-hot italic">2026 lens</span>
        {v !== undefined && (
          <span className="rounded-sm px-1.5 font-mono text-11 leading-[18px] text-mute shadow-[inset_0_0_0_1px_var(--line-2)]">
            {typeof v === "number" ? `java ${v}+` : v}
          </span>
        )}
      </div>
      {children}
    </aside>
  );
}
