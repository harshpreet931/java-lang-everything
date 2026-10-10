"use client";

import { useState } from "react";
import { Narr, Row, Words } from "./kit";

// two gates every logging framework has: the logger's level, then each handler's (appender's) level.
// level names are System.Logger's; java.util.logging and SLF4J have the same idea with other names.

const LEVELS = ["TRACE", "DEBUG", "INFO", "WARNING", "ERROR"] as const;
type L = (typeof LEVELS)[number] | "OFF";
const rank = (l: L) => (l === "OFF" ? 99 : LEVELS.indexOf(l));

const EVENTS: { level: (typeof LEVELS)[number]; msg: string }[] = [
  { level: "TRACE", msg: "entering checkout(42)" },
  { level: "DEBUG", msg: "cart: 3 items, 1999 cents" },
  { level: "INFO", msg: "order 42 placed" },
  { level: "WARNING", msg: "stock low for sku-7" },
  { level: "ERROR", msg: "payment failed for order 42" },
];

const OPTS = [...LEVELS, "OFF"].map((l) => ({ v: l as L, label: l.toLowerCase() }));

export function LevelFunnel() {
  const [logger, setLogger] = useState<L>("DEBUG");
  const [consoleL, setConsole] = useState<L>("INFO");
  const [fileL, setFile] = useState<L>("TRACE");

  const rows = EVENTS.map((e) => {
    const passLogger = rank(e.level) >= rank(logger);
    return { ...e, passLogger, toConsole: passLogger && rank(e.level) >= rank(consoleL), toFile: passLogger && rank(e.level) >= rank(fileL) };
  });
  const dropped = rows.filter((r) => !r.passLogger).length;
  const nowhere = rows.filter((r) => r.passLogger && !r.toConsole && !r.toFile).length;

  return (
    <div className="@container grid gap-4 font-mono">
      <div className="text-13">
        <Row k="logger =" w="9ch">
          <Words<L> label="logger level" options={OPTS} value={logger} onChange={setLogger} />
        </Row>
        <Row k="console =" w="9ch">
          <Words<L> label="console handler level" options={OPTS} value={consoleL} onChange={setConsole} />
        </Row>
        <Row k="file =" w="9ch" last>
          <Words<L> label="file handler level" options={OPTS} value={fileL} onChange={setFile} />
        </Row>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-11 text-faint">
              <th className="py-1.5 pr-3 text-left font-mono font-normal">log call</th>
              <th className="py-1.5 pr-3 text-left font-mono font-normal">logger</th>
              <th className="py-1.5 pr-3 text-left font-mono font-normal">console</th>
              <th className="py-1.5 text-left font-mono font-normal">file</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level} className="border-t border-line">
                <td className="py-2 pr-3">
                  <span className={`block ${r.passLogger ? "text-hi" : "text-faint line-through"}`}>{r.level}</span>
                  <span className={`block text-11 ${r.passLogger ? "text-mute" : "text-faint"}`}>{r.msg}</span>
                </td>
                <td className="py-2 pr-3" style={{ color: r.passLogger ? "var(--ink)" : "var(--faint)" }}>
                  {r.passLogger ? "passes" : "dropped"}
                </td>
                <td className="py-2 pr-3" style={{ color: r.toConsole ? "var(--hot)" : "var(--faint)" }}>
                  {r.toConsole ? "printed" : "·"}
                </td>
                <td className="py-2" style={{ color: r.toFile ? "var(--hot)" : "var(--faint)" }}>
                  {r.toFile ? "written" : "·"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Narr>
        {dropped > 0 ? `${dropped} of 5 calls are stopped by the logger itself, the cheap gate: no record object, and with a supplier, no message string either. ` : "the logger lets everything through, so every call builds a record. "}
        {nowhere > 0
          ? `${nowhere} pass the logger but no handler wants them: built for nothing. set the logger no lower than the lowest handler.`
          : "every record the logger builds lands somewhere."}
      </Narr>
    </div>
  );
}
