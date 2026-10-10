"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// how ServiceLoader finds providers, on the class path and on the module path. every output
// below is real: the chapter's shop.api / greeter jars and modules, run on jdk 25. French's
// constructor prints a line, so you can see providers are created lazily, in path order.

type Mode = "classpath" | "modules";

function Jar({ name, sub, file, on, onToggle, tone }: { name: string; sub: string; file?: string; on: boolean; onToggle?: () => void; tone?: "ref" | "meta" }) {
  return (
    <button
      onClick={onToggle}
      disabled={!onToggle}
      aria-pressed={onToggle ? on : undefined}
      className="min-w-0 rounded-md bg-well px-2.5 py-2 text-left transition-[box-shadow,opacity] duration-200 ease-jle disabled:cursor-default"
      style={{
        boxShadow: `inset 0 0 0 1px ${on ? (tone ? `var(--${tone})` : "var(--line-2)") : "var(--line)"}`,
        opacity: on ? 1 : 0.4,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-12 text-hi">{name}</span>
        {onToggle && <span className="text-11 text-faint">{on ? "on path" : "removed"}</span>}
      </div>
      <div className="text-11 text-faint">{sub}</div>
      {file && (
        <div className="mt-1.5 text-11 leading-[1.5] break-words whitespace-pre-wrap" style={{ color: tone === "ref" ? "var(--ref)" : "var(--mute)" }}>
          {file}
        </div>
      )}
    </button>
  );
}

export function ServiceDiscovery() {
  const [mode, setMode] = useState<Mode>("classpath");
  const [en, setEn] = useState(true);
  const [fr, setFr] = useState(true);
  const [frFirst, setFrFirst] = useState(false);
  const [uses, setUses] = useState(true);

  let out: { text: string; tone?: "dead" | "faint" }[] = [];
  if (mode === "classpath") {
    const order = frFirst ? ["fr", "en"] : ["en", "fr"];
    for (const o of order) {
      if (o === "en" && en) out.push({ text: "en: hello, ada" });
      if (o === "fr" && fr) out.push({ text: "  (French constructed)", tone: "faint" }, { text: "fr: bonjour, ada" });
    }
  } else if (!uses) {
    out = [{ text: "Exception in thread \"main\" java.util.ServiceConfigurationError: com.shop.spi.Greeter: module shop.app does not declare `uses`", tone: "dead" }];
  } else {
    if (en) out.push({ text: "en: hello, ada   (shop.en)" });
    if (fr) out.push({ text: "fr: bonjour, ada   (shop.fr)" });
  }

  const providerJars =
    mode === "classpath"
      ? [
          { k: "en", name: "greeter-en.jar", file: "META-INF/services/com.shop.spi.Greeter\n  com.shop.en.English", on: en, set: () => setEn(!en) },
          { k: "fr", name: "greeter-fr.jar", file: "META-INF/services/com.shop.spi.Greeter\n  com.shop.fr.French", on: fr, set: () => setFr(!fr) },
        ]
      : [
          { k: "en", name: "shop.en", file: "provides com.shop.spi.Greeter\n  with com.shop.en.English;", on: en, set: () => setEn(!en) },
          { k: "fr", name: "shop.fr", file: "provides com.shop.spi.Greeter\n  with com.shop.fr.French;   // via provider()", on: fr, set: () => setFr(!fr) },
        ];
  const ordered = mode === "classpath" && frFirst ? [...providerJars].reverse() : providerJars;

  const note =
    mode === "classpath"
      ? !en && !fr
        ? "no provider jars, no providers. the loop just doesn't run: ServiceLoader never throws for 'nothing found'. check for that yourself."
        : "ServiceLoader asks the class loader for every META-INF/services/com.shop.spi.Greeter file on the class path and reads the class names inside, in class path order. click a jar to remove it, or swap the order and watch which provider comes first (and when French gets constructed)."
      : !uses
        ? "on the module path the rules are declared, not discovered: a module that calls ServiceLoader.load has to declare uses for that service, or the call fails."
        : "here the JVM resolves providers from module descriptors when it builds the module graph, before main runs. a provider's package doesn't need to be exported at all. the order across modules isn't specified: jdk 25 gave en then fr no matter how i ordered the module path.";

  return (
    <div className="@container">
      <Row k="run on =" w="10ch">
        <Words options={[{ v: "classpath", label: "the class path" }, { v: "modules", label: "the module path" }]} value={mode} onChange={setMode} label="where" />
      </Row>
      <Row k="options =" w="10ch">
        {mode === "classpath" ? (
          <button className="word" aria-pressed={frFirst} onClick={() => setFrFirst(!frFirst)}>
            fr jar first
          </button>
        ) : (
          <button className="word" aria-pressed={uses} onClick={() => setUses(!uses)}>
            shop.app declares uses
          </button>
        )}
      </Row>

      <div className="mt-4 grid grid-cols-1 gap-2 @[560px]:grid-cols-2">
        <Jar
          name={mode === "classpath" ? "app.jar" : "shop.app"}
          sub="calls ServiceLoader.load(Greeter.class)"
          file={mode === "modules" ? (uses ? "requires shop.api;\nuses com.shop.spi.Greeter;" : "requires shop.api;") : undefined}
          on
          tone="meta"
        />
        <Jar name={mode === "classpath" ? "shop-api.jar" : "shop.api"} sub="interface Greeter (the service)" file={mode === "modules" ? "exports com.shop.spi;" : undefined} on />
        {ordered.map((j) => (
          <Jar key={j.k} name={j.name} sub="a provider" file={j.file} on={j.on} onToggle={j.set} tone="ref" />
        ))}
      </div>

      <pre className="mt-4 min-h-[5.2em] overflow-x-auto rounded-md bg-well px-3 py-2.5 text-12 leading-[1.7] whitespace-pre-wrap text-ink shadow-[inset_0_0_0_1px_var(--line)]">
        <span className="text-faint">$ java {mode === "classpath" ? "-cp …" : "-p … -m shop.app/com.shop.app.Main"}{"\n"}</span>
        {out.length === 0 ? (
          <span className="text-faint">(prints nothing)</span>
        ) : (
          out.map((l, i) => (
            <span key={i} style={{ color: l.tone === "dead" ? "var(--dead)" : l.tone === "faint" ? "var(--faint)" : undefined }}>
              {l.text}
              {"\n"}
            </span>
          ))
        )}
      </pre>
      <p className="mt-3 min-h-[5.2em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
