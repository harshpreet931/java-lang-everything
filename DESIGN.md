---
version: 3
name: java.lang.everything
description: lit instruments. quiet paper for reading, lit instruments for seeing. a warm grey paper, one reading face, figures drawn as fields of dots, and five colours that each mean one thing and each have a shape.
colors:
  paper: "#f7f6f2"     # dark: "#161513"
  ink: "#26241f"       # dark: "#e3ded5"
  hi: "#141311"        # dark: "#f6f2eb"
  mute: "#5c5850"      # dark: "#aca59a"
  faint: "#6b665d"     # dark: "#948d82"
  line: "#e6e3dc"      # dark: "#2a2825"
  line-2: "#d3cfc6"    # dark: "#3a3834"
  edge: "#8a857b"      # dark: "#77716a"  (control outlines, 3:1, never text)
  well: "#fdfcfa"      # dark: "#0e0e0d"  (instrument face, code)
  well-2: "#efede7"    # dark: "#22211e"
  grid: "#d6d2c8"      # dark: "#2a2825"  (unlit dots)
  dot: "#3b3832"       # dark: "#d9d3c8"  (neutral lit dots)
  book: "#b0305f"     # dark: "#f17ca8"  (lacquer, wayfinding only)
semantic:
  ref: "#2a5fa6"     # references, pointers, arrows, "points at"
  live: "#2b7448"    # valid, reachable, correct, the answer
  dead: "#b0362f"    # garbage, bugs, races, exceptions, the wrong way
  meta: "#6a45ad"    # runtime machinery: class metadata, locks, loaders, headers
  hot: "#94580a"     # "look here": the current line, the thing that changed
typography:
  title: Redaction 400
  title-eroded: Redaction 20 (40px and up, once a page)
  reading: Piazzolla variable, 19px / 1.62 (dark 380 weight, 1.68)
  ui: Geist
  code: Geist Mono
  readout: Geist Pixel (hero counters only)
  address: Departure Mono (11px or 22px only)
spacing:
  measure: 37.5rem
  article: 880px
---

## overview

java.lang.everything is set as **lit instruments**: quiet paper for reading, lit instruments for seeing. the page is almost silent. a warm grey paper (not cream), one reading face, real contrast, a 68 character measure, no ornaments, no drop cap, no hairline above every heading. all the craft goes into two places:

1. **the instruments.** figures are fields of dots on a fine dot grid (the unlit dots are the address space). colour comes only from the five semantic tokens, and each one also has a shape, so colour is never the only signal. the panel looks lit from within: a step brighter than the paper in light, a step darker than the room in dark, with an inset rim of the book colour.
2. **the brand.** a three by three dot grid that every mark, favicon, hero and share image is built on.

the world owns the frame and serves the column: the rail, the opener, the instruments and the marks carry the character. the column is plain Piazzolla on flat paper.

## colour

two themes: **paper** (light) and **lab** (dark, a dim room `#161513`, never pure black). a first visit follows the os setting; the choice is saved under `jle-theme`. every colour is a css variable in `src/app/globals.css`, with a tailwind utility of the same name (`text-mute`, `bg-well`, `border-edge`, `text-book`...). never hard-code a hex in a component.

neutrals: `bg`, `ink` (body text), `hi` (headings, emphasis, the active thing), `mute` (secondary), `faint` (labels, line numbers, comments; still 4.5:1), `line` / `line-2` (hairlines), `edge` (control outlines, 3:1, never text), `well` (instrument face and code), `well-2` (nested chips, the active rail row, inline code), `grid` (unlit dots), `dot` (neutral lit dots).

the **book colour** `--book` is lacquer (`#b0305f` / `#f17ca8`). it is wayfinding only: the mark, the lit rail lamp and toc dot, link underlines, the focus ring, the caret, the selection tint, the instrument rim, the run comet. it never carries a meaning inside a figure. `--book-hi` is its stronger step. both books' colours exist in both repos (`--java`, `--sql`) for cross-links.

shadows are tokens too: `--rim` (the instrument rim), `--surface` (one step off the paper: a 1px ring and a 1px contact shadow, for code), `--overlay` (search, menus), `--scrim` (behind drawers and dialogs).

the five semantic colours mean exactly one thing each, across every figure on the site, and each has a shape:

