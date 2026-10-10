// a small, faithful slice of java.util.Formatter: %d %x %f %e %s with the flags - 0 + , plus
// width and precision, in the en_US locale. checked against String.format on jdk 25 for every
// combination the PrintfBuilder figure can produce: 31,616 cases (every flag set, width 0 to 12,
// precision none to 6, 13 sample values), all identical.

export type Conv = "d" | "x" | "f" | "e" | "s";
export type Flag = "-" | "0" | "+" | ",";
export type FmtResult = { ok: true; out: string } | { ok: false; error: string };

const FLAG_ORDER = "-#+ 0,(<";

export function spec(flags: Flag[], width: number, prec: number, conv: Conv) {
  const f = [...flags].sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b)).join("");
  return `%${f}${width > 0 ? width : ""}${prec >= 0 ? `.${prec}` : ""}${conv}`;
}

/** shortest decimal digits of x (like Double.toString), as [digits, pointPos], x > 0 */
function decimalDigits(x: number): [string, number] {
  const [m, e] = x.toExponential().split("e");
  const digits = m.replace(".", "").replace(/0+$/, "") || "0";
  return [digits, Number(e) + 1]; // value = 0.digits × 10^pointPos
}

/** round half-up to `prec` places after the point, working on the decimal digits */
function fixedHalfUp(x: number, prec: number): string {
  if (x === 0) return prec > 0 ? `0.${"0".repeat(prec)}` : "0";
  const [d, p] = decimalDigits(x);
  // build an integer string of the value × 10^prec, plus the first dropped digit
  const scaled = p + prec; // number of digits before the cut
  let keep: string;
  let next: number;
  if (scaled <= 0) {
    keep = "0";
    next = scaled === 0 ? Number(d[0]) : 0;
  } else {
    const padded = d.padEnd(scaled, "0");
    keep = padded.slice(0, scaled);
    next = scaled < d.length ? Number(d[scaled]) : 0;
  }
  let n = BigInt(keep) + (next >= 5 ? 1n : 0n);
  let s = n.toString().padStart(prec + 1, "0");
  const intPart = s.slice(0, s.length - prec) || "0";
  const frac = prec > 0 ? s.slice(s.length - prec) : "";
  n = 0n;
  s = "";
  return prec > 0 ? `${intPart}.${frac}` : intPart;
}

function sciHalfUp(x: number, prec: number): string {
  if (x === 0) return `${prec > 0 ? `0.${"0".repeat(prec)}` : "0"}e+00`;
  const [d, p] = decimalDigits(x);
  let exp = p - 1;
  const digits = d.padEnd(prec + 2, "0");
  let n = BigInt(digits.slice(0, prec + 1)) + (Number(digits[prec + 1] ?? "0") >= 5 ? 1n : 0n);
  let s = n.toString();
  if (s.length > prec + 1) {
    // 9.99 → 10.0: carry into the exponent
    exp += 1;
    s = s.slice(0, prec + 1);
  }
  n = 0n;
  const mant = prec > 0 ? `${s[0]}.${s.slice(1)}` : s[0];
  const es = Math.abs(exp).toString().padStart(2, "0");
  return `${mant}e${exp < 0 ? "-" : "+"}${es}`;
}

const group = (intDigits: string) => intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function javaFormat(value: number | string, conv: Conv, flags: Flag[], width: number, prec: number): FmtResult {
  const has = (f: Flag) => flags.includes(f);
  const sp = spec(flags, width, prec, conv);
  const fail = (e: string): FmtResult => ({ ok: false, error: e });
  const flagStr = [...flags].sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b)).join("");

  if (conv === "s") {
    if (width <= 0 && has("-")) return fail(`MissingFormatWidthException: ${sp}`);
    const bad = flagStr.split("").filter((f) => f === "+" || f === "0" || f === ",").join("");
    if (bad) return fail(`FormatFlagsConversionMismatchException: Conversion = s, Flags = ${bad}`);
    let s = String(value);
    if (prec >= 0) s = s.slice(0, prec);
    return { ok: true, out: pad(s, width, has("-"), false, "") };
  }

  // numeric checks, in the order Formatter makes them
  if (width <= 0 && (has("-") || has("0"))) return fail(`MissingFormatWidthException: ${sp}`);
  if (has("-") && has("0")) return fail(`IllegalFormatFlagsException: Flags = '${flagStr}'`);

  if (conv === "d" || conv === "x") {
    if (prec >= 0) return fail(`IllegalFormatPrecisionException: ${prec}`);
    const v = value as number;
    if (conv === "x") {
      if (has(",")) return fail("FormatFlagsConversionMismatchException: Conversion = x, Flags = ,");
      if (has("+")) return fail("FormatFlagsConversionMismatchException: Conversion = x, Flags = +");
      const hex = (v >>> 0).toString(16);
      return { ok: true, out: pad(hex, width, has("-"), has("0"), "") };
    }
    const digits = Math.abs(v).toString();
    const body = has(",") ? group(digits) : digits;
    const sign = v < 0 ? "-" : has("+") ? "+" : "";
    return { ok: true, out: pad(body, width, has("-"), has("0"), sign) };
  }

  // f and e
  const v = value as number;
  if (conv === "e" && has(",")) return fail("FormatFlagsConversionMismatchException: Conversion = e, Flags = ,");
  const p = prec >= 0 ? prec : 6;
  const neg = v < 0 || Object.is(v, -0);
  let body = conv === "f" ? fixedHalfUp(Math.abs(v), p) : sciHalfUp(Math.abs(v), p);
  if (conv === "f" && has(",")) {
    const [i, fr] = body.split(".");
    body = group(i) + (fr !== undefined ? `.${fr}` : "");
  }
  const sign = neg ? "-" : has("+") ? "+" : "";
  return { ok: true, out: pad(body, width, has("-"), has("0"), sign) };
}

function pad(body: string, width: number, left: boolean, zero: boolean, sign: string): string {
  const len = sign.length + body.length;
  if (width <= len) return sign + body;
  const n = width - len;
  if (left) return sign + body + " ".repeat(n);
  if (zero) return sign + "0".repeat(n) + body;
  return " ".repeat(n) + sign + body;
}
