"use client";

import { useState } from "react";
import { Row } from "./kit";

// the algorithm from java.lang.module.ModuleFinder.of(): how a plain jar's file name becomes
// a module name. every preset below was checked with `jar --describe-module --file x.jar`
// on jdk 25 and gave exactly the result this code computes.

const PRESETS = [
  "commons-lang3-3.17.0.jar",
  "my_cool-lib-2.0.jar",
  "foo-bar.baz-1.0-SNAPSHOT.jar",
  "json-20240303.jar",
  "x--y..z-9.jar",
  "java-native-1.0.jar",
  "1password-sdk-1.0.jar",
];

const KEYWORDS = new Set(
  (
    "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for " +
    "goto if implements import instanceof int interface long native new package private protected public return short static strictfp super " +
    "switch synchronized this throw throws transient try void volatile while true false null _"
  ).split(" "),
);

type Step = { label: string; value: string; note?: string; tone?: "hot" | "dead" | "live" };

function derive(file: string, manifest: string): { steps: Step[]; ok: boolean; name?: string; version?: string } {
  const steps: Step[] = [];
  if (manifest.trim()) {
    const base = file.endsWith(".jar") ? file.slice(0, -4) : file;
    const vm = /-(\d+(\.|$))/.exec(base);
    steps.push({
      label: "manifest",
      value: `Automatic-Module-Name: ${manifest.trim()}`,
      note: "set by the library author. it wins: the file name only supplies the version now.",
      tone: "hot",
    });
    return { steps, ok: true, name: manifest.trim(), version: vm ? base.slice(vm.index + 1) : undefined };
  }
  let name = file.endsWith(".jar") ? file.slice(0, -4) : file;
  steps.push({ label: "drop .jar", value: name });
  let version: string | undefined;
  const m = /-(\d+(\.|$))/.exec(name);
  if (m) {
    version = name.slice(m.index + 1);
    name = name.slice(0, m.index);
    steps.push({ label: "cut the version", value: name, note: `the first "-" followed by a digit starts the version: ${version}` });
  } else {
    steps.push({ label: "cut the version", value: name, note: "no -<digit> anywhere, so no version." });
  }
  const dotted = name.replace(/[^A-Za-z0-9]/g, ".");
  steps.push({ label: "non-alphanumerics → .", value: dotted });
  const clean = dotted.replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
  steps.push({ label: "squash dots", value: clean, note: clean !== dotted ? "repeated dots become one, leading and trailing ones go." : undefined });
  const bad = clean.split(".").find((p) => p === "" || /^\d/.test(p) || KEYWORDS.has(p));
  if (!clean || bad !== undefined) {
    steps.push({
      label: "check",
      value: `Invalid module name: '${bad ?? ""}' is not a Java identifier`,
      note: "every dot-separated part must be a legal identifier. no leading digits, no keywords.",
      tone: "dead",
    });
    return { steps, ok: false };
  }
  return { steps, ok: true, name: clean, version };
}

export function AutoModuleName() {
  const [file, setFile] = useState(PRESETS[0]);
  const [manifest, setManifest] = useState("");
  const r = derive(file, manifest);

  return (
    <div className="@container">
      <Row k="jar =" w="11ch">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p} className="word !text-12" aria-pressed={file === p && !manifest} onClick={() => (setFile(p), setManifest(""))}>
              {p}
            </button>
          ))}
        </div>
      </Row>
      <Row k="or type =" w="11ch">
        <input
          value={file}
          onChange={(e) => (setFile(e.target.value), setManifest(""))}
          spellCheck={false}
          aria-label="jar file name"
          className="w-full min-w-0 rounded-sm bg-bg px-2.5 py-1.5 text-13 text-hi shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus:shadow-[inset_0_0_0_1px_var(--mute)]"
        />
      </Row>
      <Row k="manifest =" w="11ch" last>
        <div className="flex flex-wrap items-center gap-1">
          <button className="word !text-12" aria-pressed={!manifest} onClick={() => setManifest("")}>
            no entry
          </button>
          <button className="word !text-12" aria-pressed={!!manifest} onClick={() => setManifest("com.acme.util")}>
            Automatic-Module-Name: com.acme.util
          </button>
        </div>
      </Row>

      <ol className="mt-4 grid gap-1.5" aria-live="polite">
        {r.steps.map((s, i) => (
          <li key={i} className="grid gap-x-4 gap-y-0.5 border-l-2 py-1 pl-3 text-13 @[540px]:grid-cols-[22ch_minmax(0,1fr)]" style={{ borderColor: s.tone ? `var(--${s.tone})` : "var(--line-2)" }}>
            <span className="text-faint">
              {i + 1}. {s.label}
            </span>
            <span className="min-w-0">
              <span className="break-all" style={{ color: s.tone ? `var(--${s.tone})` : "var(--hi)" }}>
                {s.value || "(empty)"}
              </span>
              {s.note && <span className="block text-12 text-mute">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-line pt-3 text-13">
        <span className="text-faint">$ jar --describe-module --file {file}</span>
        <div className="mt-1 break-all" style={{ color: r.ok ? "var(--live)" : "var(--dead)" }}>
          {r.ok ? `${r.name}${r.version ? `@${r.version}` : ""} automatic` : `Unable to derive module descriptor for: ${file}`}
        </div>
      </div>
    </div>
  );
}
