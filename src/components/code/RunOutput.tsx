"use client";

import type { Runner } from "./useRunner";
import { browserCaveat } from "./browserSupport";

const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");

/** what a run printed, how long it took, and whether it matched the expected output. */
export function RunOutput({
  r,
  expected,
  compact,
  edited,
  source,
}: {
  r: Runner;
  expected?: string;
  compact?: boolean;
  edited?: boolean;
  source?: string;
}) {
  const { result, running, out, err, status } = r;
  const nothingYet = !running && !result;

  if (nothingYet) {
    if (!expected) return null;
    return (
      <div className="border-t border-line px-4 py-3">
        <div className="mb-1 font-display text-[0.95rem] text-accent italic">output</div>
        <pre className="overflow-x-auto text-13 leading-[1.7] whitespace-pre text-hi">{expected}</pre>
      </div>
    );
  }

  const stdout = result?.stdout ?? out;
  const stderr = result?.stderr ?? err;
  const diags = result?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const matches = expected !== undefined && result?.ok ? norm(stdout) === norm(expected) : undefined;

  return (
    <div className={`border-t border-line px-4 py-3 ${compact ? "" : "min-h-[5.5rem]"}`} aria-live="polite">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-display text-[0.95rem] text-accent italic">
          {running ? (status === "loading" ? "loading the compiler…" : "running…") : "output"}
        </span>
        {result && (
          <span className="font-mono text-11 text-faint tabular">
            {result.error
              ? "the runtime failed"
              : `compiled in ${Math.round(result.compileMs)} ms · ran in ${Math.round(result.runMs)} ms`}
          </span>
        )}
      </div>
      {diags.length > 0 ? (
        <ul className="space-y-1 font-mono text-13 leading-[1.6]">
          {diags.map((d, i) => (
            <li key={i} className="text-dead">
              {d.line > 0 && <span className="text-faint">line {d.line}: </span>}
              {d.message}
            </li>
          ))}
        </ul>
      ) : (
        <pre className="max-h-[22rem] overflow-auto text-13 leading-[1.7] whitespace-pre-wrap text-hi">
          {stdout}
          {stderr && <span className="text-dead">{stderr}</span>}
          {!stdout && !stderr && !running && <span className="text-faint">(no output)</span>}
        </pre>
      )}
      {result && (
        <div className="mt-2 flex flex-wrap gap-x-4 text-14 italic">
          {result.timedOut && <span className="text-hot">stopped after 8 seconds. infinite loop?</span>}
          {result.deadlocked && <span className="text-dead">main never returned: every thread is waiting. a deadlock.</span>}
          {result.truncated && <span className="text-hot">output was cut off.</span>}
          {result.error && <span className="text-dead">{result.error}</span>}
          {matches === true && <span className="text-live">same as real java prints.</span>}
          {matches === false && edited && <span className="text-mute">different from the original output, since you changed the code.</span>}
        </div>
      )}
      {result && source && browserCaveat(source) && (
        <p className="mt-2 text-14 text-mute italic">{browserCaveat(source)}</p>
      )}
      {matches === false && !edited && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-14 text-mute italic">
            the browser runtime (javac + TeaVM, not a real JVM) disagrees with real java here. jdk 25 prints:
          </p>
          <pre className="mt-1.5 overflow-x-auto text-13 leading-[1.7] whitespace-pre text-hi">{expected}</pre>
        </div>
      )}
    </div>
  );
}
