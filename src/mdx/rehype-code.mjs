// code blocks: shiki (via rehype-pretty-code) with our two monochrome themes,
// shiki notation comments, and a few extras for <CodeBlock>:
//   data-raw     the original source (for copy + run)
//   data-title   from title="Main.java"
//   data-run     the block gets a "run" button
//   data-output  expected output shown under the block, from output="..."  (\n allowed)
//   data-nolines hide line numbers
//
// authoring:  ```java title="Main.java" run {3-4} /count/
//   // [!code highlight]  // [!code ++]  // [!code --]  // [!code focus]  // [!code error]
import rehypePrettyCode from "rehype-pretty-code";
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { visit, SKIP } from "unist-util-visit";
import { darkTheme, lightTheme } from "./themes.mjs";

const meta = {
  name: "jle-meta",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    node.properties["data-raw"] = this.source.replace(/\n$/, "");
    if (/(^|\s)run(\s|$)/.test(raw)) node.properties["data-run"] = "";
    if (/(^|\s)nolines(\s|$)/.test(raw)) node.properties["data-nolines"] = "";
    // output was base64-encoded by hideOutputs() so rehype-pretty-code never reads its quotes as word highlights
    const enc = /output=b64:([A-Za-z0-9_-]+)/.exec(raw)?.[1];
    if (enc) {
      const output = Buffer.from(enc, "base64url").toString("utf8");
      node.properties["data-output"] = output.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  },
};

const v3 = { matchAlgorithm: "v3" };

const prettyOptions = {
  theme: { dark: darkTheme, light: lightTheme },
  keepBackground: false,
  defaultLang: { block: "java" },
  transformers: [
    transformerNotationHighlight(v3),
    transformerNotationDiff(v3),
    transformerNotationFocus(v3),
    transformerNotationWordHighlight(v3),
    transformerNotationErrorLevel(v3),
    meta,
  ],
};

// rehype-pretty-code wraps titled blocks in <figure><figcaption/><pre/></figure>.
// fold that back into one <pre data-title> so <CodeBlock> owns the whole thing.
function unwrapFigures() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "figure" || !("data-rehype-pretty-code-figure" in node.properties)) return;
      let title;
      let pre;
      for (const child of node.children) {
        if (child.type !== "element") continue;
        if (child.tagName === "figcaption") {
          title = child.children.map((c) => (c.type === "text" ? c.value : "")).join("");
        }
        if (child.tagName === "pre") pre = child;
      }
      if (!pre || !parent || index === undefined) return;
      if (title) pre.properties["data-title"] = title;
      parent.children[index] = pre;
      return [SKIP, index];
    });
  };
}

// rehype-pretty-code treats any "quoted text" in the meta as a word to highlight. output="..."
// is full of quotes (exception messages, strings), so encode it before pretty-code looks.
function hideOutputs(tree) {
  visit(tree, "element", (node) => {
    if (node.tagName !== "code" || typeof node.data?.meta !== "string") return;
    // markdown has already unescaped \" to ", so the value can contain bare quotes. it ends at the
    // first quote that's followed by the end of the meta or by another flag.
    node.data.meta = node.data.meta.replace(
      /output="(.*?)"(?=\s*$|\s+(?:title=|run(?:\s|$)|nolines(?:\s|$)|\{|\/))/,
      (_, v) => `output=b64:${Buffer.from(v, "utf8").toString("base64url")}`,
    );
  });
}

export default function rehypeCode() {
  const pretty = rehypePrettyCode(prettyOptions);
  const unwrap = unwrapFigures();
  return async (tree, file) => {
    hideOutputs(tree);
    await pretty(tree, file);
    unwrap(tree);
  };
}
