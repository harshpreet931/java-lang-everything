import type { ReactNode } from "react";

// item 52. when each choice is made. overloading is resolved by javac from the static
// type of the argument; overriding is resolved by the JVM from the object's real class.
// hot marks the moment the decision actually happens. static, no state.

function Cell({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <div
      className="rounded-md px-3.5 py-3 text-12 leading-[1.6]"
      style={{
        background: on ? "color-mix(in srgb, var(--hot) 9%, var(--bg))" : "var(--bg)",
        boxShadow: `inset 0 0 0 1px ${on ? "color-mix(in srgb, var(--hot) 60%, transparent)" : "var(--line-2)"}`,
        color: on ? "var(--ink)" : "var(--faint)",
      }}
    >
      {children}
    </div>
  );
}

export function DispatchTime() {
  return (
    <div className="@container font-mono">
      <div className="mb-3 rounded-md bg-bg px-3.5 py-2.5 text-12 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
        <span className="text-faint">given </span>Object t = &quot;hi&quot;;
      </div>
      <div className="grid gap-2 @[600px]:grid-cols-[16ch_minmax(0,1fr)_minmax(0,1fr)]">
        <span className="hidden @[600px]:block" />
        <span className="hidden text-11 text-faint @[600px]:block">compile time · javac</span>
        <span className="hidden text-11 text-faint @[600px]:block">run time · the JVM, every call</span>

        <span className="self-center text-12 text-hi">
          overloading
          <br />
          <span className="text-faint">kind(t)</span>
        </span>
        <Cell on>
          the static type of <span className="text-hi">t</span> is Object, so javac binds{" "}
          <span className="text-hi">kind(Object)</span>. decided, forever.
        </Cell>
        <Cell>
          calls whatever javac picked. the String inside never gets a vote. → <span className="text-dead">&quot;object&quot;</span>
        </Cell>

        <span className="mt-2 self-center text-12 text-hi @[600px]:mt-0">
          overriding
          <br />
          <span className="text-faint">t.toString()</span>
        </span>
        <Cell>only checks that Object has a toString(). doesn&apos;t pick a body.</Cell>
        <Cell on>
          looks at the object: it&apos;s a String, so String&apos;s toString() runs. →{" "}
          <span className="text-live">&quot;hi&quot;</span>
        </Cell>
      </div>
    </div>
  );
}
