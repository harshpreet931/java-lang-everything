"use client";

import { useState, type ReactNode } from "react";
import { Java, Narrate, Row, Words, ring, tint } from "../functional/kit";

// five ways a preview feature meets javac and java. every message is the real
// output of temurin 25.0.4 (and, for the 21 case, a class compiled by temurin 21.0.12).

type Sc = "noflag" | "runbare" | "both" | "old" | "unused";
type Stage = { cmd: string; out: string[]; ok: boolean } | null;
type Scenario = { label: string; src: string; javac: Stage; header: { major: number; minor: number; from?: string } | null; java: Stage; note: ReactNode };

const SRC = `int n = 300;
if (n instanceof byte b) ...   // primitive pattern: preview in 25`;

const S: Record<Sc, Scenario> = {
  noflag: {
    label: "no flag on javac",
    src: SRC,
    javac: {
      cmd: "javac Main.java",
      ok: false,
      out: [
        "Main.java:9: error: primitive patterns are a preview feature and are disabled by default.",
        "  (use --enable-preview to enable primitive patterns)",
      ],
    },
    header: null,
    java: null,
    note: "preview features are off by default, in the compiler too. you can't use one by accident.",
  },
  runbare: {
    label: "flag on javac, not on java",
    src: SRC,
    javac: {
      cmd: "javac --release 25 --enable-preview Main.java",
      ok: true,
      out: ["Note: Main.java uses preview features of Java SE 25.", "Note: Recompile with -Xlint:preview for details."],
    },
    header: { major: 69, minor: 0xffff },
    java: {
      cmd: "java Main",
      ok: false,
      out: [
        "java.lang.UnsupportedClassVersionError: Preview features are not enabled",
        "  for Main (class file version 69.65535). Try running with '--enable-preview'",
      ],
    },
    note: "javac stamped the class file with minor version 0xFFFF, which means 'depends on preview features'. the JVM checks that stamp before running a single line.",
  },
  both: {
    label: "flag on both",
    src: SRC,
    javac: {
      cmd: "javac --release 25 --enable-preview Main.java",
      ok: true,
      out: ["Note: Main.java uses preview features of Java SE 25."],
    },
    header: { major: 69, minor: 0xffff },
    java: { cmd: "java --enable-preview Main", ok: true, out: ["300 doesn't fit in a byte"] },
    note: "that's the deal: opt in when you compile and again when you run. (the source launcher takes both at once: java --enable-preview --source 25 Main.java.)",
  },
  old: {
    label: "a 21 preview class on java 25",
    src: `System.out.println(STR."hi \\{name}");   // string templates: preview in 21`,
    javac: { cmd: "javac --release 21 --enable-preview Tpl.java   (jdk 21)", ok: true, out: ["Note: Tpl.java uses preview features of Java SE 21."] },
    header: { major: 65, minor: 0xffff, from: "jdk 21" },
    java: {
      cmd: "java --enable-preview Tpl   (jdk 25)",
      ok: false,
      out: [
        "java.lang.UnsupportedClassVersionError: Tpl (class file version 65.65535) was compiled",
        "  with preview features that are unsupported. This version of the Java Runtime only",
        "  recognizes preview features for class file version 69.65535",
      ],
    },
    note: "a preview class file only runs on the exact release that compiled it. string templates no longer even exist in 25, but the JVM refuses before it could find that out.",
  },
  unused: {
    label: "flag on, no preview used",
    src: `System.out.println("plain");   // nothing preview in here`,
    javac: { cmd: "javac --release 25 --enable-preview Plain.java", ok: true, out: ["(no output)"] },
    header: { major: 69, minor: 0 },
    java: { cmd: "java Plain", ok: true, out: ["plain"] },
    note: "the stamp is per class, and only when the class really uses a preview feature. turning the flag on for a whole build doesn't taint the classes that don't.",
  },
};

const hex = (n: number) => n.toString(16).padStart(4, "0").replace(/(..)(..)/, "$1 $2");

export function PreviewFlow() {
  const [sc, setSc] = useState<Sc>("runbare");
  const s = S[sc];
  return (
    <div className="grid gap-5">
      <Row k="try =" w="6ch" last>
        <Words options={(Object.keys(S) as Sc[]).map((v) => ({ v, label: S[v].label }))} value={sc} onChange={setSc} label="scenario" />
      </Row>

      <div className="grid gap-2">
        <Box label="source" tone={null}>
          <span className="whitespace-pre">
            <Java code={s.src} />
          </span>
        </Box>
        <Arrow />
        <Box label="javac" tone={s.javac ? (s.javac.ok ? "live" : "dead") : null}>
          {s.javac && <Cmd {...s.javac} />}
        </Box>
        <Arrow dim={!s.header} />
        <Box label="class file" tone={null} dim={!s.header}>
          {s.header ? (
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular">
                <span className="text-faint">ca fe ba be </span>
                <span style={{ color: s.header.minor ? "var(--hot)" : "var(--ink)" }}>{hex(s.header.minor)}</span>
                <span className="text-ink"> {hex(s.header.major)}</span>
                <span className="text-faint"> …</span>
              </span>
              <span className="text-12 text-mute">
                version {s.header.major}.{s.header.minor}
                {s.header.minor ? <span className="text-hot"> (preview)</span> : null}
                {s.header.from ? ` · from ${s.header.from}` : ""}
              </span>
            </span>
          ) : (
            <span className="text-faint">never written</span>
          )}
        </Box>
        <Arrow dim={!s.java} />
        <Box label="java" tone={s.java ? (s.java.ok ? "live" : "dead") : null} dim={!s.java}>
          {s.java ? <Cmd {...s.java} /> : <span className="text-faint">nothing to run</span>}
        </Box>
      </div>
      <Narrate>{s.note}</Narrate>
    </div>
  );
}

function Box({ label, tone, children, dim }: { label: string; tone: "live" | "dead" | null; children: ReactNode; dim?: boolean }) {
  return (
    <div
      className="grid gap-x-4 gap-y-1 rounded-md px-3.5 py-2.5 text-12 transition-[box-shadow,opacity] duration-200 sm:grid-cols-[9ch_minmax(0,1fr)]"
      style={{ boxShadow: ring(tone, tone ? 60 : 100), background: tone ? tint(tone, 6) : "var(--bg)", opacity: dim ? 0.45 : 1 }}
    >
      <span className={tone === "dead" ? "text-dead" : tone === "live" ? "text-live" : "text-faint"}>{label}</span>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}

function Cmd({ cmd, out, ok }: { cmd: string; out: string[]; ok: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="whitespace-pre text-hi">$ {cmd}</span>
      <pre className="text-11 leading-[1.6] whitespace-pre" style={{ color: ok ? "var(--mute)" : "var(--dead)" }}>
        {out.join("\n")}
      </pre>
    </div>
  );
}

function Arrow({ dim }: { dim?: boolean }) {
  return (
    <span className="pl-4 text-12 leading-none text-faint" style={{ opacity: dim ? 0.4 : 1 }} aria-hidden>
      ↓
    </span>
  );
}
