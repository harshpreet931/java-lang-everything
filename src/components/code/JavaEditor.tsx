"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { java } from "@codemirror/lang-java";
import { tags as t } from "@lezer/highlight";

// a java editor that looks like the rest of the site: monochrome, tokens only,
// so it follows the theme without re-creating the view.

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.self, t.null, t.bool], color: "var(--code-kw)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--code-ty)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: "var(--code-fn)" },
  { tag: [t.string, t.special(t.string), t.character], color: "var(--code-str)" },
  { tag: [t.number], color: "var(--code-lit)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--code-cmt)", fontStyle: "italic" },
  { tag: [t.punctuation, t.operator, t.bracket, t.separator], color: "var(--code-punc)" },
  { tag: [t.annotation, t.meta], color: "var(--code-punc)" },
  { tag: [t.variableName, t.propertyName], color: "var(--ink)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "transparent", fontSize: "13px", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-code), ui-monospace, monospace", lineHeight: "1.75", overflow: "auto" },
  ".cm-content": { padding: "14px 0", caretColor: "var(--hi)" },
  ".cm-line": { padding: "0 20px 0 14px" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--faint)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 0 0 12px", minWidth: "3ch", opacity: "0.6" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--ink) 4%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-cursor": { borderLeftColor: "var(--hi)", borderLeftWidth: "1.5px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--ref) 28%, transparent) !important",
  },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--hot) 20%, transparent)", outline: "none" },
});

export function JavaEditor({
  value,
  onChange,
  onRun,
  autoFocus,
  className,
  minHeight = 120,
}: {
  value: string;
  onChange: (v: string) => void;
  /** ⌘↵ / ctrl+↵ */
  onRun?: () => void;
  autoFocus?: boolean;
  className?: string;
  minHeight?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onRun });
  cb.current = { onChange, onRun };

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          java(),
          syntaxHighlighting(highlight),
          theme,
          keymap.of([
            { key: "Mod-Enter", run: () => (cb.current.onRun?.(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.onChange(u.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ "aria-label": "java code editor", spellcheck: "false" }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => v.destroy();
    // the editor owns its state after mount; external value changes go through the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // replace the doc when the parent swaps in a different program (examples, reset)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className={`cm-host ${className ?? ""}`} style={{ minHeight }} />;
}
