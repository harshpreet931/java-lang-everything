"use client";

import { useState } from "react";
import { Row, Words } from "@/components/figures/basics/kit";

// "which JDK should i install", as three questions.
// commands checked oct 2026: brew casks temurin@25 / corretto@25 / zulu@25, winget ids
// EclipseAdoptium.Temurin.25.JDK / Amazon.Corretto.25.JDK / Azul.Zulu.25.JDK / Microsoft.OpenJDK.25,
// adoptium's apt repo (temurin-25-jdk), and sdkman (`sdk install java` with no version = 25.0.4-tem).

type Goal = "learn" | "work" | "aws" | "azure" | "native" | "oracle";
type Os = "mac" | "linux" | "windows";
type Via = "sdkman" | "pm";

type Pick = {
  name: string;
  vendor: string;
  why: string;
  sdk: string;
  pm: Record<Os, string[]>;
};

const TEMURIN: Pick = {
  name: "eclipse temurin 25",
  vendor: "eclipse adoptium",
  why: "free, tested against the java spec, builds for everything, no strings attached. the boring default, which is what you want from a JDK.",
  sdk: "sdk install java          # no version = sdkman's default, temurin 25",
  pm: {
    mac: ["brew install --cask temurin@25"],
    linux: ["# add adoptium's apt repo first: adoptium.net/installation/linux", "sudo apt install temurin-25-jdk"],
    windows: ["winget install EclipseAdoptium.Temurin.25.JDK"],
  },
};

const PICKS: Record<Goal, Pick> = {
  learn: TEMURIN,
  work: {
    ...TEMURIN,
    why: "if your team already standardised on a vendor, use theirs (they're all the same code). otherwise temurin: free, tested, everywhere.",
  },
  aws: {
    name: "amazon corretto 25",
    vendor: "amazon",
    why: "amazon's free build. it's what AWS runs internally and ships in its images, and amazon patches it for years.",
    sdk: "sdk list java | grep amzn   # then: sdk install java <the 25.x id>",
    pm: {
      mac: ["brew install --cask corretto@25"],
      linux: ["# add amazon's apt or yum repo first: docs.aws.amazon.com/corretto", "sudo apt install java-25-amazon-corretto-jdk"],
      windows: ["winget install Amazon.Corretto.25.JDK"],
    },
  },
  azure: {
    name: "microsoft build of openjdk 25",
    vendor: "microsoft",
    why: "microsoft's free build, the one azure's java services run on. same OpenJDK code, supported by the people running your cloud.",
    sdk: "sdk list java | grep -- -ms   # then: sdk install java <the 25.x id>",
    pm: {
      mac: ["brew install --cask microsoft-openjdk@25"],
      linux: ["# add microsoft's package repo first: learn.microsoft.com/java/openjdk", "sudo apt install msopenjdk-25"],
      windows: ["winget install Microsoft.OpenJDK.25"],
    },
  },
  native: {
    name: "graalvm 25 (community)",
    vendor: "oracle / graalvm",
    why: "a full JDK plus native-image, which compiles your app into one standalone executable that starts in milliseconds. learn on a normal JDK first, though.",
    sdk: "sdk list java | grep graalce   # then: sdk install java <the 25.x id>",
    pm: {
      mac: ["# download from github.com/graalvm/graalvm-ce-builds, or use sdkman"],
      linux: ["# download from github.com/graalvm/graalvm-ce-builds, or use sdkman"],
      windows: ["# download from github.com/graalvm/graalvm-ce-builds"],
    },
  },
  oracle: {
    name: "oracle JDK 25",
    vendor: "oracle",
    why: "free under oracle's no-fee terms until a year after the next LTS ships. after that, updates need a paid subscription. fine for learning, read the license before production.",
    sdk: "sdk list java | grep oracle   # then: sdk install java <the 25.x id>",
    pm: {
      mac: ["# installer: oracle.com/java/technologies/downloads"],
      linux: ["# .deb / .rpm: oracle.com/java/technologies/downloads"],
      windows: ["# installer: oracle.com/java/technologies/downloads"],
    },
  },
};

const GOALS = [
  { v: "learn", label: "learn java" },
  { v: "work", label: "a job" },
  { v: "aws", label: "aws" },
  { v: "azure", label: "azure" },
  { v: "native", label: "native binaries" },
  { v: "oracle", label: "oracle support" },
] as const;

export function JdkPicker() {
  const [goal, setGoal] = useState<Goal>("learn");
  const [os, setOs] = useState<Os>("mac");
  const [via, setVia] = useState<Via>("sdkman");
  const p = PICKS[goal];
  const sdkOnWindows = via === "sdkman" && os === "windows";
  const lines = via === "sdkman" ? [...(sdkOnWindows ? ["# sdkman needs WSL or git bash on windows"] : []), p.sdk] : p.pm[os];

  return (
    <div className="font-mono text-13">
      <Row k="for =" w="12ch">
        <Words options={GOALS} value={goal} onChange={setGoal} label="what it's for" />
      </Row>
      <Row k="os =" w="12ch">
        <Words
          options={[
            { v: "mac", label: "mac" },
            { v: "linux", label: "linux" },
            { v: "windows", label: "windows" },
          ]}
          value={os}
          onChange={setOs}
          label="operating system"
        />
      </Row>
      <Row k="install =" w="12ch">
        <Words
          options={[
            { v: "sdkman", label: "sdkman" },
            { v: "pm", label: os === "mac" ? "homebrew" : os === "windows" ? "winget" : "apt" },
          ]}
          value={via}
          onChange={setVia}
          label="install with"
        />
      </Row>

      <div className="mt-5 grid gap-4" aria-live="polite">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-16 text-hi">{p.name}</span>
            <span className="text-12 text-faint">by {p.vendor}</span>
          </div>
          <p className="mt-1.5 max-w-[62ch] font-serif text-16 leading-[1.6] [&_code]:font-mono [&_code]:text-13 [&_code]:text-hi text-ink">{p.why}</p>
        </div>
        <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]">
          {lines.map((l, i) => (
            <div key={i} className={l.startsWith("#") ? "text-faint" : "text-hi"}>
              {l.startsWith("#") ? l : (
                <>
                  <span className="text-faint select-none">$ </span>
                  <Cmd text={l} />
                </>
              )}
            </div>
          ))}
          <div className="text-hi">
            <span className="text-faint select-none">$ </span>java -version
          </div>
        </pre>
      </div>
    </div>
  );
}

function Cmd({ text }: { text: string }) {
  const i = text.indexOf("#");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-faint">{text.slice(i)}</span>
    </>
  );
}
