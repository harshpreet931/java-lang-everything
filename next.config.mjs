import createMDX from "@next/mdx";
import { fileURLToPath } from "node:url";

// plugins are passed as strings so they survive turbopack's serialization.
// local plugins need absolute paths (the loader resolves relative to each .mdx file).
const local = (p) => fileURLToPath(new URL(p, import.meta.url));

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      "remark-gfm",
      "remark-frontmatter",
      ["remark-mdx-frontmatter", { name: "frontmatter" }],
      local("./src/mdx/remark-toc.mjs"),
    ],
    rehypePlugins: [local("./src/mdx/rehype-code.mjs")],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pin the workspace root: a stray lockfile in a parent folder otherwise makes turbopack watch all of it
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  pageExtensions: ["ts", "tsx", "mdx"],
  reactStrictMode: true,
};

export default withMDX(nextConfig);
