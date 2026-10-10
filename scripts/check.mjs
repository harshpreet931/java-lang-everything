#!/usr/bin/env node
// pnpm check [part...]      validates chapters without a full build:
//   1. every chapter in the curriculum for those parts has an mdx file (warn if missing)
//   2. each mdx compiles with the real remark/rehype pipeline
//   3. every <Component> used is either global (mdx-components) or imported
//   4. relative/alias imports resolve to files that exist
//   5. voice lint: no em dashes, no banned words (AUTHORING.md)
//
// exit code 1 if anything is an error.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkToc from "../src/mdx/remark-toc.mjs";
import rehypeCode from "../src/mdx/rehype-code.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");

// the curriculum is typescript; pull slugs out with a regex instead of compiling it
const curriculumSrc = fs.readFileSync(path.join(root, "src/content/curriculum.ts"), "utf8");
const partsInOrder = [...curriculumSrc.matchAll(/slug: "([^"]+)",\n\s+n: \d+/g)].map((m) => m[1]);

// globals from mdx-components.tsx + viz/index.ts
const mdxComponentsSrc = fs.readFileSync(path.join(root, "src/mdx-components.tsx"), "utf8");
const vizSrc = fs.readFileSync(path.join(root, "src/components/viz/index.ts"), "utf8");
const globals = new Set([
  ...[...mdxComponentsSrc.matchAll(/^\s{2}([A-Z][A-Za-z0-9]*),?$/gm)].map((m) => m[1]),
  ...[...(vizSrc.match(/export const viz = \{([^}]+)\}/)?.[1] ?? "").matchAll(/([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]),
]);

const banned = [
  "comprehensive",
  "ultimate",
  "masterclass",
  "zero to hero",
  "seamless",
  "seamlessly",
  "robust",
  "leverage",
  "delve",
  "testament",
  "paradigm",
  "in today's world",
  "let's dive",
  "dive in",
  "buckle up",
  "it's important to note",
  "in conclusion",
];

const args = process.argv.slice(2);
const parts = args.length ? args : partsInOrder;
let errors = 0;
let warnings = 0;
const err = (f, m) => {
  errors++;
  console.log(`  ✗ ${f}: ${m}`);
};
const warn = (f, m) => {
  warnings++;
  console.log(`  ! ${f}: ${m}`);
};

const chapterSlugs = (part) => {
  const block = curriculumSrc.split(/\n  \{\n    slug: /).find((b) => b.startsWith(`"${part}"`));
  if (!block) return [];
  return [...block.matchAll(/\{ slug: "([^"]+)", title:/g)].map((m) => m[1]);
};

// walk the mdx syntax tree instead of regexing the source: code, inline code and esm blocks
// (export const traces full of java) are skipped exactly, however they're written.
const mdxParser = createProcessor();
function analyze(src) {
  const tree = mdxParser.parse(src);
  const components = new Set();
  const prose = [];
  const headings = [];
  let h1 = false;
  const text = (n) => (n.type === "text" ? n.value : (n.children ?? []).map(text).join(""));
  const walk = (n) => {
    if (n.type === "code" || n.type === "inlineCode" || n.type === "mdxjsEsm") return;
    if (n.type === "heading") {
      if (n.depth === 1) h1 = true;
      if (n.depth === 2 || n.depth === 3) headings.push(text(n));
    }
    if ((n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") && n.name && /^[A-Z]/.test(n.name) && !n.name.includes(".")) {
      components.add(n.name);
      // attribute text (captions, questions, options) is prose too
      for (const a of n.attributes ?? []) {
        if (typeof a.value === "string") prose.push(a.value);
        else if (a.value?.value) prose.push(a.value.value);
      }
    }
    if (n.type === "text") prose.push(n.value);
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  return { components, prose: prose.join("\n"), headings, h1 };
}

for (const part of parts) {
  const dir = path.join(contentDir, part);
  const slugs = chapterSlugs(part);
  if (!slugs.length) {
    err(part, "not a part in src/content/curriculum.ts");
    continue;
  }
  console.log(`\n${part}`);
  for (const slug of slugs) {
    const file = path.join(dir, `${slug}.mdx`);
    const rel = path.relative(root, file);
    if (!fs.existsSync(file)) {
      warn(rel, "missing (shows as 'soon')");
      continue;
    }
    const src = fs.readFileSync(file, "utf8");

    // 2. compile
    try {
      await compile(
        { path: file, value: src },
        {
          remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: "frontmatter" }], remarkToc],
          rehypePlugins: [rehypeCode],
        },
      );
    } catch (e) {
      err(rel, `compile failed: ${String(e.message ?? e).split("\n")[0]}${e.line ? ` (line ${e.line})` : ""}`);
      continue;
    }

    // 3 + 4. components and imports
    const imported = new Set();
    for (const m of src.matchAll(/^import\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))(?:\s*,\s*\{([^}]+)\})?\s+from\s+["']([^"']+)["'];?$/gm)) {
      const names = [m[1], m[3]]
        .filter(Boolean)
        .flatMap((s) => s.split(","))
        .map((s) => s.trim().split(/\s+as\s+/).pop())
        .filter(Boolean);
      if (m[2]) names.push(m[2]);
      names.forEach((n) => imported.add(n));
      const spec = m[4];
      let target;
      if (spec.startsWith("@/")) target = path.join(root, "src", spec.slice(2));
      else if (spec.startsWith("@content/")) target = path.join(root, "content", spec.slice(9));
      else if (spec.startsWith(".")) target = path.resolve(dir, spec);
      if (target) {
        const ok = ["", ".ts", ".tsx", ".js", ".mjs", ".json", "/index.ts", "/index.tsx"].some((ext) => fs.existsSync(target + ext));
        if (!ok) err(rel, `import not found: ${spec}`);
      }
    }
    const facts = analyze(src);
    for (const name of facts.components) {
      if (!globals.has(name) && !imported.has(name)) err(rel, `<${name}> is not global and not imported`);
    }

    // 5. voice
    const prose = facts.prose;
    if (prose.includes("—")) {
      const line = src.split("\n").findIndex((l) => l.includes("—") && !l.trim().startsWith("//"));
      err(rel, `em dash found (line ${line + 1}). use a comma, colon, period or parentheses.`);
    }
    const lower = prose.toLowerCase();
    for (const b of banned) if (new RegExp(`\\b${b}\\b`).test(lower)) warn(rel, `banned phrase: "${b}"`);
    if (!facts.components.has("InShort")) warn(rel, "no <InShort> at the top");
    if (!facts.components.has("Keylines")) warn(rel, "no <Keylines> at the end");
    // title case = two or more words starting with a capital (class names like "Semaphore: ..." are fine)
    for (const h of facts.headings) {
      const caps = h.split(/\s+/).filter((w) => /^[A-Z][a-z]/.test(w) && !/[A-Z]/.test(w.slice(1)));
      if (caps.length >= 2) warn(rel, `heading should be lowercase: "${h}"`);
    }
    if (facts.h1) err(rel, "don't use a level-1 heading; the page renders the title");
  }
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
