"use client";

import { useState } from "react";
import { CodePanel, Row, Words } from "@/components/figures/basics/kit";

// the same decision written twice: an old switch statement with a missing break, and an
// arrow switch expression. outputs checked on jdk 25: sat/sun give "almost" on the left,
// "weekend" on the right.

const OLD = `switch (day) {
    case "sat":
    case "sun":
        type = "weekend";
    case "fri":
        type = "almost";
        break;
    default:
        type = "weekday";
}`;

const ARROW = `String type = switch (day) {
    case "sat", "sun" -> "weekend";
    case "fri" -> "almost";
    default -> "weekday";
};`;

type Day = "mon" | "fri" | "sat" | "sun";

const PATH: Record<Day, { hot: number[]; dead: number[]; out: string; arm: number; right: string; story: string }> = {
  mon: { hot: [9], dead: [], out: "weekday", arm: 4, right: "weekday", story: "no case matches \"mon\", so it jumps to default, runs one line, and hits the end." },
  fri: { hot: [6, 7], dead: [], out: "almost", arm: 3, right: "almost", story: "jumps to case \"fri\", sets almost, and break leaves the switch. correct, by luck of where the break is." },
  sat: {
    hot: [4],
    dead: [6, 7],
    out: "almost",
    arm: 2,
    right: "weekend",
    story: "jumps to case \"sat\", falls through the empty case \"sun\" (on purpose), sets weekend, then keeps falling into case \"fri\" (not on purpose) and overwrites it with almost.",
  },
  sun: {
    hot: [4],
    dead: [6, 7],
    out: "almost",
    arm: 2,
    right: "weekend",
    story: "same as sat: there's no break after type = \"weekend\", so execution falls straight into the next case's code.",
  },
};

export function SwitchFallthrough() {
  const [day, setDay] = useState<Day>("sat");
  const p = PATH[day];
  const bug = p.out !== p.right;

  return (
    <div className="font-mono text-13">
      <Row k="day =" last>
        <Words
          options={(["mon", "fri", "sat", "sun"] as Day[]).map((d) => ({ v: d, label: `"${d}"` }))}
          value={day}
          onChange={setDay}
          label="value of day"
        />
      </Row>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="min-w-0">
          <CodePanel
            file="old switch statement"
            code={OLD}
            hot={p.hot}
            dead={p.dead}
            right={<span className={`text-11 ${bug ? "text-dead" : "text-faint"}`}>type = &quot;{p.out}&quot;</span>}
          />
        </div>
        <div className="min-w-0">
          <CodePanel
            file="arrow switch expression"
            code={ARROW}
            live={[p.arm]}
            right={<span className="text-11 text-live">type = &quot;{p.right}&quot;</span>}
          />
        </div>
      </div>
      <p className="mt-4 min-h-[3.2em] font-serif text-16 leading-[1.6] text-ink" aria-live="polite">
        {p.story}
        {bug && <span> the arrow version can&apos;t do this: each arm runs alone.</span>}
      </p>
    </div>
  );
}
