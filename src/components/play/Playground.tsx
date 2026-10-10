"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRunner } from "@/components/code/useRunner";
import { browserCantRun, browserCaveat } from "@/components/code/browserSupport";
import { examples } from "./examples";

const JavaEditor = dynamic(() => import("@/components/code/JavaEditor").then((m) => m.JavaEditor), {
  ssr: false,
  loading: () => <div className="min-h-[420px] px-5 py-4 font-mono text-12 text-faint">loading the editor…</div>,
});

const SAVE = "jle-play-v1";

// share links carry the program in the url hash, deflate-compressed and base64url-encoded
async function pack(code: string) {
  const stream = new Blob([code]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function unpack(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

export function Playground() {
  const [code, setCode] = useState(examples[0].code);
  const [exampleId, setExampleId] = useState<string | null>(examples[0].id);
  const [shared, setShared] = useState(false);
  const runner = useRunner();
  const loaded = useRef(false);

  // restore: a shared link wins, then your last session, then the first example
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const m = location.hash.match(/^#code=(.+)$/);
    if (m) {
      unpack(m[1])
        .then((c) => {
          setCode(c);
          setExampleId(null);
        })
        .catch(() => {});
      return;
    }
    try {
      const saved = localStorage.getItem(SAVE);
      if (saved) {
        setCode(saved);
        setExampleId(examples.find((e) => e.code === saved)?.id ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE, code);
    } catch {}
  }, [code]);

  useEffect(() => {
    runner.warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const example = examples.find((e) => e.id === exampleId);
  const pristine = !!example && example.code === code;
  const blocked = browserCantRun(code);
  const run = useCallback(() => runner.run(code), [runner, code]);

  const share = async () => {
    const h = await pack(code);
    const url = `${location.origin}/play#code=${h}`;
    history.replaceState(null, "", `#code=${h}`);
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setShared(true);
    setTimeout(() => setShared(false), 1800);
  };

  const { result, running, out, err, status, supported } = runner;
  const stdout = result?.stdout ?? out;
  const stderr = result?.stderr ?? err;
  const diags = result?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const printed = (stdout + stderr).replace(/\s+$/, "");
  const agrees = pristine && result && !result.error ? printed === example!.expected : undefined;

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-center justify-center gap-1" role="tablist" aria-label="examples">
        {examples.map((e) => (
          <button
            key={e.id}
            role="tab"
            aria-selected={exampleId === e.id}
            className="word"
            onClick={() => {
              setCode(e.code);
              setExampleId(e.id);
              runner.clear();
              history.replaceState(null, "", location.pathname);
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* editor */}
        <div className="overflow-hidden rounded-lg bg-well shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex h-11 items-center justify-between gap-3 border-b border-line pr-2 pl-4">
            <span className="font-mono text-12 text-ink">Main.java</span>
            <div className="flex items-center gap-1">
              <button className="word" onClick={share}>
                {shared ? "link copied" : "share"}
              </button>
              {example && !pristine && (
                <button
                  className="word"
                  onClick={() => {
                    setCode(example.code);
                    runner.clear();
                  }}
                >
                  reset
                </button>
              )}
              <button
                className="act solid !min-h-8 !px-3.5"
                onClick={running ? runner.stop : run}
                disabled={!supported || (!running && !!blocked)}
                title="⌘↵"
              >
                {running ? "stop" : "run"} <span className="opacity-60">⌘↵</span>
              </button>
            </div>
          </div>
          <JavaEditor value={code} onChange={setCode} onRun={run} minHeight={440} />
        </div>

        {/* output */}
        <div className="flex min-h-[300px] flex-col overflow-hidden rounded-lg bg-well shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
          <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
            <span className="font-display text-[1.05rem] text-accent italic">
              {running ? (status === "loading" ? "loading the compiler…" : "running…") : "output"}
            </span>
            <span className="font-mono text-11 text-faint tabular">
              {result && !result.error
                ? `compiled ${Math.round(result.compileMs)} ms · ran ${Math.round(result.runMs)} ms`
                : status === "ready"
                  ? "compiler ready"
                  : status === "loading"
                    ? "first load ≈ 4 MB"
                    : ""}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3.5">
            {!supported ? (
              <p className="text-15 text-mute italic">
                this browser can&apos;t run the compiler (it needs WebAssembly GC: chrome 119+, firefox 120+, safari 18.2+).
              </p>
            ) : blocked && !running ? (
              <p className="text-15 text-mute italic">
                this program uses {blocked}, which the browser runtime doesn&apos;t have. run it with{" "}
                <code className="font-mono not-italic text-[0.85em]">java Main.java</code> on a real JDK.
              </p>
            ) : diags.length > 0 ? (
              <ul className="space-y-1.5 font-mono text-13 leading-[1.6]">
                {diags.map((d, i) => (
                  <li key={i} className="text-dead">
                    {d.line > 0 && <span className="text-faint">line {d.line}: </span>}
                    {d.message}
                  </li>
                ))}
              </ul>
            ) : stdout || stderr ? (
              <pre className="font-mono text-13 leading-[1.7] whitespace-pre-wrap text-hi">
                {stdout}
                {stderr && <span className="text-dead">{stderr}</span>}
              </pre>
            ) : (
              <p className="text-15 text-faint italic">{result ? "(no output)" : "press run, or ⌘↵ in the editor."}</p>
            )}
          </div>
          {result && browserCaveat(code) && (
            <p className="border-t border-line px-4 py-2.5 text-14 text-mute italic">{browserCaveat(code)}</p>
          )}
          {result && (result.timedOut || result.deadlocked || result.error || agrees !== undefined) && (
            <div className="border-t border-line px-4 py-2.5 text-14 italic">
              {result.timedOut && <p className="text-hot">stopped after 8 seconds. an infinite loop?</p>}
              {result.deadlocked && <p className="text-dead">every thread is waiting on another. that&apos;s a deadlock.</p>}
              {result.error && <p className="text-dead">{result.error}</p>}
              {agrees === true && <p className="text-live">identical to what jdk 25 prints for this example.</p>}
              {agrees === false && (
                <p className="text-hot">the browser runtime disagrees with real java here. jdk 25 prints: {example!.expected}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
