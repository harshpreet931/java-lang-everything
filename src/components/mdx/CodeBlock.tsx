"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ComponentProps } from "react";
import { useRunner } from "@/components/code/useRunner";
import { RunOutput } from "@/components/code/RunOutput";
import { browserCantRun } from "@/components/code/browserSupport";

// codemirror only loads when someone presses "edit"
const JavaEditor = dynamic(() => import("@/components/code/JavaEditor").then((m) => m.JavaEditor), {
  ssr: false,
  loading: () => <div className="min-h-32 px-5 py-4 font-mono text-12 text-faint">loading the editor…</div>,
});

type PreProps = ComponentProps<"pre"> & {
  "data-raw"?: string;
  "data-title"?: string;
  "data-run"?: string;
  "data-output"?: string;
  "data-language"?: string;
  "data-nolines"?: string;
};

const LANG_LABEL: Record<string, string> = {
  java: "java",
  bash: "terminal",
  sh: "terminal",
  shell: "terminal",
  console: "terminal",
  text: "text",
  plaintext: "text",
  txt: "text",
  xml: "xml",
  json: "json",
  kotlin: "kotlin",
  groovy: "groovy",
  properties: "properties",
  yaml: "yaml",
  diff: "diff",
};

/** every fenced code block lands here. file tab, copy, and for `run` blocks: run + edit in the browser. */
export function CodeBlock(props: PreProps) {
  const {
    children,
    className,
    style,
    "data-raw": raw = "",
    "data-title": title,
    "data-run": run,
    "data-output": output,
    "data-language": lang = "text",
    "data-nolines": nolines,
    ...rest
  } = props;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(raw);
  const runner = useRunner();

  const runnable = run !== undefined && lang === "java";
  const blocked = useMemo(() => (runnable ? browserCantRun(code) : null), [runnable, code]);
  const canRun = runnable && runner.supported && !blocked;
  const edited = code !== raw;
  const label = title ?? LANG_LABEL[lang] ?? lang;
  const short = raw.split("\n").length <= 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editing ? code : raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const doRun = () => runner.run(code);

  return (
    <div className="code-frame my-9 overflow-hidden rounded-md bg-well shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-line pr-1.5 pl-4">
        <span className="flex min-w-0 items-baseline gap-3">
          {title ? (
            <span className="truncate font-mono text-12 text-ink">{label}</span>
          ) : (
            <span className="font-display text-[0.95rem] text-accent italic">{label}</span>
          )}
          {edited && <span className="font-display text-[0.9rem] text-hot italic">edited</span>}
        </span>
        <div className="flex items-center gap-1">
          {canRun && (
            <>
              {editing && edited && (
                <button
                  className="word !min-h-7 !px-2"
                  onClick={() => {
                    setCode(raw);
                    runner.clear();
                  }}
                >
                  reset
                </button>
              )}
              <button className="word !min-h-7 !px-2" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
                {editing ? "done" : "edit"}
              </button>
              <button
                className="act solid !min-h-7 !px-2.5 !text-12"
                onClick={runner.running ? runner.stop : doRun}
                onMouseEnter={runner.warm}
                onFocus={runner.warm}
                title="compiles and runs in your browser · ⌘↵ while editing"
              >
                {runner.running ? "stop" : "run"}
              </button>
            </>
          )}
          <button onClick={copy} className="word !min-h-7 !px-2" aria-label="copy code" data-on={copied ? "" : undefined}>
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      {editing ? (
        <JavaEditor value={code} onChange={setCode} onRun={doRun} autoFocus minHeight={Math.min(480, raw.split("\n").length * 23 + 32)} />
      ) : (
        <pre {...rest} className={className} style={{ ...style, background: "transparent" }} data-language={lang}>
          {nolines !== undefined || short ? <NoLines>{children}</NoLines> : children}
        </pre>
      )}

      {runnable && canRun ? (
        <RunOutput r={runner} expected={output} edited={edited} source={code} />
      ) : (
        <>
          {output && (
            <div className="border-t border-line px-4 py-3">
              <div className="mb-1 font-display text-[0.95rem] text-accent italic">output, from jdk 25</div>
              <pre className="overflow-x-auto text-13 leading-[1.7] whitespace-pre text-hi">{output}</pre>
            </div>
          )}
          {runnable && blocked && (
            <p className="border-t border-line px-4 py-2.5 text-14 text-faint italic">
              this one needs a real JVM ({blocked}), so it doesn&apos;t run in the browser. copy it into{" "}
              <code className="font-mono not-italic text-[0.85em]">java Main.java</code> to try it.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** marks the <code> child so line numbers are hidden */
function NoLines({ children }: { children: React.ReactNode }) {
  if (children && typeof children === "object" && "props" in (children as object)) {
    const el = children as React.ReactElement<Record<string, unknown>>;
    return <el.type {...el.props} data-nolines="" />;
  }
  return <>{children}</>;
}
