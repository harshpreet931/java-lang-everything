"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ComponentProps } from "react";
import { useRunner } from "@/components/code/useRunner";
import { RunOutput } from "@/components/code/RunOutput";
import { browserCantRun } from "@/components/code/browserSupport";

// codemirror only loads when someone presses "edit"
const JavaEditor = dynamic(() => import("@/components/code/JavaEditor").then((m) => m.JavaEditor), {
  ssr: false,
  loading: () => <div className="min-h-32 px-5 py-4 font-ui text-13 text-faint">loading the editor…</div>,
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
    <div
      className={`code-frame relative my-9 overflow-hidden rounded-[10px] bg-well shadow-[var(--surface)] ${runner.running ? "running" : ""}`}
    >
      <div className="flex min-h-[46px] items-center justify-between gap-3 border-b border-line py-1 pr-2 pl-4">
        <span className="flex min-w-0 items-center gap-2.5">
          {title ? (
            <span className="truncate font-mono text-13 font-medium text-hi">{label}</span>
          ) : (
            <span className="font-ui text-12 text-mute">{label}</span>
          )}
          {edited && <span className="font-ui text-12 font-medium text-hot">edited</span>}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {canRun && (
            <>
              {editing && edited && (
                <button
                  className="act max-sm:!px-2.5"
                  onClick={() => {
                    setCode(raw);
                    runner.clear();
                  }}
                >
                  reset
                </button>
              )}
              <button className="act max-sm:!px-2.5" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
                {editing ? "done" : "edit"}
              </button>
              <button
                className="act solid run !rounded-full !px-4"
                onClick={runner.running ? runner.stop : doRun}
                onMouseEnter={runner.warm}
                onFocus={runner.warm}
                title="compiles and runs in your browser · ⌘↵ while editing"
              >
                {runner.running ? "stop" : "run"}
              </button>
            </>
          )}
          <CopyButton copied={copied} onClick={copy} />
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
            <div className="border-t border-line px-4 pt-3 pb-4">
              <div className="mb-1.5 font-ui text-[0.78125rem] text-mute">output, from jdk 25</div>
              <pre className="overflow-x-auto text-[0.84375rem] leading-[1.65] whitespace-pre text-hi tabular">{output}</pre>
            </div>
          )}
          {runnable && blocked && (
            <p className="border-t border-line px-4 py-3 text-[0.9375rem] text-mute italic">
              this one needs a real JVM ({blocked}), so it doesn&apos;t run in the browser. copy it into{" "}
              <code className="font-mono not-italic text-[0.85em]">java Main.java</code> to try it.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** copy, as a 40px icon button. the label swaps to "copied" for a moment. */
function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid size-10 place-items-center rounded-md text-mute transition-colors duration-150 hover:bg-well-2 hover:text-hi"
      aria-label={copied ? "copied" : "copy code"}
      title={copied ? "copied" : "copy"}
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
        </svg>
      )}
    </button>
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
