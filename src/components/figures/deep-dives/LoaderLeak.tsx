"use client";

import { useState } from "react";
import { Chip, Words } from "./kit";

// redeploying a webapp in a fresh class loader, with and without one leaked reference. the
// numbers are from Server.java in the chapter (jdk 25.0.4, G1, macOS aarch64): each deploy
// loads 301 classes; metaspace after n deploys was 1.0 MB flat without a leak and
// 1.6, 2.5, 3.2, 3.9, 4.7, 5.4, 6.1, 6.9, 7.6, 8.3 MB with one (all four roots within 0.1 MB).

type Root = "none" | "registry" | "threadlocal" | "thread" | "jdbc";

const ROOTS: Record<Root, { label: string; root: string; path: string; fix: string }> = {
  none: { label: "no leak", root: "", path: "", fix: "undeploy leaves nothing behind: once the loader is closed and unreferenced, the next GC frees its classes, their metadata and their statics, all at once." },
  registry: {
    label: "static registry",
    root: "Server.REGISTRY (a static field)",
    path: "REGISTRY → HashMap → App → App.class → loader",
    fix: "the app put itself into a map owned by the server (or a shared library) and nothing took it out. remove registrations on undeploy, or don't let parent code hold child objects at all.",
  },
  threadlocal: {
    label: "ThreadLocal on a pool thread",
    root: "the server-worker thread (alive = a GC root)",
    path: "Thread → threadLocals → Entry.value → App → App.class → loader",
    fix: "a server thread ran app code that set a ThreadLocal and never removed it. the pool thread outlives every deploy. remove() in a finally, always.",
  },
  thread: {
    label: "a thread the app started",
    root: "the refresher thread the app started",
    path: "Thread → its Runnable (an App lambda) → App.class → loader",
    fix: "the app started a background thread and never stopped it. a running thread is a GC root, and its task's class pins the loader. stop your threads and shut down your executors on undeploy.",
  },
  jdbc: {
    label: "JDBC driver",
    root: "DriverManager's static driver list",
    path: "DriverManager → registeredDrivers → AppDriver → AppDriver.class → loader",
    fix: "the driver jar lived inside the app and registered itself with java.sql.DriverManager, a JDK class that never goes away. call DriverManager.deregisterDriver on undeploy, or put drivers in the server's own classpath.",
  },
};

const META_LEAK = [1.6, 2.5, 3.2, 3.9, 4.7, 5.4, 6.1, 6.9, 7.6, 8.3];

export function LoaderLeak() {
  const [root, setRoot] = useState<Root>("registry");
  const [n, setN] = useState(3);
  const leak = root !== "none";
  const meta = leak ? META_LEAK[n - 1] : 1.0;
  const classes = leak ? 301 * n : 301;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Words options={(Object.keys(ROOTS) as Root[]).map((r) => ({ v: r, label: ROOTS[r].label }))} value={root} onChange={setRoot} label="what leaks" />
      <div className="flex flex-wrap items-center gap-2">
        <button className="act solid" onClick={() => setN((x) => Math.min(10, x + 1))} disabled={n >= 10}>
          redeploy
        </button>
        <button className="act" onClick={() => setN(1)}>
          reset
        </button>
        <span className="text-12 text-faint">deploys so far: {n}</span>
      </div>
      {leak && (
        <div className="flex flex-wrap items-center gap-2 text-12">
          <span className="text-faint">GC root</span>
          <span className="rounded-[4px] px-2 py-0.5 text-ref shadow-[inset_0_0_0_1px_var(--ref)]" style={{ borderStyle: "dashed" }}>
            {ROOTS[root].root}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: n }, (_, i) => {
          const v = i + 1;
          const current = v === n;
          const state = current ? "running" : leak ? "leaked" : "collected";
          const tone = state === "running" ? "live" : state === "leaked" ? "dead" : undefined;
          return (
            <div
              key={v}
              className="obj-in rounded-md bg-bg p-2 text-11 transition-[opacity,box-shadow] duration-200"
              style={{
                boxShadow: `inset 0 0 0 1px ${tone ? `color-mix(in srgb, var(--${tone}) 60%, transparent)` : "var(--line)"}`,
                opacity: state === "collected" ? 0.45 : 1,
                borderStyle: state === "collected" ? "dashed" : undefined,
              }}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-meta">webapp-v{v}</span>
                <span style={{ color: tone ? `var(--${tone})` : "var(--faint)" }}>{state}</span>
              </div>
              <div className={state === "collected" ? "text-faint line-through" : "text-mute"}>301 classes</div>
              <div className={state === "collected" ? "text-faint line-through" : "text-mute"}>CACHE 1.5 MB</div>
              {state === "leaked" && <div className="mt-1 text-[10px] leading-snug text-ref">held via {ROOTS[root].root.split(" (")[0]}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={leak && n > 1 ? "dead" : undefined}>classes loaded by webapps: {classes.toLocaleString("en-US")}</Chip>
        <Chip tone={leak && n > 1 ? "dead" : undefined}>metaspace: {meta.toFixed(1)} MB</Chip>
        <Chip tone={leak && n > 1 ? "dead" : undefined}>old loaders alive: {leak ? n - 1 : 0}</Chip>
      </div>
      {leak && <div className="rounded-md bg-bg px-3 py-2 text-11 text-ink shadow-[inset_0_0_0_1px_var(--line)] [overflow-wrap:anywhere]">{ROOTS[root].path}</div>}
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {ROOTS[root].fix}
      </p>
    </div>
  );
}
