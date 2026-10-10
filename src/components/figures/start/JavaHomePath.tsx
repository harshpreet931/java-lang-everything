"use client";

import { useEffect, useState } from "react";
import { Row, Words, useReducedMotion } from "@/components/figures/basics/kit";

// how `java` on the command line gets resolved (PATH, first match wins),
// vs how build tools and IDEs find a JDK (JAVA_HOME). the classic mismatch.

type Order = "home-first" | "old-first";
type Home = "set" | "unset";

const OLD = "/usr/lib/jvm/java-17-openjdk/bin";
const NEW = "/usr/lib/jvm/temurin-25-jdk/bin";

export function JavaHomePath() {
  const [order, setOrder] = useState<Order>("old-first");
  const [home, setHome] = useState<Home>("set");
  const reduce = useReducedMotion();

  const dirs = [
    { dir: "/usr/local/bin", java: null as null | 17 | 25, tag: "" },
    ...(order === "old-first"
      ? [
          { dir: OLD, java: 17 as const, tag: "installed years ago" },
          { dir: NEW, java: 25 as const, tag: home === "set" ? "$JAVA_HOME/bin" : "temurin 25" },
        ]
      : [
          { dir: NEW, java: 25 as const, tag: home === "set" ? "$JAVA_HOME/bin" : "temurin 25" },
          { dir: OLD, java: 17 as const, tag: "installed years ago" },
        ]),
    { dir: "/usr/bin", java: null, tag: "" },
  ];
  const found = dirs.findIndex((d) => d.java !== null);
  const runs = dirs[found].java!;

  // the shell checks each directory in order. animate that walk.
  const [scan, setScan] = useState(found);
  useEffect(() => {
    if (reduce) {
      setScan(found);
      return;
    }
    setScan(-1);
    let i = -1;
    const t = setInterval(() => {
      i++;
      setScan(i);
      if (i >= found) clearInterval(t);
    }, 260);
    return () => clearInterval(t);
  }, [order, found, reduce]);
  const done = scan >= found;

  const toolJdk = home === "set" ? 25 : null;
  const match = toolJdk === runs;

  return (
    <div className="font-mono text-13">
      <Row k="PATH =" w="12ch">
        <Words
          options={[
            { v: "old-first", label: "17 first" },
            { v: "home-first", label: "25 first" },
          ]}
          value={order}
          onChange={setOrder}
          label="PATH order"
        />
      </Row>
      <Row k="JAVA_HOME =" w="12ch">
        <Words
          options={[
            { v: "set", label: "temurin-25" },
            { v: "unset", label: "not set" },
          ]}
          value={home}
          onChange={setHome}
          label="JAVA_HOME"
        />
      </Row>

      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* the terminal side */}
        <div className="min-w-0">
          <div className="mb-2 text-11 text-faint">
            you type <span className="text-hi">java -version</span>. the shell tries each PATH entry, in order:
          </div>
          <ol className="grid gap-1.5">
            {dirs.map((d, i) => {
              const looked = scan >= i;
              const hit = done && i === found;
              const skipped = looked && !hit && i < found;
              const never = done && i > found;
              return (
                <li
                  key={d.dir}
                  className="grid grid-cols-[2ch_minmax(0,1fr)] items-baseline gap-2 rounded-md px-2.5 py-1.5 text-12 transition-[box-shadow,opacity] duration-200"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${hit || scan === i ? "var(--hot)" : "var(--line)"}`,
                    opacity: never ? 0.4 : 1,
                  }}
                >
                  <span className="text-faint tabular">{i + 1}</span>
                  <span className="min-w-0">
                    <span className={`block truncate ${hit ? "text-hi" : "text-ink"}`}>{d.dir}</span>
                    <span className="flex flex-wrap gap-x-3 text-11">
                      {d.tag && <span className="text-faint">{d.tag}</span>}
                      {hit ? (
                        <span className="text-hot">found java {d.java}, runs this one</span>
                      ) : skipped ? (
                        <span className="text-faint">no java here</span>
                      ) : never ? (
                        <span className="text-faint">{d.java ? `java ${d.java}, never reached` : "never checked"}</span>
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* what each thing ends up using */}
        <div className="grid content-start gap-3" aria-live="polite">
          <Result
            who="your terminal"
            how="first java on PATH"
            v={done ? runs : null}
            ok={done ? match : undefined}
          />
          <Result
            who="maven, gradle, your IDE"
            how="read $JAVA_HOME"
            v={toolJdk}
            ok={done ? match : undefined}
            unset={home === "unset"}
          />
          <p className="font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-mute">
            {!done
              ? "searching…"
              : match
                ? "both agree. this is the setup you want."
                : home === "unset"
                  ? "no JAVA_HOME, so every tool goes looking on its own. some find 17, some find 25, some give up."
                  : "they disagree. the terminal compiles with 17, the build uses 25. errors like \"release version 25 not supported\" come from exactly this."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Result({ who, how, v, ok, unset }: { who: string; how: string; v: number | null; ok?: boolean; unset?: boolean }) {
  const tone = ok === undefined ? "var(--line-2)" : ok ? "var(--live)" : "var(--dead)";
  return (
    <div className="rounded-md bg-well px-3.5 py-2.5 transition-[box-shadow] duration-200" style={{ boxShadow: `inset 0 0 0 1px ${tone}` }}>
      <div className="flex items-baseline justify-between gap-3 text-12">
        <span className="text-ink">{who}</span>
        <span className="text-11 text-faint">{how}</span>
      </div>
      <div className="mt-1 text-15 tabular" style={{ color: ok === undefined ? "var(--faint)" : ok ? "var(--live)" : "var(--dead)" }}>
        {unset ? "?" : v === null ? "…" : `java ${v}`}
      </div>
    </div>
  );
}
