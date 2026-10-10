# contributing

thanks for wanting to help :)

## the short version

1. every chapter is one file: `content/<part>/<chapter>.mdx`. the order and titles live in `src/content/curriculum.ts`.
2. read [DESIGN.md](./DESIGN.md) (how it looks) and [AUTHORING.md](./AUTHORING.md) (how it reads, every component, every rule).
3. open `content/basics/stack-and-heap.mdx` next to your editor. that's the bar.
4. run the checks, look at your page, open a PR.

## setup

```bash
pnpm install
pnpm dev                 # http://localhost:3000
```

you need node 22.12+ and pnpm 10. for the java checks you need a JDK 25+ (`JLE_JAVA_HOME=/path/to/jdk`, or `java` on your PATH).

## checks

```bash
pnpm check <part>                        # compiles chapters, lints the voice, checks imports
pnpm java-check content/<part>           # runs every `run` / `output=` snippet on a real JDK
pnpm typecheck                           # if you touched tsx
pnpm build                               # the full static site + search index
```

CI runs all of them on every PR.

## kinds of contributions

- **fix something wrong.** a wrong fact, a wrong output, a broken figure. these are the most valuable PRs. please say how you verified it (a JEP link, the jdk source, a run).
- **add a chapter or a figure.** something the book is missing, or a figure that would replace three paragraphs. open an issue first so two people don't build the same one.
- **make a figure better.** figures live in `src/components/figures/<part>/`. keep them dependency-free and token-coloured.
- **typos and voice.** if something reads like a corporate blog post, it's a bug.

## what we won't merge

- text copied from books, javadoc, blog posts or other courses. explain it in your own words.
- figures that use colour as decoration. every colour on this site means one thing (see DESIGN.md).
- claims about versions or performance without a source or a measurement.
- em dashes. seriously.
