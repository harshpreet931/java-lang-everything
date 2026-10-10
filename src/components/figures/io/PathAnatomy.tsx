"use client";

import { useState, type ReactNode } from "react";
import { Java, Row, Words, ring, tint, type Tone, NARR } from "./kit";

// a Path, taken apart. every result below is what jdk 25 printed on a unix filesystem
// (separator "/"). Path is pure string surgery here: none of these paths exist on disk.

type Op = "anatomy" | "normalize" | "resolve" | "relativize" | "absolute";

const P = ["home", "ada", "projects", "..", "notes", ".", "todo.txt"];

// "dim" = dropped / shared and not part of the answer, "mark" = selected, no meaning attached
type SegTone = Tone | "dim" | "mark";

function Seg({ s, tone, sub, strike }: { s: string; tone?: SegTone; sub?: ReactNode; strike?: boolean }) {
  const semantic = tone && tone !== "dim" && tone !== "mark" ? tone : undefined;
  return (
    <span className="inline-flex flex-col items-center">
      <span
        className="inline-flex h-8 items-center rounded-[1px] px-2 text-13 transition-[box-shadow,background-color,color,opacity] duration-200"
        style={{
          color: semantic ? `var(--${semantic})` : tone === "dim" ? "var(--mute)" : "var(--hi)",
          boxShadow: semantic ? ring(semantic, 70) : tone === "mark" ? ring("hi") : ring("line-2"),
          background: semantic ? tint(semantic, 10) : undefined,
          textDecoration: strike ? "line-through" : undefined,
          opacity: tone === "dim" ? 0.5 : 1,
        }}
      >
        {s}
      </span>
      <span className="mt-1 h-3 text-[10px] leading-3 text-faint tabular">{sub}</span>
    </span>
  );
}

function PathRow({ root, names, tones = {}, strike = [], idx, label }: {
  root?: boolean;
  names: string[];
  tones?: Record<number, SegTone>;
  strike?: number[];
  idx?: boolean;
  label?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      {label && <div className="mb-1.5 text-11 text-faint">{label}</div>}
      <div className="flex flex-wrap items-start gap-x-1 gap-y-1">
        {root && <Seg s="/" tone={tones[-1] ?? "meta"} sub="root" />}
        {names.map((n, i) => (
          <span key={i} className="inline-flex items-start gap-1">
            {i > 0 && <span className="pt-1.5 text-faint">/</span>}
            <Seg s={n} tone={tones[i]} sub={idx ? i : undefined} strike={strike.includes(i)} />
          </span>
        ))}
      </div>
    </div>
  );
}

