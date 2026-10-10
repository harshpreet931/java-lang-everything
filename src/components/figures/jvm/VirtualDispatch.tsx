"use client";

import { useState } from "react";
import { StepControls, useStepper } from "@/components/viz/stepper";

// how invokevirtual finds the method: receiver → object header → class → vtable slot → code.
// vtable lengths checked with `jcmd <pid> VM.classes -verbose` on jdk 25:
// java.lang.Object has 5 entries, Animal 6 (adds sound), Dog 6 (overrides sound in place).

type Part = "site" | "local" | "obj" | "klass" | "slot" | "code";

const STEPS: { on: Part[]; note: (dog: boolean) => string }[] = [
  {
    on: ["site"],
    note: () =>
      "javac wrote invokevirtual Animal.sound, by name. the first time it runs, the JVM resolves that name once: sound() lives in vtable slot 5. it caches the number.",
  },
  { on: ["local", "obj"], note: (d) => `pop the receiver: the reference in a. follow it to the object on the heap, a ${d ? "Dog" : "Animal"}.` },
  {
    on: ["obj", "klass"],
    note: (d) => `read the object's header. its class pointer says ${d ? "Dog" : "Animal"}. this is the only runtime fact the call depends on.`,
  },
  {
    on: ["klass", "slot"],
    note: (d) => `load slot 5 of ${d ? "Dog" : "Animal"}'s vtable. ${d ? "Dog overrode sound(), so its slot 5 holds Dog.sound." : "Animal's own slot 5 holds Animal.sound."}`,
  },
  {
    on: ["slot", "code"],
    note: (d) => `jump to ${d ? "Dog" : "Animal"}.sound(). two memory loads and an indirect call. no searching, no string compares.`,
  },
];

export function VirtualDispatch() {
  const [dog, setDog] = useState(true);
  const s = useStepper(STEPS.length, { interval: 2200 });
  const on = new Set(STEPS[s.i].on);
  const cls = dog ? "Dog" : "Animal";

  const box = (p: Part, extra = "") =>
    `rounded-md bg-well px-3 py-2.5 transition-[box-shadow] duration-200 ${extra} ${
      on.has(p) ? "shadow-[inset_0_0_0_1px_var(--hot)]" : "shadow-[inset_0_0_0_1px_var(--line-2)]"
    }`;
  const arrow = <span className="self-center px-1 text-ref @[640px]:rotate-0 rotate-90">→</span>;

  const vtable = (name: "Animal" | "Dog") => {
    const active = name === cls;
    return (
      <div className={`min-w-0 flex-1 transition-opacity duration-200 ${active ? "" : "opacity-35"}`}>
        <div className="mb-1 text-11 text-meta">{name} · vtable</div>
        <div className="grid grid-cols-[3ch_minmax(0,1fr)] gap-x-2 text-12">
          <span className="border-t border-line py-[3px] text-faint tabular">0-4</span>
          <span className="truncate border-t border-line py-[3px] text-mute">Object's five: equals, hashCode, toString...</span>
          <span className={`border-t border-line py-[3px] tabular ${active && on.has("slot") ? "text-hot" : "text-faint"}`}>5</span>
          <span
            className={`truncate border-t border-line py-[3px] ${active && on.has("slot") ? "text-hot" : "text-ink"}`}
          >
            sound <span className="text-ref">●</span> {name}.sound
          </span>
        </div>
      </div>
    );
  };

  return (
    <div {...s.keys} className="@container outline-none">
      <div className="mb-4 flex flex-wrap items-center gap-1 text-13">
        <span className="mr-2 text-12 text-faint">Animal a =</span>
        <button className="word" aria-pressed={!dog} onClick={() => setDog(false)}>
          new Animal()
        </button>
        <button className="word" aria-pressed={dog} onClick={() => setDog(true)}>
          new Dog()
        </button>
      </div>

      <div className="flex flex-col items-stretch gap-1.5 @[640px]:flex-row @[640px]:items-stretch">
        <div className={box("site", "@[640px]:w-[27%]")}>
          <div className="text-11 text-faint">call site</div>
          <div className="mt-1 text-13 text-hi">a.sound();</div>
          <div className="mt-1.5 text-11 leading-[1.5] break-words text-mute">
            invokevirtual <span className="text-ref">#16</span>
            <br />
            Animal.sound:()Ljava/lang/String;
          </div>
          <div className={`mt-1.5 text-11 ${on.has("site") ? "text-hot" : "text-faint"}`}>resolved once → slot 5</div>
        </div>
        {arrow}
        <div className="flex flex-col gap-1.5 @[640px]:w-[19%]">
          <div className={box("local")}>
            <div className="text-11 text-faint">frame · local</div>
            <div className="mt-1 flex items-center justify-between text-13 text-hi">
              a <span className="size-[7px] rounded-full bg-ref" />
            </div>
          </div>
          <div className={box("obj")}>
            <div className="text-11 text-faint">heap · a {cls}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-px bg-line text-11">
              <span className="bg-well px-1.5 py-1 text-meta">mark</span>
              <span className={`flex items-center justify-between bg-well px-1.5 py-1 ${on.has("klass") ? "text-hot" : "text-meta"}`}>
                class <span className="size-[6px] rounded-full bg-ref" />
              </span>
            </div>
          </div>
        </div>
        {arrow}
        <div className={box("klass", "flex flex-col gap-3 @[640px]:flex-1")}>
          <div className="flex flex-col gap-3">
            {vtable("Animal")}
            {vtable("Dog")}
          </div>
        </div>
        {arrow}
        <div className={box("code", "@[640px]:w-[17%]")}>
          <div className="text-11 text-faint">code</div>
          <div className="mt-1 text-13 text-hi">{cls}.sound()</div>
          <div className="mt-1 text-12 text-mute">return {dog ? '"woof"' : '"..."'};</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <p className="min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
          {STEPS[s.i].note(dog)}
        </p>
        <StepControls s={s} />
      </div>
    </div>
  );
}
