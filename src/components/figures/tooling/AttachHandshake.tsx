"use client";

import { StepControls, useStepper } from "@/components/viz/stepper";
import { Arrowhead } from "./kit";

// how jcmd/jstack/jmap get into a running HotSpot JVM on linux and macOS (the attach API).
// checked on jdk 25, macOS: while attached, $TMPDIR/.java_pid<pid> exists as a unix socket (srw-------).

const STEPS = [
  { note: "you run jcmd 4242 Thread.print. jcmd and the JVM are two separate processes. nothing is listening yet." },
  { note: "jcmd drops an empty file called .attach_pid4242, then sends the JVM a SIGQUIT (the same signal as kill -3)." },
  { note: "the JVM's signal handler sees the file and knows this isn't a plain kill -3. it starts a new thread: the Attach Listener." },
  { note: "the listener opens a unix domain socket, /tmp/.java_pid4242. only the same OS user can connect to it." },
  { note: "jcmd writes the command into the socket. the JVM runs it inside itself and streams the text back. that's your thread dump." },
];

export function AttachHandshake() {
  const s = useStepper(STEPS.length, { interval: 1800 });
  const i = s.i;
  const on = (n: number) => i >= n;
  const now = (n: number) => i === n;
  const stroke = (n: number) => (now(n) ? "var(--hot)" : on(n) ? "var(--ref)" : "var(--line-2)");

  return (
    <div {...s.keys} className="outline-none" aria-label="how jcmd attaches to a running JVM, step by step">
      <svg viewBox="0 0 560 230" className="block w-full" role="img" aria-label={STEPS[i].note}>
        <defs>
          <Arrowhead id="ah-att-ref" />
          <Arrowhead id="ah-att-hot" color="var(--hot)" />
          <Arrowhead id="ah-att-off" color="var(--line-2)" />
        </defs>

        {/* the terminal */}
        <text fontFamily="var(--font-code)" x={14} y={20} fontSize={11} fill="var(--faint)">
          process 1 · your terminal
        </text>
        <rect x={14} y={30} width={160} height={150} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
        <text fontFamily="var(--font-code)" x={26} y={54} fontSize={12} fill="var(--hi)">
          $ jcmd 4242
        </text>
        <text fontFamily="var(--font-code)" x={26} y={72} fontSize={12} fill="var(--hi)">
          {"  "}Thread.print
        </text>
        {on(4) && (
          <>
            <text fontFamily="var(--font-code)" x={26} y={104} fontSize={11} fill="var(--mute)">
              &quot;main&quot; #3 runnable
            </text>
            <text fontFamily="var(--font-code)" x={26} y={120} fontSize={11} fill="var(--mute)">
              {"  "}at Busy.main(...)
            </text>
            <text fontFamily="var(--font-code)" x={26} y={136} fontSize={11} fill="var(--mute)">
              &quot;Reference Handler&quot;
            </text>
            <text fontFamily="var(--font-code)" x={26} y={152} fontSize={11} fill="var(--faint)">
              ...
            </text>
          </>
        )}

        {/* the JVM */}
        <text fontFamily="var(--font-code)" x={386} y={20} fontSize={11} fill="var(--faint)">
          process 2 · JVM, pid 4242
        </text>
        <rect x={386} y={30} width={160} height={150} rx={2} fill="var(--bg)" stroke="var(--line-2)" />
        {["main", "GC threads", "JIT compilers"].map((t, k) => (
          <g key={t}>
            <rect x={398} y={42 + k * 30} width={136} height={22} rx={2} fill="none" stroke="var(--line)" />
            <text fontFamily="var(--font-code)" x={408} y={57 + k * 30} fontSize={11} fill="var(--mute)">
              {t}
            </text>
          </g>
        ))}
        <g style={{ opacity: on(2) ? 1 : 0, transition: "opacity 250ms cubic-bezier(0.2,0,0,1)" }}>
          <rect x={398} y={134} width={136} height={30} rx={2} fill="none" stroke={now(2) ? "var(--hot)" : "var(--meta)"} />
          <text fontFamily="var(--font-code)" x={408} y={153} fontSize={11} fill={now(2) ? "var(--hot)" : "var(--meta)"}>
            Attach Listener
          </text>
        </g>

        {/* the file + signal */}
        <g style={{ opacity: on(1) ? 1 : 0.25 }}>
          <rect x={214} y={36} width={132} height={24} rx={2} fill="none" stroke={now(1) ? "var(--hot)" : "var(--line-2)"} strokeDasharray="3 3" />
          <text fontFamily="var(--font-code)" x={224} y={52} fontSize={11} fill={now(1) ? "var(--hot)" : "var(--mute)"}>
            .attach_pid4242
          </text>
          <path d="M 176 90 L 382 90" stroke={stroke(1)} strokeWidth={1.25} markerEnd={`url(#ah-att-${now(1) ? "hot" : on(1) ? "ref" : "off"})`} />
          <text fontFamily="var(--font-code)" x={232} y={84} fontSize={11} fill={now(1) ? "var(--hot)" : "var(--faint)"}>
            SIGQUIT
          </text>
        </g>

        {/* the socket */}
        <g style={{ opacity: on(3) ? 1 : 0.25 }}>
          <rect x={196} y={166} width={168} height={24} rx={2} fill="none" stroke={now(3) ? "var(--hot)" : "var(--meta)"} />
          <text fontFamily="var(--font-code)" x={206} y={182} fontSize={11} fill={now(3) ? "var(--hot)" : "var(--meta)"}>
            /tmp/.java_pid4242
          </text>
          <path d="M 396 152 C 380 160, 372 172, 366 176" fill="none" stroke={on(3) ? "var(--meta)" : "var(--line-2)"} strokeWidth={1} />
        </g>

        {/* the conversation */}
        <g style={{ opacity: on(4) ? 1 : 0.15 }}>
          <path
            d="M 177 178 L 193 178"
            stroke={stroke(4)}
            strokeWidth={1.5}
            markerStart={`url(#ah-att-${now(4) ? "hot" : "off"})`}
            markerEnd={`url(#ah-att-${now(4) ? "hot" : "off"})`}
          />
          <text fontFamily="var(--font-code)" x={170} y={214} fontSize={11} fill={now(4) ? "var(--hot)" : "var(--faint)"}>
            &quot;Thread.print&quot; → · ← the dump, as text
          </text>
        </g>
      </svg>
      <p className="mt-4 min-h-[3.4em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {STEPS[i].note}
      </p>
      <StepControls s={s} className="mt-2" />
    </div>
  );
}
