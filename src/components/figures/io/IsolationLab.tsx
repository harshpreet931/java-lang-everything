"use client";

import { useState, type ReactNode } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";
import { NARR, Row, Words, ring, tint } from "./kit";

// the three read phenomena from the SQL standard (ANSI SQL-92, as JDBC's TRANSACTION_* levels
// name them), simulated with two transactions. each level shows what the STANDARD allows.
// real databases are often stricter: postgres and mysql/innodb run REPEATABLE READ on a
// snapshot, so the phantom below doesn't show up there either. the chapter says so.

type Iso = "READ_UNCOMMITTED" | "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE";
type Anomaly = "dirty" | "nonrepeatable" | "phantom";

const ISOS: Iso[] = ["READ_UNCOMMITTED", "READ_COMMITTED", "REPEATABLE_READ", "SERIALIZABLE"];
const RANK: Record<Iso, number> = { READ_UNCOMMITTED: 0, READ_COMMITTED: 1, REPEATABLE_READ: 2, SERIALIZABLE: 3 };

// an anomaly is possible below this level, prevented from this level up
const PREVENTED_AT: Record<Anomaly, number> = { dirty: 1, nonrepeatable: 2, phantom: 3 };

type Op = { t: 1 | 2; sql: string; result?: (bad: boolean) => string; db: (bad: boolean) => string };
type Scenario = { title: string; ops: Op[]; bad: string; good: string };

const SCEN: Record<Anomaly, Scenario> = {
  dirty: {
    title: "dirty read",
    ops: [
      { t: 1, sql: "BEGIN", db: () => "alice = 100" },
      { t: 1, sql: "UPDATE accounts SET balance = 0 WHERE name = 'alice'", db: () => "alice = 100 · T1's uncommitted: 0" },
      { t: 2, sql: "SELECT balance FROM accounts WHERE name = 'alice'", result: (bad) => (bad ? "0" : "100"), db: () => "alice = 100 · T1's uncommitted: 0" },
      { t: 1, sql: "ROLLBACK", db: () => "alice = 100" },
    ],
    bad: "T2 read 0, a balance that was rolled back and never existed. any decision it makes on that (decline a payment, send an alert) is based on fiction.",
    good: "T2 only sees committed data, so it read 100. T1's change was invisible to everyone until commit, and it never committed.",
  },
  nonrepeatable: {
    title: "non-repeatable read",
    ops: [
      { t: 2, sql: "BEGIN", db: () => "alice = 100" },
      { t: 2, sql: "SELECT balance FROM accounts WHERE name = 'alice'", result: () => "100", db: () => "alice = 100" },
      { t: 1, sql: "UPDATE accounts SET balance = 50 WHERE name = 'alice'; COMMIT", db: () => "alice = 50" },
      { t: 2, sql: "SELECT balance FROM accounts WHERE name = 'alice'", result: (bad) => (bad ? "50" : "100"), db: () => "alice = 50" },
    ],
    bad: "the same SELECT, twice in one transaction, gave 100 then 50. code that checks a value and later acts on it (if balance ≥ 80, then charge 80) is checking something that already changed.",
    good: "T2 reads 100 both times. it keeps seeing the row as it was when it first read it (a lock or a snapshot, depending on the database).",
  },
  phantom: {
    title: "phantom read",
    ops: [
      { t: 2, sql: "BEGIN", db: () => "2 orders over 100" },
      { t: 2, sql: "SELECT COUNT(*) FROM orders WHERE total > 100", result: () => "2", db: () => "2 orders over 100" },
      { t: 1, sql: "INSERT INTO orders (total) VALUES (500); COMMIT", db: () => "3 orders over 100" },
      { t: 2, sql: "SELECT COUNT(*) FROM orders WHERE total > 100", result: (bad) => (bad ? "3" : "2"), db: () => "3 orders over 100" },
    ],
    bad: "no row T2 read was changed, yet a new row appeared in its range: a phantom. per-row locks can't stop it, because the row didn't exist yet when T2 locked what it saw.",
    good: "SERIALIZABLE behaves as if the two transactions ran one after the other, so T2 counts 2 both times (or one of them is aborted and has to retry).",
  },
};

