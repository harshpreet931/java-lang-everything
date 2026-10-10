#!/usr/bin/env node
// pnpm java-check content/basics/stack-and-heap.mdx [more.mdx | dir ...]
//
// runs every ```java block that has `run` or output="..." in its meta on a real JDK,
// and compares stdout with output="..." when given. snippets without either are skipped.
//
// JDK: $JLE_JAVA_HOME/bin/java, else $JAVA_HOME/bin/java, else `java` on PATH. needs java 25+.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const home = process.env.JLE_JAVA_HOME ?? process.env.JAVA_HOME;
const java = home ? path.join(home, "bin", "java") : "java";

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.log("usage: pnpm java-check <file.mdx | dir> ...");
  process.exit(2);
}

const walk = (p) =>
  fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).flatMap((f) => walk(path.join(p, f)))
    : p.endsWith(".mdx")
      ? [p]
      : [];
const files = inputs.flatMap(walk);

let failed = 0;
let ran = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const blocks = [...src.matchAll(/^([ \t]*)```java([^\n]*)\n([\s\S]*?)^\1```/gm)];
  for (const [, indent, meta, body] of blocks) {
    const wantsRun = /(^|\s)run(\s|$)/.test(meta);
    const out = /output="((?:[^"\\]|\\.)*)"/.exec(meta)?.[1];
    if (!wantsRun && out === undefined) continue;

    const code = body
      .split("\n")
      .map((l) => (indent && l.startsWith(indent) ? l.slice(indent.length) : l))
      .join("\n")
      // strip shiki notation comments
      .replace(/\s*\/\/ \[!code [^\]]+\]/g, "");
    const cls = /public\s+(?:final\s+)?(?:class|record|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(code)?.[1] ?? "Main";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jle-"));
    const f = path.join(dir, `${cls}.java`);
    fs.writeFileSync(f, code);
    const r = spawnSync(java, ["--enable-preview", "--source", "25", f], { encoding: "utf8", timeout: 20000 });
    ran++;
    const line = src.slice(0, src.indexOf(body)).split("\n").length;
    const where = `${file}:${line}`;
    const stdout = (r.stdout ?? "").replace(/\s+$/, "");
    if (r.status !== 0 && !/Exception in thread/.test(r.stderr ?? "")) {
      failed++;
      console.log(`✗ ${where}  exit ${r.status}\n${(r.stderr ?? "").split("\n").slice(0, 8).join("\n")}\n`);
      continue;
    }
    if (out !== undefined) {
      const want = out.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\s+$/, "");
      const thrown = r.status !== 0 ? (r.stderr ?? "").split("\n")[0] : "";
      const got = [stdout, thrown].filter(Boolean).join("\n").replace(/\s+$/, "");
      if (got !== want) {
        failed++;
        console.log(`✗ ${where}  output mismatch\n  want: ${JSON.stringify(want)}\n  got:  ${JSON.stringify(got)}\n`);
        continue;
      }
    }
    console.log(`✓ ${where}`);
  }
}

console.log(`\n${ran} block(s) run, ${failed} failed`);
process.exit(failed ? 1 : 0);
