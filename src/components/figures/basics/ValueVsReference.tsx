"use client";

import { useState } from "react";
import { Row, Words } from "@/components/figures/basics/kit";

// what java actually does (copy the value in the slot) next to what "pass by reference" would
// mean (the parameter is just another name for the caller's variable). the "by reference" side is
// hypothetical: java has no way to do it. it's here so the difference has a picture.

type Mode = "value" | "reference";
type Case = "swap" | "replace";

function Slot({ name, value, tone, alias }: { name: string; value: React.ReactNode; tone?: "hot" | "dead"; alias?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-[3px] text-12 first:border-t-0">
      <span className="text-mute">
        {name}
        {alias && <span className="text-faint"> {alias}</span>}
      </span>
      <span className="tabular" style={{ color: tone ? `var(--${tone})` : "var(--hi)" }}>
        {value}
      </span>
    </div>
  );
}

function FrameBox({ title, children, dim }: { title: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`rounded-md bg-well px-3 py-2 shadow-[inset_0_0_0_1px_var(--line-2)] ${dim ? "opacity-60" : ""}`}>
      <div className="mb-1 text-12 text-hi">{title}</div>
      {children}
    </div>
  );
}

const Arrow = ({ to, tone = "ref" }: { to: string; tone?: "ref" | "dead" }) => (
  <span style={{ color: `var(--${tone})` }}>→ {to}</span>
);

export function ValueVsReference() {
  const [mode, setMode] = useState<Mode>("value");
  const [c, setC] = useState<Case>("swap");
  const byVal = mode === "value";

  return (
    <div className="font-mono text-13">
      <Row k="if java passed by =" w="20ch">
        <Words
          options={[
            { v: "value", label: "value (it does)" },
            { v: "reference", label: "reference (it doesn't)" },
          ]}
          value={mode}
          onChange={setMode}
          label="passing mode"
        />
      </Row>
      <Row k="call =" w="20ch" last>
        <Words
          options={[
            { v: "swap", label: "swap(x, y)" },
            { v: "replace", label: "replace(box)" },
          ]}
          value={c}
          onChange={setC}
          label="which call"
        />
      </Row>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2.5">
          <div className="text-11 text-faint">inside the call, after its last line</div>
          {c === "swap" ? (
            <>
              <FrameBox title="swap(a, b)">
                {byVal ? (
                  <>
                    <Slot name="a" value={2} tone="hot" />
                    <Slot name="b" value={1} tone="hot" />
                  </>
                ) : (
                  <>
                    <Slot name="a" alias="(= main's x)" value={2} tone="hot" />
                    <Slot name="b" alias="(= main's y)" value={1} tone="hot" />
                  </>
                )}
              </FrameBox>
              <FrameBox title="main" dim>
                <Slot name="x" value={byVal ? 1 : 2} tone={byVal ? undefined : "hot"} />
                <Slot name="y" value={byVal ? 2 : 1} tone={byVal ? undefined : "hot"} />
              </FrameBox>
            </>
          ) : (
            <>
              <FrameBox title="replace(b)">
                <Slot name="b" alias={byVal ? undefined : "(= main's box)"} value={<Arrow to="Box(-1)" />} />
              </FrameBox>
              <FrameBox title="main" dim>
                <Slot name="box" value={<Arrow to={byVal ? "Box(99)" : "Box(-1)"} />} />
              </FrameBox>
              <div className="flex flex-wrap gap-2 text-12">
                <span className="rounded-md px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line-2)]">
                  Box <span className="text-hi">99</span>
                  {!byVal && <span className="text-dead"> unreachable</span>}
                </span>
                <span className="rounded-md px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line-2)]">
                  Box <span className="text-hi">-1</span>
                  {byVal && <span className="text-dead"> garbage after return</span>}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="grid content-start gap-2">
          <div className="text-11 text-faint">what main sees afterwards</div>
          <div className="rounded-md bg-well px-4 py-2.5 text-14 shadow-[inset_0_0_0_1px_var(--line)]">
            {c === "swap" ? (
              <span className={byVal ? "text-hi" : "text-mute"}>x = {byVal ? 1 : 2}, y = {byVal ? 2 : 1}</span>
            ) : (
              <span className={byVal ? "text-hi" : "text-mute"}>box.value = {byVal ? 99 : -1}</span>
            )}
          </div>
          <p className="font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
            {byVal
              ? c === "swap"
                ? "a and b are separate slots holding copies. swapping them is real, but it happens to the copies, and they're thrown away when swap returns."
                : "b is a separate slot holding a copy of the arrow. pointing it somewhere new moves only that copy. main's box still points at the Box that fill changed to 99."
              : c === "swap"
                ? "with pass by reference (C++'s int&, C#'s ref), a would be another name for x itself, so the swap would reach main. java has nothing like it."
                : "by reference, b would be another name for main's box, so re-pointing b would re-point box too. java can't do that: you'd return the new Box instead."}
          </p>
        </div>
      </div>
    </div>
  );
}
