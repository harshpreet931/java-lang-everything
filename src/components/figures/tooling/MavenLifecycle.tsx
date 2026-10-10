"use client";

import { useState } from "react";
import { Row, Term, Words } from "./kit";

// maven 3.10.0's default lifecycle for <packaging>jar</packaging>, as printed by
// `mvn help:describe -Dcmd=install`, and the log lines from a real `mvn install` (jdk 25).

type Phase = { name: string; goal?: string; log?: string; main?: boolean; what?: string };

const PHASES: Phase[] = [
  { name: "validate", main: true, what: "is the pom sane? (nothing bound by default, enforcer rules usually live here)" },
  { name: "initialize" },
  { name: "generate-sources", what: "code generators (annotation-free ones: protobuf, openapi) bind here" },
  { name: "process-sources" },
  { name: "generate-resources" },
  { name: "process-resources", goal: "resources:resources", log: "resources:3.5.0:resources (default-resources)", what: "copies src/main/resources into target/classes" },
  { name: "compile", goal: "compiler:compile", log: "compiler:3.16.0:compile (default-compile)", main: true, what: "javac on src/main/java → target/classes" },
  { name: "process-classes" },
  { name: "generate-test-sources" },
  { name: "process-test-sources" },
  { name: "generate-test-resources" },
  { name: "process-test-resources", goal: "resources:testResources", log: "resources:3.5.0:testResources (default-testResources)" },
  { name: "test-compile", goal: "compiler:testCompile", log: "compiler:3.16.0:testCompile (default-testCompile)", what: "javac on src/test/java → target/test-classes" },
  { name: "process-test-classes" },
  { name: "test", goal: "surefire:test", log: "surefire:3.6.0:test (default-test)", main: true, what: "runs unit tests. a failing test stops the build here" },
  { name: "prepare-package" },
  { name: "package", goal: "jar:jar", log: "jar:3.5.1:jar (default-jar)", main: true, what: "zips target/classes into target/app-1.0-SNAPSHOT.jar" },
  { name: "pre-integration-test" },
  { name: "integration-test", what: "failsafe runs *IT tests here, if you add it" },
  { name: "post-integration-test" },
  { name: "verify", main: true, what: "checks on the packaged result (failsafe:verify, coverage gates)" },
  { name: "install", goal: "install:install", log: "install:3.2.0:install (default-install)", main: true, what: "copies the jar into ~/.m2/repository for your other projects" },
  { name: "deploy", goal: "deploy:deploy", log: "deploy:3.2.0:deploy (default-deploy)", main: true, what: "uploads to a remote repository (nexus, artifactory, central)" },
];

export function MavenLifecycle() {
  const [all, setAll] = useState(false);
  const [target, setTarget] = useState("package");
  const ti = PHASES.findIndex((p) => p.name === target);
  const shown = PHASES.map((p, i) => ({ ...p, i })).filter((p) => all || p.main || p.goal);
  const ran = PHASES.slice(0, ti + 1).filter((p) => p.log);
  const log = [`$ mvn ${target}`, ...ran.map((p) => `[INFO] --- ${p.log} @ app ---`), ti >= 14 ? "[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0" : "", "[INFO] BUILD SUCCESS"]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="@container">
      <Row k="show =" w="8ch" last>
        <Words
          label="how many phases to show"
          options={[
            { v: "some" as const, label: "phases with something bound" },
            { v: "all" as const, label: "all 23" },
          ]}
          value={all ? "all" : "some"}
          onChange={(v) => setAll(v === "all")}
        />
      </Row>

      <div className="mt-3 grid gap-5 @[680px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ol className="grid content-start gap-px" aria-label="the default lifecycle. click a phase to run mvn with it">
          {shown.map((p) => {
            const on = p.i <= ti;
            const isT = p.i === ti;
            return (
              <li key={p.name}>
                <button
                  onClick={() => setTarget(p.name)}
                  aria-pressed={isT}
                  className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded-sm px-2 py-1 text-left transition-[background-color,color] duration-150 ease-jle hover:bg-well-2"
                  style={{ background: isT ? "var(--well-2)" : undefined, boxShadow: isT ? "inset 0 0 0 1px var(--hot)" : undefined }}
                >
                  <span className="text-11 tabular" style={{ color: isT ? "var(--hot)" : on ? "var(--ink)" : "var(--line-2)" }}>
                    {on ? "●" : "○"}
                  </span>
                  <span className="truncate text-13" style={{ color: isT ? "var(--hot)" : on ? "var(--hi)" : "var(--faint)", fontWeight: p.main ? 500 : 400 }}>
                    {p.name}
                  </span>
                  <span className="truncate text-11" style={{ color: p.goal ? (on ? "var(--ink)" : "var(--faint)") : "var(--line-2)" }}>
                    {p.goal ?? "·"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="min-w-0">
          <p className="mb-3 min-h-[3.2em] font-serif text-17 leading-[1.55] text-ink" aria-live="polite">
            <span className="font-mono text-13 text-hot">{target}</span>
            {PHASES[ti].what ? `: ${PHASES[ti].what}.` : ": nothing bound by default. it's a hook for plugins you add."} maven runs {ti + 1} phase{ti ? "s" : ""} to get there.
          </p>
          <Term label="what maven prints" text={log} marks={{ "BUILD SUCCESS": "live" }} />
        </div>
      </div>
    </div>
  );
}