| token | shape |
| --- | --- |
| `ref` | a run of small dots ending in a bigger one (an arrow chevron in chapter figures) |
| `live` | a filled dot |
| `dead` | a hollow ring: fill drained, outline kept |
| `meta` | the header column at the left of every object or page (a pill) |
| `hot` | a slightly larger dot, with a halo |

| token | means | examples |
| --- | --- | --- |
| `ref` | a reference, a pointer, "points at" | stack slot → heap object arrows, bucket links |
| `live` | reachable, valid, correct | live objects during GC, the right answer |
| `dead` | garbage, bug, race, exception | unreachable objects, data races, the wrong way |
| `meta` | runtime machinery | class metadata, monitors, class loaders, headers |
| `hot` | look here | the current line, the value that just changed |



never use the semantic colours as decoration. code has its own muted palette (`--code-*`: slate keywords, sage strings, brown literals, italic comments at 4.5:1) so it never competes with them.

### contrast (wcag 2.x, small text)

| token | paper on bg / well / well-2 | lab on bg / well / well-2 |
| --- | --- | --- |
| ink | 14.34 / 15.12 / 13.24 | 13.62 / 14.42 / 12.02 |
| mute | 6.55 / 6.90 / 6.05 | 7.48 / 7.91 / 6.60 |
| faint | 5.27 / 5.56 / 4.87 | 5.55 / 5.88 / 4.90 |
| ref | 5.91 / 6.23 / 5.46 | 8.30 / 8.79 / 7.32 |
| live | 5.26 / 5.54 / 4.86 | 9.85 / 10.43 / 8.69 |
| dead | 5.69 / 6.00 / 5.25 | 7.22 / 7.64 / 6.37 |
| meta | 6.33 / 6.68 / 5.85 | 8.28 / 8.76 / 7.30 |
| hot | 5.31 / 5.60 / 4.90 | 9.87 / 10.45 / 8.71 |
| java | 5.65 / 5.96 / 5.22 | 7.12 / 7.53 / 6.28 |
| sql | 5.25 / 5.54 / 4.85 | 9.70 / 10.26 / 8.56 |
| edge (non-text) | 3.39 / 3.58 / 3.14 | 3.78 / 4.00 / 3.34 |

## type

every face is SIL OFL 1.1, self-hosted from `src/fonts/<family>/` (each with its OFL.txt) and loaded with `next/font/local` in `src/app/layout.tsx`. every family keeps a system stack behind it.

| role | face | css var / utility | size / line / tracking | where |
| --- | --- | --- | --- | --- |
| title | Redaction 400 | `--font-title` / `font-title` | h1 48 / 1.04 / -0.018em, h2 31 / 1.12 / -0.012em, h3 24 / -0.01em | chapter and page titles, section heads |
| title, eroded | Redaction 20 | `--font-title-eroded` | 40px and up only, once a page | the home title, the share image |
| body | Piazzolla (variable, opsz auto) | `--font-body` / `font-body` | 19 / 1.62, phone 18. lab: weight 380, 1.68, +0.004em | prose, ledes (21), blurbs and captions in italic |
| ui | Geist 400 / 500 | `--font-ui` / `font-ui` | 12 to 15 | bar, rail, toc, buttons, chapter meta, legends, table heads, callout words |
| code | Geist Mono + italic | `--font-mono` / `font-mono` | 14 / 1.65, phone 13, ligatures off | code, result grids, values inside figures |
| readout | Geist Pixel, `"ELSH" 25` | `--font-pixel` | 28 to 32 | the hero counters only |
| address | Departure Mono | `--font-addr` / `font-addr` | 11 or 22 only (its pixel grid) | the chapter address `everything.basics.stackAndHeap`, below the title |

old names still resolve, so older figures keep working: `var(--font-code)` is mono, `var(--font-serif)` is body, `var(--font-display)` is title, and the utilities `font-serif` / `font-sans` are body, `font-display` is title. don't use them in new work.

the faces are latin subsets: no `→ ← ↔ ⌘ ↵ ≤ ≥ ≠ ✓ ✗` glyphs (Redaction has no `↑ ↓ ±` either). in prose these fall back to the system face. in chrome and figures, draw arrows in svg (`components/site/Arrow.tsx`).

headings are lowercase like the prose, left aligned, `text-wrap: balance`. paragraphs and captions are left aligned (never justified) with `text-wrap: pretty`. tabular lining figures on tables, counters, rail and toc numbers and figure values. inline code never wraps on desktop.

