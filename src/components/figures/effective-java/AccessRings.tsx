"use client";

import { useState, type ReactNode } from "react";
import { Narration, Words } from "./kit";

// item 15. who can see a member, for each access level. nested boxes: the class sits in
// a package, which sits in a module, which sits in the world. protected adds subclasses
// in other packages (and other modules, if the package is exported). since java 9 (and
// strictly since 17), a public class in a package the module doesn't export is invisible
// outside the module. live = can see it.

type Mod = "private" | "package" | "protected" | "public-internal" | "public";
type Region = "class" | "package" | "module" | "subInModule" | "world" | "subInWorld";

const SEES: Record<Mod, Region[]> = {
  private: ["class"],
  package: ["class", "package"],
  protected: ["class", "package", "subInModule", "subInWorld"],
  "public-internal": ["class", "package", "module", "subInModule"],
  public: ["class", "package", "module", "subInModule", "world", "subInWorld"],
};

const NOTE: Record<Mod, string> = {
  private: "only code inside the class (and its nested classes). change it whenever you want, nobody else can notice.",
  package: "no modifier: everything in the same package. still an implementation detail, still free to change.",
  protected: "the package, plus subclasses anywhere. it's part of your exported API forever, just like public.",
  "public-internal": "public, but the module doesn't export the package. visible across your module, invisible to everyone else. this is how the JDK hides sun.* since 17.",
  public: "public in an exported package: anyone, anywhere. every public member is a promise you have to keep.",
};

function Box({
  label,
  on,
  children,
  className = "",
  stack,
}: {
  label: ReactNode;
  on: boolean;
  children?: ReactNode;
  className?: string;
  /** narrow boxes: status under the label instead of beside it */
  stack?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-2.5 pt-1.5 transition-[background-color,box-shadow] duration-200 ease-jle sm:p-3 sm:pt-2 ${className}`}
      style={{
        background: on ? "color-mix(in srgb, var(--live) 9%, var(--bg))" : "var(--bg)",
        boxShadow: `inset 0 0 0 1px ${on ? "color-mix(in srgb, var(--live) 70%, transparent)" : "var(--line-2)"}`,
      }}
    >
      <div className={`mb-1.5 flex gap-x-2 text-11 ${stack ? "flex-col" : "items-center justify-between"}`}>
        <span className={on ? "text-live" : "text-faint"}>{label}</span>
        <span className={on ? "text-live" : "text-faint"} aria-hidden>
          {on ? "sees it" : ""}
        </span>
      </div>
      {children}
    </div>
  );
}

export function AccessRings() {
  const [mod, setMod] = useState<Mod>("protected");
  const has = (r: Region) => SEES[mod].includes(r);

  return (
    <div className="@container grid gap-4">
      <div className="grid gap-2 border-b border-line pb-3 @[600px]:grid-cols-[10ch_minmax(0,1fr)] @[600px]:items-center">
        <span className="text-12 text-faint">member =</span>
        <Words
          label="access level"
          value={mod}
          onChange={setMod}
          options={[
            { v: "private", label: "private" },
            { v: "package", label: "(none)" },
            { v: "protected", label: "protected" },
            { v: "public-internal", label: "public, not exported" },
            { v: "public", label: "public, exported" },
          ]}
        />
      </div>

      <Box label="other modules" on={has("world")}>
        <div className="grid gap-2 @[560px]:grid-cols-[minmax(0,1fr)_17ch]">
          <Box label="your module" on={has("module")}>
            <div className="grid gap-2 @[560px]:grid-cols-[minmax(0,1fr)_17ch]">
              <Box label="package com.shop" on={has("package")}>
                <Box label="class Cart" on={has("class")} className="min-h-[54px]">
                  <span className="text-12 text-hi">
                    {mod === "package" ? "" : mod.startsWith("public") ? "public" : mod} int total;
                  </span>
                </Box>
              </Box>
              <Box label="subclass, other pkg" on={has("subInModule")} stack />
            </div>
          </Box>
          <Box label="subclass, other module" on={has("subInWorld")} stack />
        </div>
      </Box>

      <Narration>{NOTE[mod]}</Narration>
    </div>
  );
}
