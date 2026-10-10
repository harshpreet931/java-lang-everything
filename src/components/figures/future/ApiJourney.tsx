"use client";

import { useState } from "react";
import { CodePanel } from "@/components/figures/deep-dives/kit";

// the same handle() through the structured concurrency previews. 21 to 24 is JEP 453's
// example (re-previewed unchanged by JEPs 462, 480 and 499), 25 and 26 follow JEP 505 (and
// 525), 27 and 28 are JEP 533's shape, which JEP 543 proposes to finalize unchanged. the
// 25 form compiles on jdk 25 with --enable-preview; the others are shown as their JEPs show them.

type Era = { id: string; label: string; jeps: string; code: string; hot: number[]; note: string };

const ERAS: Era[] = [
  {
    id: "21",
    label: "jdk 21 to 24",
    jeps: "JEPs 453, 462, 480, 499 · preview",
    code: `Response handle() throws ExecutionException, InterruptedException {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Supplier<String>  user  = scope.fork(() -> findUser());
        Supplier<Integer> order = scope.fork(() -> fetchOrder());
        scope.join().throwIfFailed();
        return new Response(user.get(), order.get());
    }
}`,
    hot: [2, 5],
    note: "the policy was a subclass: ShutdownOnFailure or ShutdownOnSuccess, picked with new. join() waited, and throwIfFailed() rethrew the first failure wrapped in an ExecutionException. four releases, no API changes.",
  },
  {
    id: "25",
    label: "jdk 25 and 26",
    jeps: "JEPs 505, 525 · preview",
    code: `Response handle() throws InterruptedException {
    try (var scope = StructuredTaskScope.open()) {
        Subtask<String>  user  = scope.fork(() -> findUser());
        Subtask<Integer> order = scope.fork(() -> fetchOrder());
        scope.join();          // a failure throws FailedException (unchecked)
        return new Response(user.get(), order.get());
    }
}`,
    hot: [2, 5],
    note: "no more subclasses: open() makes a scope, and the policy is a Joiner you can pass to open(joiner). with the default policy, join() itself throws on failure, as an unchecked StructuredTaskScope.FailedException. code from 24 doesn't compile here. 26 made small changes: one joiner renamed, joiners that handle timeouts, allSuccessfulOrThrow() returning a list.",
  },
  {
    id: "27",
    label: "jdk 27, and 28 if final",
    jeps: "JEP 533 · preview, JEP 543 · proposed final",
    code: `Response handle() throws ExecutionException, InterruptedException {
    try (var scope = StructuredTaskScope.open()) {
        Subtask<String>  user  = scope.fork(() -> findUser());
        Subtask<Integer> order = scope.fork(() -> fetchOrder());
        scope.join();          // a failure throws ExecutionException (checked)
        return new Response(user.get(), order.get());
    }
}`,
    hot: [1, 5],
    note: "the joiner now has a type parameter for the exception join() throws, and the default throws the checked ExecutionException, like Future.get(). that's the shape JEP 543 proposes to make final in jdk 28, without further change.",
  },
];

export function ApiJourney() {
  const [id, setId] = useState("25");
  const e = ERAS.find((x) => x.id === id)!;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="which release">
        {ERAS.map((x) => (
          <button key={x.id} className="word" aria-pressed={x.id === id} onClick={() => setId(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <CodePanel code={e.code} hot={e.hot} file={<>Handler.java <span className="text-faint">· {e.jeps}</span></>} />
      <p className="font-serif text-[16px] leading-[1.6] text-ink" aria-live="polite">
        {e.note}
      </p>
    </div>
  );
}
