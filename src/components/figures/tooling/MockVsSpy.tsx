"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { PANEL } from "./kit";

// mockito 5.24.0 on jdk 25, junit 6.1.3. every result below was printed by a real test:
//   List<String> mock = mock(List.class);
//   List<String> spy  = spy(new ArrayList<String>());

type Cell = { code: string; out: string; tone?: "dead" | "live" | "hot" };
type Step = { mock: Cell; spy: Cell; note: string };

const STEPS: Step[] = [
  {
    mock: { code: "mock(List.class)", out: "Mock for List, hashCode: 2033282874" },
    spy: { code: "spy(new ArrayList<>())", out: "[]" },
    note: "a mock is a hollow fake made from the interface: no real code at all. a spy wraps a real object and lets calls through.",
  },
  {
    mock: { code: 'add("a")', out: "false" },
    spy: { code: 'add("a")', out: "true" },
    note: "the mock's add does nothing and returns the default for boolean. the spy really added it.",
  },
  {
    mock: { code: "size()", out: "0" },
    spy: { code: "size()", out: "1" },
    note: "the mock never stored anything. every unstubbed method returns 0, false, null or an empty collection.",
  },
  {
    mock: { code: "get(0)", out: "null" },
    spy: { code: "get(0)", out: '"a"' },
    note: "same story. the spy is still an ArrayList underneath.",
  },
  {
    mock: { code: "isEmpty()", out: "false", tone: "hot" },
    spy: { code: "isEmpty()", out: "false" },
    note: "look at the mock: size() is 0 and isEmpty() is false. defaults don't have to agree with each other. a mock only knows what you tell it.",
  },
  {
    mock: { code: 'when(mock.get(0)).thenReturn("stubbed")', out: 'get(0) → "stubbed"', tone: "live" },
    spy: { code: 'doReturn("stubbed").when(spy).get(0)', out: 'get(0) → "stubbed"', tone: "live" },
    note: "stubbing: now get(0) returns what you said. every other method on the spy is still the real one (size() is still 1).",
  },
  {
    mock: { code: 'when(mock.get(5)).thenReturn("x")', out: "fine: the fake get(5) returns null" },
    spy: { code: 'when(spy.get(5)).thenReturn("x")', out: "IndexOutOfBoundsException", tone: "dead" },
    note: "the spy trap. when(spy.get(5)) calls the REAL get(5) first, on a list with one element. that's why spies are stubbed with doReturn(...).when(spy).",
  },
  {
    mock: { code: 'verify(mock).add("a")', out: "passes", tone: "live" },
    spy: { code: 'verify(spy, times(1)).add("a")', out: "passes", tone: "live" },
    note: "both record every call, so you can check what your code did to them afterwards. that's the other half of mocking: verification.",
  },
];

export function MockVsSpy() {
  const s = useStepper(STEPS.length, { interval: 2200 });
  return (
    <div {...s.keys} className="@container outline-none" aria-label="mock versus spy, one call at a time">
      <div className="grid gap-3 @[560px]:grid-cols-2">
        {(["mock", "spy"] as const).map((k) => (
          <div key={k} className={`min-w-0 p-3 ${PANEL}`}>
            <div className="mb-2 flex items-baseline justify-between text-12">
              <span className="text-hi">{k === "mock" ? "mock(List.class)" : "spy(new ArrayList<>())"}</span>
              <span className="text-11 text-faint">{k === "mock" ? "all fake" : "real, wrapped"}</span>
            </div>
            <ol className="grid gap-1">
              {STEPS.slice(1).map((st, j) => {
                const i = j + 1;
                const c = st[k];
                const shown = i <= s.i;
                const now = i === s.i;
                return (
                  <li
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)] gap-x-3 rounded-sm px-2 py-1 text-12 transition-opacity duration-200 ease-jle @[300px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
                    style={{ opacity: shown ? 1 : 0.25, background: now ? "var(--well-2)" : undefined }}
                  >
                    <span className="truncate text-ink" title={c.code}>
                      {c.code}
                    </span>
                    <span className="truncate" style={{ color: shown && c.tone ? `var(--${c.tone})` : "var(--mute)" }} title={c.out}>
                      {shown ? c.out : "·"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-4 min-h-[3.4em] font-serif text-17 leading-[1.55] text-ink" aria-live="polite">
        {STEPS[s.i].note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
