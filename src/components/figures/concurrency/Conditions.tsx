// one monitor has one wait set. one Lock can have as many Conditions as you like,
// each with its own queue, so a signal goes to the right kind of waiter.

function Waiter({ name }: { name: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-xs px-2 text-12 text-mute" style={{ border: "1px dashed var(--line-2)" }}>
      {name}
    </span>
  );
}

function Queue({ title, sub, names }: { title: string; sub: string; names: string[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-11">
        <span className="text-ink">{title}</span>
        <span className="text-faint">{sub}</span>
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5" style={{ border: "1px dashed var(--line-2)" }}>
        {names.map((n) => (
          <Waiter key={n} name={n} />
        ))}
      </div>
    </div>
  );
}

export function Conditions() {
  return (
    <div
      className="grid gap-6 font-mono sm:grid-cols-2"
      role="img"
      aria-label="a monitor has one wait set holding producers and consumers together; a lock can have separate notFull and notEmpty condition queues"
    >
      <div className="min-w-0">
        <div className="mb-2 text-12 text-hi">synchronized + wait/notify</div>
        <div className="rounded-md bg-well p-3" style={{ boxShadow: "inset 0 0 0 1px var(--meta)" }}>
          <div className="mb-2 text-11 text-meta">monitor of buffer</div>
          <Queue title="the wait set" sub="everyone, mixed" names={["P1", "C1", "P2", "C2"]} />
        </div>
        <p className="mt-3 font-serif text-16 leading-[1.55] text-mute">
          <code className="text-ink">notify()</code> picks someone from the mix. it might wake a producer when only a consumer can make progress.
        </p>
      </div>
      <div className="min-w-0">
        <div className="mb-2 text-12 text-hi">ReentrantLock + two Conditions</div>
        <div className="grid gap-2.5 rounded-md bg-well p-3" style={{ boxShadow: "inset 0 0 0 1px var(--meta)" }}>
          <div className="text-11 text-meta">lock</div>
          <Queue title="notFull" sub="producers wait here" names={["P1", "P2"]} />
          <Queue title="notEmpty" sub="consumers wait here" names={["C1", "C2"]} />
        </div>
        <p className="mt-3 font-serif text-16 leading-[1.55] text-mute">
          after a put, <code className="text-ink">notEmpty.signal()</code> wakes exactly one consumer. never the wrong kind.
        </p>
      </div>
    </div>
  );
}