## layout

a chapter opens with its title (Redaction), the blurb (italic), then the meta row: the address in Departure Mono 11px, then "part 2, the basics", "chapter 11 of 14" and the reading time in Geist 13. no eyebrow or kicker ever sits above a heading. a 1px rule, then the opening paragraph a step larger (no drop cap).

three columns on wide screens: the contents rail (264px: part rows with their cover swatch, chapter rows with progress lamps), the article (prose at the 37.5rem measure, figures up to ~880px, `wide` figures a little more), and "on this page" (208px, a lit dot for where you are and a percentage). below 1280 the toc goes; below 1024 the rail becomes a drawer. on phones the bar keeps the wordmark, search and a dot-grid menu holding learn, play, glossary, the theme and the source.

## components

- **figure**: the instrument panel (`.ticks` or `.inst`): `well`, `--rim`, radius 12. caption below, centred, italic, saying what to click and what to notice.
- **code**: a surface one step off the paper (`well`, `--surface`, radius 10). a 46px head with the file name (Geist Mono) or the language (Geist, mute), edit as an outlined button, **run** as a solid pill, copy as a 40px icon. line numbers in the comment colour. the active line: a hot tint and a 2px hot bar (the code-editor convention, not a callout bar). while code runs, one book-colour comet travels the frame's ring.
- **result grids**: Geist Mono 13.5, tabular, a 1px rule under each row, type names under the column names in Geist faint. numbers right aligned, `null` faint italic.
- **callouts** (gotcha, interview, effective java, note, one level deeper, quiz): a 1px `line-2` ring, radius 10, labelled by a lit dot in the callout's shape and colour plus a word in Geist 13 medium, then an optional italic title. never a coloured side bar.
- **glyph chips** (`<C k>`): the word wears its colour and its shape (`.chip`, `.chip-dot`), so a noun in prose matches the figure object it names.
- **buttons**: `.act` is Geist 13.5, 34px tall with a 42px hit area, an `edge` outline; `.act.solid` is filled `hi`. `.word` is a quiet option; selected is a soft filled chip. icon buttons are 40px.
- **links**: `ink`, a 1px underline in the book colour at 55%, offset 0.22em. hover: `hi` and the full book colour.
- **focus**: a 2px book-colour ring, 2px offset, on everything. the caret and the selection tint are the book colour too.

## marks

all marks sit on one three by three dot grid (16px viewBox, dots at 3.5 / 8 / 12.5). the series mark is nine ink dots, each row smaller than the last, never coloured. this book's mark is slot → object: one ink slot, a short stroke, and a big object dot lit in lacquer. favicons put the glyph on a dark display tile. the wordmark sets `java.lang.` in Geist Mono at 0.66em in mute and `everything` in Redaction. (owned by `components/site/Mark.tsx`.)

## motion

- ui changes in 120 to 200ms on `cubic-bezier(0.2, 0, 0, 1)` (`--ease`, `--d-fast`, `--d-ui`, `--d-fig`). buttons press to 0.96.
- motion is reader-triggered or one short load moment, 60fps, interruptible, paused offscreen (IntersectionObserver) and when the tab is hidden. prose never moves.
- every animated thing has a meaningful static first frame rendered on the server. no blank canvas, no layout shift, no `opacity: 0` waiting for js.
- the theme switch snaps: `.no-tr` on `<html>` for two frames while the tokens flip.
- `prefers-reduced-motion` removes movement and keeps colour and opacity steps, which carry meaning. there is no global kill: transitions are limited to colour, opacity, fill, stroke and shadow; flow dots, glyph loops and the run comet stop. figures with their own tweens check the media query and jump to the end state.

## the glow exception

in the lab theme the lit dots of an instrument may carry a soft gaussian glow, and the home hero and the share images sit on a blurred pool of light in the book's palette (dawn: rose, apricot, butter, mauve). that is the one authored glow on the site. it lives inside the hero's field wrapper and the share image, behind the dot illustration, and stops before any status line or legend. it never sits behind prose, code, labels or figure content.

## do / don't

- do write controls as what they do ("step", "run", "reset").
- do make every figure readable on paper first, then check the lab theme.
- do give every semantic colour its shape too.
- don't use pure black or pure white surfaces, gradients, ornaments, drop caps or coloured side bars.
- don't put long text in mono. if people read it, it's Piazzolla.
- don't use em dashes anywhere.
