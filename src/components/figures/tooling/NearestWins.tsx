"use client";

import { useState } from "react";
import { Row, Term, Words } from "./kit";

// a real maven 3.10.0 project: app → json-lib 1.0 → text-utils 1.0, and
// app → http-lib 2.0 → core-lib 2.0 → text-utils 2.0. only text-utils 2.0 has whisper().
// every tree below is `mvn dependency:tree -Dverbose` output (groupIds and :compile trimmed),
// every result is what `mvn package` did.

type Fix = "none" | "direct" | "managed" | "exclude";
type Line = { pre: string; text: string; win?: boolean; lose?: string; note?: string; depth?: number };

const TREES: Record<Fix, Line[]> = {
  none: [
    { pre: "", text: "app" },
    { pre: "+- ", text: "json-lib 1.0" },
    { pre: "|  \\- ", text: "text-utils 1.0", win: true, depth: 2, note: "depth 2: nearest, so it wins" },
    { pre: "+- ", text: "http-lib 2.0" },
    { pre: "|  \\- ", text: "core-lib 2.0" },
    { pre: "|     \\- ", text: "text-utils 2.0", lose: "omitted for conflict with 1.0", depth: 3 },
  ],
  direct: [
    { pre: "", text: "app" },
    { pre: "+- ", text: "json-lib 1.0" },
    { pre: "|  \\- ", text: "text-utils 1.0", lose: "omitted for conflict with 2.0" },
    { pre: "+- ", text: "http-lib 2.0" },
    { pre: "|  \\- ", text: "core-lib 2.0" },
    { pre: "|     \\- ", text: "text-utils 2.0", lose: "omitted for duplicate" },
    { pre: "+- ", text: "text-utils 2.0", win: true, depth: 1, note: "depth 1 beats everything" },
  ],
  managed: [
    { pre: "", text: "app" },
    { pre: "+- ", text: "json-lib 1.0" },
    { pre: "|  \\- ", text: "text-utils 2.0", win: true, note: "version managed from 1.0" },
    { pre: "+- ", text: "http-lib 2.0" },
    { pre: "|  \\- ", text: "core-lib 2.0" },
    { pre: "|     \\- ", text: "text-utils 2.0", lose: "omitted for duplicate" },
  ],
  exclude: [
    { pre: "", text: "app" },
    { pre: "+- ", text: "json-lib 1.0", note: "<exclusions> text-utils" },
    { pre: "+- ", text: "http-lib 2.0" },
    { pre: "|  \\- ", text: "core-lib 2.0" },
    { pre: "|     \\- ", text: "text-utils 2.0", win: true, depth: 3, note: "the only one left" },
  ],
};

const POM: Record<Fix, string> = {
  none: "<!-- json-lib 1.0 and http-lib 2.0, nothing else -->",
  direct: "<dependency>\n  <artifactId>text-utils</artifactId>\n  <version>2.0</version>\n</dependency>",
  managed: "<dependencyManagement><dependencies>\n  <dependency>\n    <artifactId>text-utils</artifactId>\n    <version>2.0</version>\n  </dependency>\n</dependencies></dependencyManagement>",
  exclude: "<artifactId>json-lib</artifactId>\n<exclusions><exclusion>\n  <artifactId>text-utils</artifactId>\n</exclusion></exclusions>",
};

const FAIL = `$ mvn package
[INFO] Running com.acme.app.AppTest
[ERROR] com.acme.app.AppTest.runs -- Time elapsed: 0.087 s <<< ERROR!
java.lang.NoSuchMethodError: 'java.lang.String com.acme.Text.whisper(java.lang.String)'
	at com.acme.Core.quiet(Core.java:3)
	at com.acme.Http.get(Http.java:3)
	at com.acme.app.App.run(App.java:8)
[ERROR] BUILD FAILURE`;

const PASS = `$ mvn package
[INFO] Running com.acme.app.AppTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] --- jar:3.5.1:jar (default-jar) @ app ---
[INFO] BUILD SUCCESS`;

export function NearestWins() {
  const [fix, setFix] = useState<Fix>("none");
  const ok = fix !== "none";
  return (
    <div className="@container">
      <Row k="fix =" w="7ch" last>
        <Words
          label="how to fix the conflict"
          options={[
            { v: "none" as Fix, label: "none" },
            { v: "direct" as Fix, label: "declare it" },
            { v: "managed" as Fix, label: "dependencyManagement" },
            { v: "exclude" as Fix, label: "exclusion" },
          ]}
          value={fix}
          onChange={setFix}
        />
      </Row>

      <div className="mt-3 grid gap-4 @[640px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto rounded-md bg-bg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
          <div className="mb-2 text-11 text-faint">mvn dependency:tree -Dverbose</div>
          <ul className="min-w-max text-13 leading-[1.9]">
            {TREES[fix].map((l, i) => (
              <li key={fix + i} className="flex items-baseline whitespace-pre">
                <span className="text-faint select-none">{l.pre}</span>
                <span
                  className="rounded-sm px-1"
                  style={{
                    color: l.win ? "var(--live)" : l.lose ? "var(--dead)" : "var(--hi)",
                    textDecoration: l.lose ? "line-through" : undefined,
                    boxShadow: l.win ? "inset 0 0 0 1px color-mix(in srgb, var(--live) 50%, transparent)" : undefined,
                  }}
                >
                  {l.text}
                </span>
                {(l.lose || l.note) && <span className="ml-3 text-11 text-mute">{l.lose ?? l.note}</span>}
              </li>
            ))}
          </ul>
        </div>
        <pre className="min-w-0 overflow-x-auto rounded-md bg-bg px-4 py-3 text-12 leading-[1.7] whitespace-pre text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
          <span className="mb-1 block text-11 text-faint">pom.xml</span>
          {POM[fix]}
        </pre>
      </div>

      <div className="mt-4" aria-live="polite">
        <Term
          label={ok ? "tests pass" : "compiles fine, dies at runtime"}
          text={ok ? PASS : FAIL}
          marks={{ "NoSuchMethodError": "dead", "BUILD FAILURE": "dead", "BUILD SUCCESS": "live", "Errors: 0": "live" }}
          minH="10.5em"
        />
      </div>
    </div>
  );
}
