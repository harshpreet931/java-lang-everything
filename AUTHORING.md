# authoring

how to write a chapter for java.lang.everything. read [DESIGN.md](./DESIGN.md) and [how it reads](#how-it-reads) first, then open the reference chapter and keep it next to you:

- **reference chapter:** [`content/basics/stack-and-heap.mdx`](./content/basics/stack-and-heap.mdx) (live at `/learn/basics/stack-and-heap`)
- **reference figures:** [`src/components/figures/basics/`](./src/components/figures/basics/)

every chapter should be as good as that one. if it isn't, it's not done.

---

## the deal

- **less text, more picture.** a chapter is mostly figures, small code and short paragraphs. if three paragraphs explain something a figure could show, draw the figure.
- **every claim is true.** every runnable snippet is run on a real JDK. every version number is checked against the JEP. numbers in figures are measured or cited, never vibes.
- **finished, not scaffolded.** no "todo", no "coming soon", no stub sections. a short complete chapter beats a long half one.
- **written by a person.** lowercase, casual, information dense. see [how it reads](#how-it-reads).

the JDK this site targets: **java 25 (latest LTS)** for all runnable code. **java 27** is the latest release (sep 2026). jdk 28 is in development (mar 2027).

## how it reads

- sentences and headings start lowercase. code stays exactly as written (`HashMap`, never `hashmap`). acronyms stay uppercase (JVM, GC, JIT) and people's names stay capitalized.
- no em dashes. use a comma, a colon, a period or parentheses. `pnpm check` fails on them.
- no hype words (comprehensive, ultimate, seamless and the rest of the list in `scripts/check.mjs`). `pnpm check` warns on them.
- short sentences, one idea each. show it in a figure before you explain it in a paragraph.
- `:)` at most once per page. no other emoji.

---

## files

```
content/<part>/<chapter>.mdx              the chapter (slug must match src/content/curriculum.ts)
content/<part>/terms.json                 glossary terms this part introduces
src/components/figures/<part>/*.tsx       bespoke figures for this part
```

the chapter list, titles and blurbs live in `src/content/curriculum.ts`. don't add, remove or rename chapters there. the page renders the title, blurb, breadcrumb and reading time for you: **don't write a `# heading`**.

## chapter anatomy

```mdx
import { SomeFigure } from "@/components/figures/<part>/SomeFigure";

export const trace = { ... };            // only if you use a stepper (see "traces")

<InShort>
one or two lines that are the whole idea. bold the 2-3 key terms.
</InShort>

## the picture                            // lowercase h2s, 3 to 7 of them
analogy first, mapped in parentheses. then a <Figure>.

## <the mechanism>
a step-through, a diagram, small code with output.

<Predict ...> or <Quiz ...>               // at least one per chapter

## <the gotcha / the why-not / the edge>
<Gotcha>, <Deep>, <Interview> as they fit.

<Keylines>
- 3 to 6 one-liners. the whole chapter, if you only read this.
</Keylines>
```

target: 600 to 1400 words of prose, 3+ figures, 1+ check (Predict/Quiz). flagship chapters can be longer.

link generously to other chapters with absolute paths: `[pass-by-value](/learn/basics/pass-by-value)`. every chapter in the curriculum has a page (unwritten ones say "soon"), so links never 404.

---

## components (all global, no import needed)

### text blocks

```mdx
<InShort>the tl;dr. top of every chapter.</InShort>

<Gotcha title="optional short title">the thing that bites people.</Gotcha>
<Interview q="the question, as an interviewer would ask it">the answer that lands.</Interview>
<Effective item={17} title="minimize mutability">how this chapter maps to effective java. paraphrase only.</Effective>
<Note title="optional">a neutral aside. rare.</Note>
<Deep title="why the same program overflows at different depths">one level deeper. collapsed by default.</Deep>

<Keylines>
- one line each.
</Keylines>

<C k="ref">blue word</C>    colours a word to match a figure (ref | live | dead | meta | hot)
<Since v={21} />            inline "java 21+" badge.  <Since preview v={27} /> → "preview in 27"
<Defs><dt>term</dt><dd>meaning</dd></Defs>
```

### checks

```mdx
<Predict options={["1", "99", "compile error"]} answer={1}>
```java
int[] a = {1, 2, 3};
int[] b = a;
b[0] = 99;
IO.println(a[0]);
```
<Explain>
why. shown only after they answer.
</Explain>
</Predict>

<Quiz question="which one is thread-safe?" options={["HashMap", "ConcurrentHashMap"]} answer={1}>
<Explain>...</Explain>
</Quiz>
```

### layout

```mdx
<Compare>
<Bad label="string concat in a loop">
```java
...
```
</Bad>
<Good label="StringBuilder">
```java
...
```
</Good>
</Compare>

<Tabs>
<Tab label="maven">...</Tab>
<Tab label="gradle">...</Tab>
</Tabs>

<Figure caption={<>what to click, and what to notice. <C k="dead">colour words</C> to match.</>} wide>
...any figure...
</Figure>
```

`<Figure>` draws the soft panel and the caption, and switches its contents to the mono face. `wide` lets it break out a little past the text column (use for steppers). captions tell the reader what to do and what to look at, in one or two sentences.

### generic figures

| component | use it for |
| --- | --- |
| `<MemoryStepper trace={t} />` | code + stack + heap, step by step. the python-tutor view. |
| `<CodeStepper trace={t} />` | same, without memory. walk code line by line with notes + stdout. |
| `<Memory frames={[...]} heap={{...}} />` | one static stack/heap snapshot |
| `<ArrayViz values={[3,1,4]} pointers={{0: "i"}} tones={{2: "hot"}} range={[0,1,"live"]} label="int[] a" dim={[3]} />` | arrays, buffers, indexes |
| `<Bits type="int" value={-1} editable input />` | the real bits of byte/short/char/int/long/float/double |
| `<Tree>{` indented text `}</Tree>` | hierarchies (classes, exceptions, interfaces). **indent 4 spaces per level** (mdx eats 2). `// note`, `#dead` to colour |
| `<Flow stages={[{ label, sub, note }]} />` | pipelines (source → javac → bytecode → JVM) |
| `<Slides><Slide note="...">...</Slide></Slides>` | any sequence of frames with step controls |
| `<Bars data={[{ label, value, tone }]} unit="ns" log />` | numbers to compare (benchmarks, sizes) |

### code blocks

````mdx
```java title="Main.java" run output="7 9 5" {3-4} /count/
...
```
````

- `title="..."` file tab. untitled blocks show the language.
- `run`: this is a complete program. `pnpm java-check` runs it on a real JDK 25, and on the site it gets **run** and **edit** buttons that compile and run it in the browser (real javac, but TeaVM instead of a JVM, see `src/lib/java/README.md`). programs that use things the browser runtime lacks (virtual threads, executors, locks, Scanner, reflection, files, catching `/ 0`...) automatically lose the button and show a note instead, and anything touching `HashMap`/`HashSet` order gets a caveat. so: put `run` on every complete program, and always give `output=` so readers see what real java prints. use it a lot.
- `output="..."`: the exact stdout (`\n` for newlines). shown under the block, and checked by `pnpm java-check`. if the program throws, the expected output ends with the first line of the exception: `Exception in thread "main" java.lang.ArithmeticException: / by zero`.
- `{3-4}` highlight lines, `/word/` highlight a word, `nolines` hide line numbers.
- notation comments (removed from the output):
  `// [!code highlight]` `// [!code ++]` `// [!code --]` `// [!code focus]` `// [!code error]` `// [!code warning]` `// [!code word:count]`
- languages: `java`, `bash` (terminal), `text`, `xml`, `json`, `kotlin`, `groovy`, `properties`, `yaml`.

prefer java 25 **compact source files** for small runnable demos:

```java run output="hi"
void main() {
    IO.println("hi");
}
```

use the classic `public class Main { public static void main(String[] args) }` when the chapter is about classes, access, packages or anything where the implicit class would confuse things. both run with `java Main.java`.

---

## traces (for MemoryStepper / CodeStepper)

the format is in [`src/lib/trace.ts`](./src/lib/trace.ts). each step is a full snapshot: `line` is the line **about to run**, `frames` (bottom first), `heap` (by stable id), optional `stdout` (cumulative), `note` (one lowercase sentence), and objects can be marked `state: "dead"` or `tag: "string pool"`.

**always put traces in an `export const` at the top of the mdx.** mdx strips indentation inside jsx attributes, which mangles java source. esm exports keep it exact.

two ways to make one:

1. **by hand**, for conceptual figures. you control every note. keep it 6 to 14 steps.
2. **from a real run** with the tracer: `tools/tracer/trace.sh Foo.java > foo.trace.json` (see `tools/tracer/README.md`), then `import trace from "./foo.trace.json"` or paste and trim it into an export. add notes by hand afterwards.

objects that disappear between two steps are drawn as red "unreachable" ghosts automatically. that's how you show garbage.

---

## bespoke figures

the generic figures cover a lot. flagship ideas need their own component (a HashMap you can put keys into, a GC that sweeps, two threads racing on `count++`, a JIT tier meter). build them in `src/components/figures/<part>/Name.tsx`.

rules:

- `"use client"` if it's interactive. import the stepper with `import { useStepper, StepControls } from "@/components/viz/stepper"` (never from `@/components/viz`, that pulls in server code).
- **colour only from tokens.** css variables: `--bg --ink --hi --mute --faint --line --line-2 --well --well-2` and the five semantic ones. tailwind classes exist for all of them (`text-mute`, `bg-well`, `border-line-2`, `text-ref`, `bg-dead`...). the default tailwind palette is turned off on purpose.
- **semantic colours mean one thing, always:** `ref` (blue) = a reference/pointer/arrow. `live` (green) = reachable, valid, correct. `dead` (red) = garbage, bug, race, exception, the wrong way. `meta` (purple) = runtime machinery (class metadata, locks, loaders, headers). `hot` (amber) = look here: the current thing, what just changed. never decorative.
- **type:** prose is Crimson Pro (serif), headings Cormorant Garamond, figures JetBrains Mono. inside `<Figure>` everything is mono already; if your figure can render outside one, put `font-mono` on its root. long explanatory text inside a figure (narration, notes) can be `font-serif`. sizes `text-11 … text-18`. svg text: `fontSize={11|12}`, `fill="var(--ink)"`, `fontFamily="var(--font-code)"`.
- **controls:** config-file rows (`key =` on the left in `text-faint`), options as `.word` buttons with `aria-pressed`, actions as `.act` / `.act.solid`, sliders `input[type=range].slider`. look at `StackOverflowMeter.tsx`.
- **frames:** wells (`bg-well`) with inset hairlines (`shadow-[inset_0_0_0_1px_var(--line)]`), radius `rounded-md` (6px) inside a figure. no heavy shadows, no gradients, no glow. never pure black or pure white surfaces: the default theme is warm paper, the dark one is warm charcoal.
- **motion:** only to explain something, under ~300ms for ui state, `ease-jle` (`cubic-bezier(0.2,0,0,1)`). respect `prefers-reduced-motion` (jump to the end state). no motion library needed for most things; `motion/react` is installed if you really need layout animation.
- **size:** must work from 360px wide (phone) to ~900px (the article column). test both. use `@container` queries or stack on narrow screens.
- **a11y:** real buttons, `aria-label`s on icon buttons, `role="img"` + `aria-label` on svgs, `aria-live` on narration.
- **no new dependencies.** react, motion, and the browser. that's it.
- svg arrowheads need unique marker ids (use `useId()` or a component-specific prefix).

---

## correctness

- run every `run` / `output=` block: `pnpm java-check content/<part>`. needs a JDK 25+ (`JLE_JAVA_HOME=/path/to/jdk`).
- version facts: when a feature was final, which JEP, what changed. check https://openjdk.org/jeps/<n>. don't trust memory for anything after java 21.
- numbers in figures: measure them (and say on what) or cite them.
- effective java: refer to items by number and **paraphrase**. never reproduce Bloch's text, and never reproduce text from any book or the javadoc beyond a short identifier.
- when the honest answer is "it depends", say what it depends on.

## checks before you're done

```bash
pnpm check <part>                     # compiles every chapter, lints voice, checks imports
pnpm java-check content/<part>        # runs the java
pnpm typecheck                        # if you wrote figures
```

then look at it. the dev server runs at `http://localhost:3123/learn/<part>/<chapter>`. check it at 1440px and 390px wide, paper and night (`t` toggles the theme). paper is the default, so judge it there first.
