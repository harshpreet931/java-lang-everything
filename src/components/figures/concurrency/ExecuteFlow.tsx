// the decision inside ThreadPoolExecutor.execute(), as a ladder.
// each rung is a question; "yes" exits to the right, "no" falls to the next rung.

const RUNGS: { q: string; yes: string; tone: "live" | "mute" | "hot" }[] = [
  { q: "fewer than corePoolSize threads?", yes: "start a new core thread, give it this task", tone: "live" },
  { q: "queue.offer(task) accepted?", yes: "the task waits in the queue", tone: "mute" },
  { q: "fewer than maximumPoolSize threads?", yes: "start an extra thread, give it this task", tone: "hot" },
];

export function ExecuteFlow() {
  return (
    <div className="font-mono text-12" role="img" aria-label="execute: core threads first, then the queue, then extra threads, then rejection">
      <div className="mb-3 inline-flex rounded-md bg-well px-3 py-1.5 text-hi shadow-[inset_0_0_0_1px_var(--ink)]">execute(task)</div>
      {RUNGS.map((r, i) => (
        <div key={r.q} className="relative pl-5">
          <span aria-hidden className="absolute top-0 bottom-0 left-2 w-px bg-line-2" />
          <div className="grid items-center gap-x-3 gap-y-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="rounded-md bg-well px-3 py-2 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
              <span className="mr-2 text-faint tabular">{i + 1}.</span>
              {r.q}
            </div>
            <span className="text-11 text-live">yes →</span>
            <div
              className="rounded-md px-3 py-2"
              style={{
                color: r.tone === "mute" ? "var(--ink)" : `var(--${r.tone})`,
                boxShadow: `inset 0 0 0 1px ${r.tone === "mute" ? "var(--line-2)" : `var(--${r.tone})`}`,
              }}
            >
              {r.yes}
            </div>
          </div>
          <div className="py-0.5 text-11 text-faint">no ↓</div>
        </div>
      ))}
      <div className="relative pl-5">
        <div className="grid items-center gap-x-3 gap-y-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="rounded-md bg-well px-3 py-2 text-ink shadow-[inset_0_0_0_1px_var(--line-2)]">
            <span className="mr-2 text-faint tabular">4.</span>
            the pool is saturated
          </div>
          <span className="text-11 text-dead">→</span>
          <div className="rounded-md px-3 py-2 text-dead shadow-[inset_0_0_0_1px_var(--dead)]">RejectedExecutionHandler.rejectedExecution()</div>
        </div>
      </div>
    </div>
  );
}
