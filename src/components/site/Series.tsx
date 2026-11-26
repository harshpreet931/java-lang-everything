import { Mark } from "./Mark";

// the everything series: one line in the footer that points at the sibling book.
// server component, no js. the series mark never takes a colour.

const OTHER = {
  href: "https://sql.harshpreet.com",
  prefix: "select * from ",
  says: "sql, all the way down",
};

export function Series({ className }: { className?: string }) {
  return (
    <p
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 10,
        rowGap: 2,
        margin: 0,
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        lineHeight: 1.4,
        color: "var(--mute)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Mark kind="series" size={14} style={{ color: "var(--mute)" }} />
        the everything series
      </span>
      <span aria-hidden style={{ color: "var(--faint)" }}>
        /
      </span>
      <a
        href={OTHER.href}
        className="rounded-xs no-underline decoration-[color-mix(in_oklab,var(--book)_55%,transparent)] decoration-1 underline-offset-[0.22em] hover:underline"
        style={{ display: "inline-flex", alignItems: "center", minHeight: 40, color: "var(--hi)", whiteSpace: "pre" }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mute)", letterSpacing: "-0.01em" }}>{OTHER.prefix}</span>
        <span style={{ fontFamily: "var(--font-title)", fontSize: 17, letterSpacing: "-0.01em" }}>everything</span>
        <span style={{ color: "var(--mute)", fontStyle: "italic", fontFamily: "var(--font-body)", fontSize: 14 }}>, {OTHER.says}</span>
      </a>
    </p>
  );
}
