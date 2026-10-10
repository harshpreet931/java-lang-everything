"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isJavaSupported,
  javaStatus,
  preloadJava,
  runJava,
  subscribeJavaStatus,
  type JavaStatus,
  type RunResult,
} from "@/lib/java";

/** one runnable program's state: status of the shared compiler, live output, the last result. */
export function useRunner() {
  const status = useSyncExternalStore<JavaStatus>(subscribeJavaStatus, javaStatus, () => "idle");
  const [supported, setSupported] = useState(true);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => setSupported(isJavaSupported()), []);

  const run = useCallback(async (source: string | Record<string, string>) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    setResult(null);
    setOut("");
    setErr("");
    try {
      const r = await runJava(source, {
        timeoutMs: 8000,
        signal: ctl.signal,
        onStdout: (c) => setOut((o) => o + c),
        onStderr: (c) => setErr((e) => e + c),
      });
      if (!ctl.signal.aborted) setResult(r);
    } finally {
      if (abort.current === ctl) setRunning(false);
    }
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);
  const warm = useCallback(() => {
    if (isJavaSupported()) void preloadJava().catch(() => {});
  }, []);
  const clear = useCallback(() => {
    setResult(null);
    setOut("");
    setErr("");
  }, []);

  return { status, supported, running, out, err, result, run, stop, warm, clear };
}

export type Runner = ReturnType<typeof useRunner>;
