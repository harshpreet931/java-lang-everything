// two code themes for shiki (lit instruments): slate keywords, sage strings, brown
// literals, italic comments that still clear 4.5:1. muted on purpose, so the semantic
// colours in figures (blue = reference, red = garbage...) still stand out. the values
// match the --code-* tokens in globals.css.

const scopes = (s) => s.split(/\s+/).filter(Boolean);

function theme({ name, type, fg, bg, kw, ty, fn, lit, str, cmt, punc, anno }) {
  return {
    name,
    type,
    colors: { "editor.foreground": fg, "editor.background": bg },
    tokenColors: [
      { settings: { foreground: fg } },
      {
        scope: scopes("comment punctuation.definition.comment comment.block.javadoc"),
        settings: { foreground: cmt, fontStyle: "italic" },
      },
      {
        scope: scopes("string string.quoted punctuation.definition.string string.template"),
        settings: { foreground: str },
      },
      {
        scope: scopes(`
          keyword keyword.control keyword.operator.new keyword.other storage.modifier storage.type.primitive
          storage.type.java storage.type.var storage.type.local storage.type.record storage.type.enum storage.type.interface storage.type.class
          keyword.other.import keyword.other.package variable.language constant.language
          storage.type.annotation storage.modifier.import keyword.control.new`),
        settings: { foreground: kw },
      },
      {
        scope: scopes(`
          entity.name.type entity.name.class entity.other.inherited-class storage.type.generic
          storage.type.object support.class support.type entity.name.type.class entity.name.type.interface
          entity.name.type.enum entity.name.type.record`),
        settings: { foreground: ty },
      },
      {
        scope: scopes("entity.name.function meta.method-call entity.name.function.java support.function"),
        settings: { foreground: fn },
      },
      {
        scope: scopes(`constant.numeric constant.character constant.other.enum constant.language`),
        settings: { foreground: lit },
      },
      {
        scope: scopes(`
          punctuation punctuation.separator punctuation.terminator punctuation.bracket
          punctuation.section meta.brace keyword.operator punctuation.definition.parameters storage.type.function.arrow`),
        settings: { foreground: punc },
      },
      { scope: scopes("keyword.operator.new keyword.operator.instanceof"), settings: { foreground: kw } },
      { scope: scopes("storage.type.annotation punctuation.definition.annotation meta.declaration.annotation"), settings: { foreground: anno } },
      { scope: scopes("markup.inserted"), settings: { foreground: str } },
      { scope: scopes("markup.deleted"), settings: { foreground: cmt } },
    ],
  };
}

export const darkTheme = theme({
  name: "blackroom",
  type: "dark",
  fg: "#e3ded5",
  bg: "#0e0e0d",
  kw: "#9fb8d0",
  ty: "#d8c4ad",
  fn: "#ebe3d6",
  lit: "#ddb487",
  str: "#b6cc9a",
  cmt: "#948d82",
  punc: "#a49c90",
  anno: "#aca59a",
});

export const lightTheme = theme({
  name: "paper",
  type: "light",
  fg: "#26241f",
  bg: "#fdfcfa",
  kw: "#3b5878",
  ty: "#6a4a39",
  fn: "#3d362e",
  lit: "#87552a",
  str: "#45663a",
  cmt: "#6b665d",
  punc: "#6b665d",
  anno: "#5c5850",
});
