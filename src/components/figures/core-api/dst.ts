// how java.time resolves a LocalDateTime in a zone around a DST transition.
// transitions are java.time's own (tzdb 2026b, temurin 25.0.4). the resolution rule is
// ZonedDateTime.of's: in a gap, shift forward by the gap's length; in an overlap, keep the
// earlier offset (withLaterOffsetAtOverlap() picks the later one).
// every 15-minute slot from 00:00 to 04:00 was checked against real java output.

export type DstCase = {
  id: string;
  zone: string;
  date: string; // local date of the transition
  label: string;
  /** local wall time (minutes after midnight) at which the transition happens, in the "before" offset */
  at: number;
  /** utc offsets in minutes */
  before: number;
  after: number;
};

export const CASES: DstCase[] = [
  { id: "ny-spring", zone: "America/New_York", date: "2026-03-08", label: "new york, march", at: 120, before: -300, after: -240 },
  { id: "ny-fall", zone: "America/New_York", date: "2026-11-01", label: "new york, november", at: 120, before: -240, after: -300 },
  { id: "ldn-spring", zone: "Europe/London", date: "2026-03-29", label: "london, march", at: 60, before: 0, after: 60 },
  { id: "ldn-fall", zone: "Europe/London", date: "2026-10-25", label: "london, october", at: 120, before: 60, after: 0 },
];

export type Resolved = {
  kind: "normal" | "gap" | "overlap";
  /** local minutes after midnight that java actually lands on */
  local: number;
  offset: number;
  /** for overlaps: the other valid offset */
  laterOffset?: number;
  zdt: string;
  zdtLater?: string;
  instant: string;
  instantLater?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const fmtOffset = (m: number) => {
  if (m === 0) return "Z";
  const s = m < 0 ? "-" : "+";
  const a = Math.abs(m);
  return `${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
};

export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function zdt(c: DstCase, local: number, off: number) {
  return `${c.date}T${hhmm(local)}${fmtOffset(off)}[${c.zone}]`;
}

function instant(c: DstCase, local: number, off: number) {
  const [y, mo, d] = c.date.split("-").map(Number);
  const ms = Date.UTC(y, mo - 1, d, 0, local - off);
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00Z`;
}

/** resolve a local time (minutes after midnight on c.date) the way ZonedDateTime.of does. */
export function resolve(c: DstCase, local: number): Resolved {
  const shift = c.after - c.before; // +60 for a gap, -60 for an overlap
  if (shift > 0 && local >= c.at && local < c.at + shift) {
    const l = local + shift;
    return { kind: "gap", local: l, offset: c.after, zdt: zdt(c, l, c.after), instant: instant(c, l, c.after) };
  }
  if (shift < 0 && local >= c.at + shift && local < c.at) {
    return {
      kind: "overlap",
      local,
      offset: c.before,
      laterOffset: c.after,
      zdt: zdt(c, local, c.before),
      zdtLater: zdt(c, local, c.after),
      instant: instant(c, local, c.before),
      instantLater: instant(c, local, c.after),
    };
  }
  const off = local < c.at + Math.min(0, shift) ? c.before : c.after;
  return { kind: "normal", local, offset: off, zdt: zdt(c, local, off), instant: instant(c, local, off) };
}
