"use client";

import { useState } from "react";
import { Java, Row, Words } from "@/components/figures/basics/kit";

// how a text block decides which leading spaces are yours. the common indentation of the
// content lines (and of the closing """ line, if it's on its own) is "incidental" and gets
// stripped. lengths checked with String.length() on jdk 25: 26, 38 and 25.

type Where = "under" | "left" | "glued";

const CONTENT = ["        <ul>", "          <li>tea</li>", "        </ul>"];

const VARIANTS: Record<Where, { closing: string | null; strip: number; len: number; note: string }> = {
  under: { closing: '        """;', strip: 8, len: 26, note: "the closing quotes line up with the content, so all 8 leading spaces are incidental. the string starts at <ul>, and ends with a newline." },
  left: { closing: '    """;', strip: 4, len: 38, note: "the closing quotes sit 4 spaces in. that line counts too, so only 4 spaces are incidental and the other 4 stay in every line." },
  glued: { closing: null, strip: 8, len: 25, note: "the quotes close right after </ul>, so there's no last newline. the indentation is still decided by the content lines." },
};

export function TextBlockWhitespace() {
  const [where, setWhere] = useState<Where>("under");
  const v = VARIANTS[where];

  const lines = v.closing === null ? [...CONTENT.slice(0, -1), CONTENT[2] + '""";'] : [...CONTENT, v.closing];
  const result = CONTENT.map((l) => l.slice(v.strip));
  const shownResult = result.map((l, i) => l + (i < result.length - 1 || v.closing !== null ? "\n" : ""));

  const lead = (l: string) => l.length - l.trimStart().length;

  return (
    <div className="font-mono text-13">
      <Row k={'closing """ ='} w="15ch" last>
        <Words
          options={[
            { v: "under", label: "under the text" },
            { v: "left", label: "further left" },
            { v: "glued", label: "after </ul>" },
          ]}
          value={where}
          onChange={setWhere}
          label="where the closing quotes go"
        />
      </Row>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1.5 text-11 text-faint">in the source</div>
          <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]">
            <div>
              <Java code="void main() {" />
            </div>
            <div>
              <Java code={'    String html = """'} />
            </div>
            {lines.map((l, i) => {
              const n = lead(l);
              const inc = Math.min(n, v.strip);
              const isClosing = i === lines.length - 1 && v.closing !== null;
              return (
                <div key={`${where}-${i}`} className="whitespace-pre">
                  <span className="rounded-[2px]" style={{ background: "color-mix(in srgb, var(--faint) 22%, transparent)" }}>
                    {" ".repeat(inc)}
                  </span>
                  <span className="text-hot">{"·".repeat(Math.max(0, n - inc))}</span>
                  {isClosing ? <Java code={l.trimStart()} /> : l.trimStart().endsWith('""";') ? (
                    <>
                      <span className="text-ink">{l.trimStart().slice(0, -4)}</span>
                      <Java code={'""";'} />
                    </>
                  ) : (
                    <span className="text-ink">{l.trimStart()}</span>
                  )}
                </div>
              );
            })}
            <div>
              <Java code="}" />
            </div>
          </pre>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-faint">
            <span>
              <span className="mr-1.5 inline-block h-2.5 w-4 rounded-[2px] align-middle" style={{ background: "color-mix(in srgb, var(--faint) 22%, transparent)" }} />
              incidental: stripped
            </span>
            <span>
              <span className="text-hot">··</span> kept
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex justify-between text-11 text-faint">
            <span>the String you get</span>
            <span className="tabular">length() = {v.len}</span>
          </div>
          <pre className="overflow-x-auto rounded-md bg-well px-4 py-3 text-12 leading-[1.8] shadow-[inset_0_0_0_1px_var(--line)]">
            {shownResult.map((l, i) => {
              const n = lead(l);
              const text = l.replace(/\n$/, "");
              return (
                <div key={`${where}-r${i}`} className="whitespace-pre">
                  <span className="text-hot">{"·".repeat(n)}</span>
                  <span className="text-hi">{text.trimStart()}</span>
                  {l.endsWith("\n") && <span className="text-faint">⏎</span>}
                </div>
              );
            })}
          </pre>
        </div>
      </div>
      <p className="mt-4 font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {v.note}
      </p>
    </div>
  );
}