export function IsolationLab() {
  const [an, setAn] = useState<Anomaly>("dirty");
  const [iso, setIso] = useState<Iso>("READ_UNCOMMITTED");
  return (
    <div className="@container text-13">
      <Row k="anomaly =" w="11ch">
        <Words
          label="anomaly"
          options={[
            { v: "dirty", label: "dirty read" },
            { v: "nonrepeatable", label: "non-repeatable read" },
            { v: "phantom", label: "phantom" },
          ]}
          value={an}
          onChange={setAn}
        />
      </Row>
      <Row k="isolation =" w="11ch" last>
        <Words label="isolation level" options={ISOS.map((i) => ({ v: i, label: i.toLowerCase().replace("_", " ") }))} value={iso} onChange={setIso} />
      </Row>
      <Run key={an + iso} an={an} iso={iso} />
    </div>
  );
}

function Run({ an, iso }: { an: Anomaly; iso: Iso }) {
  const sc = SCEN[an];
  const bad = RANK[iso] < PREVENTED_AT[an];
  const s = useStepper(sc.ops.length + 1, { interval: 1500 });
  const last = s.i > 0 ? sc.ops[s.i - 1] : undefined;
  const done = s.atEnd;

  const verdict: ReactNode = done ? (
    <>
      <span style={{ color: bad ? "var(--dead)" : "var(--live)" }}>{bad ? `${sc.title}: happened. ` : `${sc.title}: prevented. `}</span>
      {bad ? sc.bad : sc.good}
    </>
  ) : s.i === 0 ? (
    "two transactions, T1 and T2, interleaved. press step."
  ) : (
    <>
      <span className="text-faint">T{last!.t} runs</span> <code>{last!.sql}</code>
    </>
  );

  return (
    <div {...s.keys} className="outline-none">
      <div className="mt-4 grid grid-cols-2 gap-x-3 border-b border-line pb-1.5 text-12">
        <span className="text-hi">T1</span>
        <span className="text-hi">T2</span>
      </div>
      <ol className="mt-1 grid gap-1">
        {sc.ops.map((op, i) => {
          const vis = i < s.i;
          const cur = i === s.i - 1;
          const res = op.result?.(bad);
          const isBadRead = op.result && i === sc.ops.length - (an === "dirty" ? 2 : 1) && bad;
          return (
            <li key={i} className="grid grid-cols-2 gap-x-3 transition-opacity duration-200" style={{ opacity: vis ? 1 : 0.15 }}>
              <span className={op.t === 1 ? "" : "invisible"}>
                <Op op={op} cur={cur} />
              </span>
              <span className={op.t === 2 ? "" : "invisible"}>
                <Op op={op} cur={cur} res={vis ? res : undefined} bad={!!isBadRead} />
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 rounded-md bg-well-2 px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">committed in the database: </span>
        <span className="text-ink">{last ? last.db(bad) : sc.ops[0].db(bad)}</span>
      </div>
      <p className={`mt-3 min-h-[3.4em] ${NARR}`} aria-live="polite">
        {verdict}
      </p>
      <StepControls s={s} className="mt-2" compact />
    </div>
  );
}

function Op({ op, cur, res, bad }: { op: Op; cur: boolean; res?: string; bad?: boolean }) {
  return (
    <span
      className="block rounded-md px-2 py-1.5 text-11 leading-[1.5] break-words transition-[box-shadow,background-color] duration-200 sm:text-12"
      style={{ boxShadow: cur ? ring("hot") : ring("line"), background: cur ? tint("hot", 8) : undefined }}
    >
      <span className="text-ink">{op.sql}</span>
      {res !== undefined && (
        <span className="mt-0.5 block" style={{ color: bad ? "var(--dead)" : "var(--live)" }}>
          → {res}
        </span>
      )}
    </span>
  );
}