const OPS: Record<Op, { code: string; body: ReactNode; note: ReactNode }> = {
  anatomy: {
    code: 'Path p = Path.of("/home/ada/projects/../notes/./todo.txt");',
    body: (
      <div className="grid gap-4">
        <PathRow root names={P} idx tones={{ 6: "hot", 1: "mark", 2: "mark" }} />
        <div className="grid gap-1 text-12 sm:grid-cols-2">
          <span><span className="text-faint">getRoot() →</span> <span style={{ color: "var(--meta)" }}>/</span></span>
          <span><span className="text-faint">getFileName() →</span> <span className="text-hot">todo.txt</span></span>
          <span><span className="text-faint">getNameCount() →</span> <span className="text-hi">7</span></span>
          <span><span className="text-faint">subpath(1, 3) →</span> <span className="text-hi underline decoration-line-2 underline-offset-4">ada/projects</span> <span className="text-faint">(outlined)</span></span>
          <span className="sm:col-span-2"><span className="text-faint">getParent() →</span> <span className="text-hi">/home/ada/projects/../notes/.</span></span>
        </div>
      </div>
    ),
    note: (
      <>
        a path is a <span style={{ color: "var(--meta)" }}>root</span> plus a list of name elements, indexed from 0. the root isn&apos;t a name, which is why
        the count is 7. getParent() just drops the last name: it doesn&apos;t clean up <code>..</code>, and it doesn&apos;t look at the disk.
      </>
    ),
  },
  normalize: {
    code: "p.normalize()",
    body: (
      <div className="grid gap-4">
        <PathRow root names={P} tones={{ 2: "dead", 3: "dead", 5: "dead" }} strike={[2, 3, 5]} label="before" />
        <PathRow root names={["home", "ada", "notes", "todo.txt"]} tones={{ 0: "live", 1: "live", 2: "live", 3: "live" }} label="after" />
      </div>
    ),
    note: (
      <>
        <code>.</code> means &quot;here&quot; and just goes. <code>..</code> cancels the name before it, so <code>projects/..</code> vanishes as a pair. purely
        textual: if <code>projects</code> were a symlink, the real <code>..</code> might land somewhere else. <code>toRealPath()</code> asks the disk instead.
      </>
    ),
  },
  resolve: {
    code: 'Path.of("/home/ada").resolve("notes/todo.txt")',
    body: (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <PathRow root names={["home", "ada"]} label="base" />
          <span className="pb-5 text-faint">+</span>
          <PathRow names={["notes", "todo.txt"]} tones={{ 0: "hot", 1: "hot" }} label="relative other" />
        </div>
        <PathRow root names={["home", "ada", "notes", "todo.txt"]} tones={{ 2: "hot", 3: "hot" }} label="→ result" />
        <div className="border-t border-line pt-3 text-12">
          <Java code={'Path.of("/home/ada").resolve("/etc/hosts")'} /> <span className="text-faint">→</span> <span className="text-hot">/etc/hosts</span>
        </div>
      </div>
    ),
    note: (
      <>
        resolve is &quot;cd into it&quot;: glue the other path on the end. but if the other path is absolute, the base is thrown away and you just get
        the other one. that&apos;s how user input like <code>/etc/passwd</code> escapes the folder you meant to keep it in.
      </>
    ),
  },
  relativize: {
    code: 'Path.of("/home/ada/notes").relativize(Path.of("/home/ada/projects/app"))',
    body: (
      <div className="grid gap-4">
        <PathRow root names={["home", "ada", "notes"]} tones={{ [-1]: "dim", 0: "dim", 1: "dim", 2: "hot" }} label="from" />
        <PathRow root names={["home", "ada", "projects", "app"]} tones={{ [-1]: "dim", 0: "dim", 1: "dim", 2: "live", 3: "live" }} label="to" />
        <PathRow names={["..", "projects", "app"]} tones={{ 0: "hot", 1: "live", 2: "live" }} label="→ result" />
      </div>
    ),
    note: (
      <>
        the opposite of resolve: how do i walk from here to there? drop the shared prefix (faded), climb out of what&apos;s left
        of <em>from</em> with <span className="text-hot">..</span>, then walk down into the rest of <em>to</em>. both paths must be the same kind
        (both absolute or both relative).
      </>
    ),
  },
  absolute: {
    code: 'Path.of("notes/todo.txt").toAbsolutePath()',
    body: (
      <div className="grid gap-4">
        <PathRow names={["notes", "todo.txt"]} label='relative: isAbsolute() → false' />
        <PathRow root names={["Users", "ada", "app", "notes", "todo.txt"]} tones={{ 0: "hot", 1: "hot", 2: "hot" }} label="→ resolved against user.dir" />
      </div>
    ),
    note: (
      <>
        a relative path means nothing until it&apos;s resolved against something. <code>toAbsolutePath()</code> uses the{" "}
        <span className="text-hot">working directory</span> (the <code>user.dir</code> property: wherever you launched java from), not where your
        class or jar lives. run the same program from a different folder and it reads a different file.
      </>
    ),
  },
};

export function PathAnatomy() {
  const [op, setOp] = useState<Op>("anatomy");
  const o = OPS[op];
  return (
    <div className="text-13">
      <Row k="op =" w="5ch" last>
        <Words label="path operation" options={["anatomy", "normalize", "resolve", "relativize", "absolute"] as Op[]} value={op} onChange={setOp} />
      </Row>
      <div className="mt-3 overflow-x-auto rounded-md bg-well px-4 py-2.5 text-12 whitespace-nowrap shadow-[inset_0_0_0_1px_var(--line)]">
        <Java code={o.code} />
      </div>
      <div className="mt-5 min-h-[180px]">{o.body}</div>
      <p className={`mt-4 border-t border-line pt-3 ${NARR}`} aria-live="polite">
        {o.note}
      </p>
    </div>
  );
}
