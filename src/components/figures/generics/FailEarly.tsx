"use client";

import { useState } from "react";
import { CodePanel, Narrate, Row, Words } from "../functional/kit";
import { Terminal } from "./ui";

// the same bug, written twice: once with a raw List (how everyone wrote java before
// 2004) and once with List<String>. both programs were compiled and run with jdk 25;
// every line of output below is verbatim, wrapped to fit (the CCE's module note is cut to (...)).

const RAW = `static List loadNames() {          // a 2003-style API
    List names = new ArrayList();
    names.add("ada");
    names.add(42);
    return names;
}

void main() {
    List names = loadNames();
    for (Object o : names) {
        String s = (String) o;
        IO.println(s.toUpperCase());
    }
}`;

const GEN = `static List<String> loadNames() {
    List<String> names = new ArrayList<>();
    names.add("ada");
    names.add(42);
    return names;
}

void main() {
    List<String> names = loadNames();
    for (String s : names) {       // no cast
        IO.println(s.toUpperCase());
    }
}`;

type Mode = "raw" | "gen";

export function FailEarly() {
  const [mode, setMode] = useState<Mode>("raw");
  const raw = mode === "raw";

  return (
    <div className="@container grid gap-4">
      <div>
        <Row k="names is a" w="11ch" last>
          <Words
            options={[
              { v: "raw", label: "List (raw)" },
              { v: "gen", label: "List<String>" },
            ]}
            value={mode}
            onChange={setMode}
            label="type of the list"
          />
        </Row>
      </div>

      <CodePanel
        file="Main.java"
        code={raw ? RAW : GEN}
        hot={raw ? [4] : []}
        dead={raw ? [11] : [4]}
        notes={
          raw
            ? { 4: { text: "← the bug is here", tone: "hot" }, 11: { text: "← it explodes here", tone: "dead" } }
            : { 4: { text: "← javac stops here", tone: "dead" } }
        }
      />

      <div className="grid gap-2 @[620px]:grid-cols-2 @[620px]:gap-3">
        <Terminal
          cmd="javac Main.java"
          edge={raw ? undefined : "dead"}
          minH="5.2em"
          lines={
            raw
              ? [
                  { t: "Note: Main.java uses unchecked or unsafe", tone: "mute" },
                  { t: "  operations.", tone: "mute" },
                  { t: "Note: Recompile with -Xlint:unchecked for", tone: "mute" },
                  { t: "  details.", tone: "mute" },
                  { t: "" },
                  { t: "compiled. (-Xlint:all shows 6 warnings)", tone: "faint" },
                  { t: "" },
                ]
              : [
                  { t: "Main.java:4: error: incompatible types:", tone: "dead" },
                  { t: "int cannot be converted to String", tone: "dead" },
                  { t: "    names.add(42);", tone: "ink" },
                  { t: "              ^", tone: "dead" },
                ]
          }
        />
        <Terminal
          cmd="java Main"
          edge={raw ? "dead" : undefined}
          dim={!raw}
          minH="5.2em"
          lines={
            raw
              ? [
                  { t: "ADA" },
                  { t: 'Exception in thread "main"', tone: "dead" },
                  { t: "java.lang.ClassCastException: class", tone: "dead" },
                  { t: "java.lang.Integer cannot be cast to class", tone: "dead" },
                  { t: "java.lang.String (...)", tone: "dead" },
                  { t: "    at Main.main(Main.java:11)", tone: "mute" },
                ]
              : [{ t: "(never runs: no class file was written)", tone: "faint" }]
          }
        />
      </div>

      <Narrate>
        {raw
          ? "it compiles (two notes, easy to ignore), it runs, it prints ADA, and then it dies on line 11. the stack trace points at the cast, seven lines and one method away from the real bug. in a real codebase that's a different file, and maybe a different team."
          : "same bug, caught by javac on the exact line that's wrong, before anything runs. and the loop got simpler: no Object, no cast, because the compiler already knows every element is a String."}
      </Narrate>
    </div>
  );
}
