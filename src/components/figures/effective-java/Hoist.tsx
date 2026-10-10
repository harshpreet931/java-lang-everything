"use client";

import { useState } from "react";
import { CodePanel, Narration, Words } from "./kit";

// item 78. why a plain boolean stop flag can loop forever: with no synchronization, the
// JMM lets the JIT read the field once and hoist it out of the loop. volatile (or a lock)
// forbids that: every iteration must see the latest write. hot = the read of `stop`.

const WROTE = `// worker thread
while (!stop) {
    work++;
}`;

const HOISTED = `// what the JIT may run instead
if (!stop) {          // read once
    while (true) {
        work++;       // never looks again
    }
}`;

const VOLATILE = `// with volatile: no hoisting
while (!stop) {       // read every time,
    work++;           // sees main's write
}`;

export function Hoist() {
  const [mode, setMode] = useState<"plain" | "volatile">("plain");
  const plain = mode === "plain";
  return (
    <div className="@container grid gap-4">
      <div className="grid grid-cols-[8ch_minmax(0,1fr)] items-center gap-3 border-b border-line pb-3">
        <span className="text-12 text-faint">stop is</span>
        <Words
          label="how stop is declared"
          value={mode}
          onChange={setMode}
          options={[
            { v: "plain", label: "boolean stop" },
            { v: "volatile", label: "volatile boolean stop" },
          ]}
        />
      </div>
      <div className="grid gap-3 @[620px]:grid-cols-2">
        <CodePanel file="what you wrote" code={WROTE} hot={[2]} />
        <CodePanel
          file={plain ? "what the JIT may legally run" : "what the JIT must run"}
          code={plain ? HOISTED : VOLATILE}
          dead={plain ? [3, 4, 5] : []}
          hot={plain ? [2] : [2]}
          live={plain ? [] : [3]}
        />
      </div>
      <Narration>
        {plain
          ? "main sets stop = true, but nothing says the worker has to see it. the loop never reads the field again, so it can run forever. it often works in tests and hangs in production, after the JIT kicks in."
          : "volatile makes every read see the most recent write from any thread, so the JIT can't hoist it. main's stop = true reaches the worker on the next iteration."}
      </Narration>
    </div>
  );
}
