"use client";

import { useMemo, useState } from "react";

type BitType = "byte" | "short" | "char" | "int" | "long" | "float" | "double";

const WIDTH: Record<BitType, number> = { byte: 8, short: 16, char: 16, int: 32, long: 64, float: 32, double: 64 };

/**
 * the actual bits of a java value. click bits to flip them when `editable`.
 *
 *   <Bits type="int" value={-1} />
 *   <Bits type="float" value={0.1} editable />
 *   <Bits type="long" value="9223372036854775807" />
 */
export function Bits({
  type = "int",
  value = 0,
  editable,
  label,
  input,
}: {
  type?: BitType;
  value?: number | string;
  editable?: boolean;
  label?: string;
  /** show a text box to type a value */
  input?: boolean;
}) {
  const n = WIDTH[type];
  const [raw, setRaw] = useState<bigint>(() => toRaw(type, value));
  const [text, setText] = useState(String(value));
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => Number((raw >> BigInt(n - 1 - i)) & 1n)), [raw, n]);
  const shown = fromRaw(type, raw);

  const flip = (i: number) => {
    if (!editable) return;
    const next = raw ^ (1n << BigInt(n - 1 - i));
    setRaw(next);
    setText(fromRaw(type, next).text);
  };

  const groups = fieldsFor(type);

  return (
    <div className="bits inline-flex max-w-full flex-col gap-3 overflow-x-auto">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-12">
        <span className="text-mute">{label ?? type}</span>
        {input ? (
          <label className="flex items-baseline gap-2">
            <span className="text-faint">value =</span>
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                try {
                  setRaw(toRaw(type, e.target.value));
                } catch {}
              }}
              className="w-[22ch] border-b border-line-2 bg-transparent text-14 text-hi outline-none focus:border-hi"
              spellCheck={false}
            />
          </label>
        ) : (
          <span className="text-14 text-hi tabular">{shown.text}</span>
        )}
        <span className="text-faint tabular">0x{raw.toString(16).padStart(n / 4, "0")}</span>
      </div>
      {/* bits come in nibbles that wrap as a unit, so 64 bits fold neatly on a phone */}
      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
        {Array.from({ length: n / 4 }, (_, q) => {
          const startsField = q > 0 && groups.some((g) => g.from > 0 && g.from > (q - 1) * 4 && g.from <= q * 4 && g.from % 4 === 0);
          return (
            <div key={q} className={`flex ${startsField ? "ml-1.5" : ""}`}>
              {bits.slice(q * 4, q * 4 + 4).map((b, j) => {
                const i = q * 4 + j;
                const g = groups.find((g) => i >= g.from && i < g.from + g.len)!;
                const fieldStart = i > 0 && i % 4 !== 0 && groups.some((gg) => gg.from === i);
                const tone = g.tone ? `var(--${g.tone})` : null;
                return (
                  <button
                    key={i}
                    onClick={() => flip(i)}
                    disabled={!editable}
                    aria-label={`bit ${n - 1 - i}: ${b}`}
                    className={`-ml-px flex h-7 w-[16px] shrink-0 items-center justify-center text-11 transition-colors duration-120 first:ml-0 disabled:cursor-default ${
                      fieldStart ? "!ml-1.5" : ""
                    } ${editable ? "hover:!shadow-[inset_0_0_0_1.5px_var(--hot)]" : ""}`}
                    style={
                      b
                        ? {
                            background: `color-mix(in srgb, ${tone ?? "var(--hi)"} ${tone ? 18 : 12}%, var(--bg))`,
                            color: tone ?? "var(--hi)",
                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone ?? "var(--hi)"} 45%, transparent)`,
                            fontWeight: 600,
                          }
                        : { color: "var(--faint)", boxShadow: "inset 0 0 0 1px var(--line-2)" }
                    }
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-x-5 text-11 text-faint">
          {groups.map((g) => (
            <span key={g.name}>
              <span style={{ color: g.tone ? `var(--${g.tone})` : undefined }}>{g.name}</span> · {g.len} bit
              {g.len > 1 ? "s" : ""}
            </span>
          ))}
        </div>
      )}
      {shown.detail && <div className="text-12 text-mute">{shown.detail}</div>}
    </div>
  );
}

type Group = { name: string; from: number; len: number; tone?: "hot" | "meta" | "ref"; nibbles?: boolean };

function fieldsFor(t: BitType): Group[] {
  if (t === "float")
    return [
      { name: "sign", from: 0, len: 1, tone: "hot" },
      { name: "exponent", from: 1, len: 8, tone: "meta" },
      { name: "mantissa", from: 9, len: 23 },
    ];
  if (t === "double")
    return [
      { name: "sign", from: 0, len: 1, tone: "hot" },
      { name: "exponent", from: 1, len: 11, tone: "meta" },
      { name: "mantissa", from: 12, len: 52 },
    ];
  if (t === "char") return [{ name: "utf-16 code unit", from: 0, len: 16, nibbles: true }];
  return [
    { name: "sign", from: 0, len: 1, tone: "hot" },
    { name: "value", from: 1, len: WIDTH[t] - 1, nibbles: true },
  ];
}

function toRaw(t: BitType, v: number | string): bigint {
  const n = WIDTH[t];
  if (t === "float" || t === "double") {
    const x = Number(v);
    const dv = new DataView(new ArrayBuffer(8));
    if (t === "float") {
      dv.setFloat32(0, x);
      return BigInt(dv.getUint32(0));
    }
    dv.setFloat64(0, x);
    return dv.getBigUint64(0);
  }
  if (t === "char" && typeof v === "string" && v.length === 1) return BigInt(v.charCodeAt(0));
  const s = String(v).trim().replace(/[lL_]/g, "");
  return BigInt.asUintN(n, BigInt(s));
}

function fromRaw(t: BitType, raw: bigint): { text: string; detail?: string } {
  const n = WIDTH[t];
  if (t === "float" || t === "double") {
    const dv = new DataView(new ArrayBuffer(8));
    let x: number;
    if (t === "float") {
      dv.setUint32(0, Number(raw));
      x = dv.getFloat32(0);
    } else {
      dv.setBigUint64(0, raw);
      x = dv.getFloat64(0);
    }
    const exact = Number.isFinite(x) ? x.toPrecision(t === "float" ? 12 : 20).replace(/\.?0+$/, "") : "";
    return {
      text: Number.isNaN(x) ? "NaN" : !Number.isFinite(x) ? (x > 0 ? "Infinity" : "-Infinity") : String(x),
      detail: exact && exact !== String(x) ? `actually stored: ${exact}…` : undefined,
    };
  }
  if (t === "char") {
    const c = Number(raw);
    return { text: `'${String.fromCharCode(c)}' (${c})` };
  }
  return { text: BigInt.asIntN(n, raw).toString() };
}
