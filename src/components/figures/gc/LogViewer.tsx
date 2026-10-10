"use client";

import { useState, type ReactNode } from "react";
import { Row, Words } from "./kit";

// real -Xlog:gc* output of the toy service (content/gc/serial-and-parallel.mdx), jdk 25.0.4,
// macOS aarch64, 14 cores, -Xmx256m. the same runs as data/pauses.ts. every token you can
// hover is one field, with what it means underneath. "···" marks lines trimmed out.

type Note = { label: string; text: ReactNode; when?: "stopped" | "running" };

const common: Record<string, Note> = {
  up: {
    label: "[0.048s] · uptime",
    text: (
      <>
        seconds since the JVM started. it's the default decorator. add <code>time</code> (wall clock) to the decorators when you need to line a
        GC up with a latency spike in your metrics.
      </>
    ),
  },
  lv: { label: "[info] · level", text: <>the log level. <code>info</code> is the production setting. <code>debug</code> and <code>trace</code> are for digging into one subsystem.</> },
  tg: {
    label: "[gc,heap] · tags",
    text: (
      <>
        the tag set the line was logged under. <code>-Xlog:gc</code> selects lines tagged exactly <code>gc</code>: the one-line summaries.{" "}
        <code>-Xlog:gc*</code> selects every tag set that includes <code>gc</code>, which is all the detail lines too.
      </>
    ),
  },
  id: {
    label: "GC(0) · the collection's number",
    text: <>every line of one collection carries the same number, so <code>grep 'GC(42)'</code> pulls one event out of a huge log. it counts from 0 for the life of the JVM.</>,
  },
};

type Sample = { label: string; lines: string[]; notes: Record<string, Note>; first: string };

const g1Young: Sample = {
  label: "G1 young",
  first: "hp",
  lines: [
    "{up:[0.043s]}{lv:[info]}{tg:[gc,start    ]} {id:GC(0)} {py:Pause Young} {nm:(Normal)} {cz:(G1 Evacuation Pause)}",
    "{up:[0.043s]}{lv:[info]}{tg:[gc,task     ]} {id:GC(0)} {wk:Using 6 workers of 11} for evacuation",
    "{up:[0.047s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(0)}   {ph:Pre Evacuate Collection Set: 0.09ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(0)}   {mr:Merge Heap Roots: 0.04ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(0)}   {ev:Evacuate Collection Set: 3.88ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(0)}   {ph:Post Evacuate Collection Set: 0.14ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(0)}   {ph:Other: 0.24ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,heap     ]} {id:GC(0)} {ed:Eden regions: 47->0(76)}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,heap     ]} {id:GC(0)} {sv:Survivor regions: 0->6(6)}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,heap     ]} {id:GC(0)} {ol:Old regions: 2->36}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,heap     ]} {id:GC(0)} {hu:Humongous regions: 5->0}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,metaspace]} {id:GC(0)} {ms:Metaspace: 186K(384K)->186K(384K)} NonClass: 180K(256K)->180K(256K) Class: 6K(128K)->6K(128K)",
    "{up:[0.048s]}{lv:[info]}{tg:[gc          ]} {id:GC(0)} {py:Pause Young} {nm:(Normal)} {cz:(G1 Evacuation Pause)} {hp:53M->40M(256M)} {pt:5.102ms}",
    "{up:[0.048s]}{lv:[info]}{tg:[gc,cpu      ]} {id:GC(0)} {cpu:User=0.01s Sys=0.01s Real=0.00s}",
  ],
  notes: {
    py: { label: "Pause Young · the kind of GC", when: "stopped", text: <>a young collection: copy the live objects out of eden and the survivor regions, then reuse those regions. every app thread is stopped for it.</> },
    nm: {
      label: "(Normal) · the young GC's flavour",
      text: (
        <>
          a plain young GC. the other flavours are <code>(Concurrent Start)</code> (this one also starts marking the old gen), <code>(Prepare Mixed)</code> and{" "}
          <code>(Mixed)</code> (also collects some old regions). see the G1 cycle tab.
        </>
      ),
    },
    cz: {
      label: "(G1 Evacuation Pause) · the cause",
      text: (
        <>
          why this GC happened. here: eden filled up, the normal reason. the ones worth noticing: <code>(G1 Humongous Allocation)</code>,{" "}
          <code>(Metadata GC Threshold)</code>, <code>(System.gc())</code>, and anything mentioning a full GC.
        </>
      ),
    },
    hp: {
      label: "53M->40M(256M) · heap before → after (committed)",
      when: "stopped",
      text: (
        <>
          heap in use when the pause began, in use when it ended, and how much heap is committed. after a young GC the 40M still includes old-gen garbage
          nobody has looked at yet, so it's not your live set. regions add up: 47 eden + 2 old + 5 humongous ≈ 53M before, 6 survivor + 36 old ≈ 40M after.
        </>
      ),
    },
    pt: {
      label: "5.102ms · the pause",
      when: "stopped",
      text: (
        <>
          how long the GC itself kept the app stopped. it does not include time to safepoint (the wait for every thread to stop), which <code>-Xlog:safepoint</code>{" "}
          reports.
        </>
      ),
    },
    wk: { label: "Using 6 workers of 11", text: <>G1 has 11 parallel GC threads on this 14-core machine, and decided 6 were enough for a heap this small. bigger heaps get more.</> },
    ph: { label: "the phases", when: "stopped", text: <>where the pause went. pre and post evacuate are bookkeeping, and "other" is everything not counted elsewhere. they add up to roughly the pause time.</> },
    mr: {
      label: "Merge Heap Roots",
      when: "stopped",
      text: <>merging the remembered sets of the collection set into one card table, so the GC knows which cards outside the young gen point in. big when lots of old objects point at young ones.</>,
    },
    ev: { label: "Evacuate Collection Set: 3.88ms", when: "stopped", text: <>copying the live objects. it's almost always the biggest phase, and it grows with how much survives, not with how much died.</> },
    ed: {
      label: "Eden regions: 47->0(76)",
      text: <>47 eden regions before, 0 after (a young GC always empties eden), and G1 will let eden grow to 76 regions before the next one. resizing eden is how G1 steers toward its pause goal.</>,
    },
    sv: { label: "Survivor regions: 0->6(6)", text: <>6 regions of objects that survived but are still young. they'll be copied again next time, until they're old enough to promote.</> },
    ol: {
      label: "Old regions: 2->36",
      text: <>34 regions promoted into the old gen in one go (survivor space was too small to keep all the cache entries young). old regions only shrink in mixed or full GCs.</>,
    },
    hu: {
      label: "Humongous regions: 5->0",
      text: (
        <>
          the program's 4 MB buffer. 4 MB plus a 16-byte array header doesn't fit in 4 one-MB regions, so it took 5. it was already dead, so this young GC freed
          it on the spot.
        </>
      ),
    },
    ms: {
      label: "Metaspace: used(committed)->used(committed)",
      text: <>class metadata, before and after. flat here, as it should be. if this climbs at every GC for hours, something is loading classes and never letting go of them.</>,
    },
    cpu: {
      label: "User=0.01s Sys=0.01s Real=0.00s",
      text: (
        <>
          CPU time of all GC threads in user and kernel mode, and wall time, rounded to 10 ms (so a 5 ms pause shows 0.00s). on a parallel collector user + sys is
          bigger than real. if real is much bigger than user + sys, the GC threads were waiting for a CPU. high sys points at the OS: paging, swapping.
        </>
      ),
    },
  },
};

const g1Cycle: Sample = {
  label: "G1 cycle",
  first: "cmc",
  lines: [
    "{up:[0.109s]}{lv:[info]}{tg:[gc          ]} {id:GC(4)} {py:Pause Young} {cs:(Concurrent Start)} (G1 Evacuation Pause) 189M->183M(256M) 2.981ms",
    "{up:[0.109s]}{lv:[info]}{tg:[gc          ]} {id5:GC(5)} {cm:Concurrent Mark Cycle}",
    "{up:[0.112s]}{lv:[info]}{tg:[gc          ]} {id5:GC(5)} {rk:Pause Remark} {rh:200M->132M(256M)} {rt:0.288ms}",
    "{up:[0.114s]}{lv:[info]}{tg:[gc          ]} {id6:GC(6)} Pause Young (Normal) (G1 Evacuation Pause) 139M->136M(256M) 1.138ms",
    "{up:[0.115s]}{lv:[info]}{tg:[gc          ]} {id5:GC(5)} {cl:Pause Cleanup} 138M->138M(256M) 0.022ms",
    "{up:[0.115s]}{lv:[info]}{tg:[gc          ]} {id5:GC(5)} {cm:Concurrent Mark Cycle} {cmc:6.022ms}",
    "{up:[0.121s]}{lv:[info]}{tg:[gc          ]} {id:GC(7)} Pause Young {pm:(Prepare Mixed)} (G1 Evacuation Pause) 177M->171M(256M) 1.655ms",
    "{up:[0.126s]}{lv:[info]}{tg:[gc          ]} {id:GC(8)} Pause Young {mx:(Mixed)} (G1 Evacuation Pause) {mh:199M->167M(256M)} 1.600ms",
  ],
  notes: {
    py: { label: "Pause Young", when: "stopped", text: <>still a young GC, with every app thread stopped.</> },
    cs: {
      label: "(Concurrent Start)",
      when: "stopped",
      text: <>the old gen crossed G1's threshold (it adapts it, starting from 45% of the heap). so this young GC also scans the roots for a concurrent mark, since the app is stopped anyway.</>,
    },
    id5: { label: "GC(5) · a concurrent cycle", text: <>the marking cycle gets its own number, and its lines are spread out: GC(6) happens in the middle of GC(5). read by number, not by line order.</> },
    id6: { label: "GC(6) · a young GC during marking", when: "stopped", text: <>marking runs on its own threads, so eden keeps filling and young GCs keep happening while it works.</> },
    cm: { label: "Concurrent Mark Cycle", when: "running", text: <>marking the whole old gen on 3 GC threads while the app runs. this line opens the cycle, and the one with a time on it closes it.</> },
    cmc: {
      label: "6.022ms · NOT a pause",
      when: "running",
      text: <>how long the concurrent cycle took from start to finish. the app was running the whole time (apart from the remark and cleanup pauses). people add this to their pause totals by mistake all the time.</>,
    },
    rk: { label: "Pause Remark", when: "stopped", text: <>a short pause that finishes marking, processes weak references, and frees regions that turned out to be all garbage.</> },
    rh: {
      label: "200M->132M(256M) · freed by marking",
      when: "stopped",
      text: <>68 MB back without copying anything: whole regions that marking found 100% dead are simply freed. the "after" here is close to the true live set, so it's the number to watch over time.</>,
    },
    rt: { label: "0.288ms", when: "stopped", text: <>the remark pause itself. short, because the heavy marking already happened concurrently.</> },
    cl: { label: "Pause Cleanup", when: "stopped", text: <>a tiny pause that closes the marking cycle once the remembered sets of the candidate regions are rebuilt.</> },
    pm: { label: "(Prepare Mixed)", when: "stopped", text: <>the last young-only GC before the mixed ones. marking found old regions worth collecting.</> },
    mx: { label: "(Mixed)", when: "stopped", text: <>young regions plus a few old candidate regions with the most garbage. this is where the old gen actually shrinks.</> },
    mh: { label: "199M->167M(256M)", when: "stopped", text: <>32 MB back, in 1.6 ms. a normal young GC at this point only frees a few MB, because most of what's in eden is cache entries that survive.</> },
  },
};

const parallelFull: Sample = {
  label: "Parallel full GC",
  first: "og",
  lines: [
    "{up:[0.105s]}{lv:[info]}{tg:[gc,start       ]} {id:GC(3)} {pf:Pause Full} {af:(Allocation Failure)}",
    "···",
    "{up:[0.106s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Marking Phase 1.084ms}",
    "{up:[0.106s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Summary Phase 0.022ms}",
    "{up:[0.107s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Forward 0.824ms}",
    "{up:[0.108s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Adjust Pointers 0.582ms}",
    "{up:[0.109s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Compaction Phase 0.885ms}",
    "{up:[0.109s]}{lv:[info]}{tg:[gc,phases      ]} {id:GC(3)} {mk:Post Compact 0.083ms}",
    "{up:[0.109s]}{lv:[info]}{tg:[gc,heap        ]} {id:GC(3)} {yg:PSYoungGen: 76256K(76288K)->0K(76288K)} Eden: 65536K(65536K)->0K(65536K) From: 10720K(10752K)->0K(10752K)",
    "{up:[0.109s]}{lv:[info]}{tg:[gc,heap        ]} {id:GC(3)} {og:ParOldGen: 135822K(175104K)->51402K(174592K)}",
    "{up:[0.109s]}{lv:[info]}{tg:[gc             ]} {id:GC(3)} {pf:Pause Full} {af:(Allocation Failure)} {fh:207M->50M(245M)} {ft:3.827ms}",
  ],
  notes: {
    pf: { label: "Pause Full", when: "stopped", text: <>the whole heap, young and old, marked and compacted with every app thread stopped. for Parallel and Serial that's how the old gen gets collected at all.</> },
    af: {
      label: "(Allocation Failure)",
      text: <>the cause. an allocation didn't fit, so a GC had to run. for a young GC that just means eden is full. a full GC with this cause means the old gen couldn't take what the young GC wanted to promote.</>,
    },
    mk: {
      label: "mark, summary, forward, adjust, compact",
      when: "stopped",
      text: <>the mark-compact passes, on 11 threads: mark what's live, work out where every live object will move to, rewrite every pointer, slide the objects down.</>,
    },
    yg: { label: "PSYoungGen: used(capacity)->used(capacity)", text: <>the young gen: 74 MB in use before, empty after. eden and the "from" survivor space are broken out after it.</> },
    og: {
      label: "ParOldGen: 135822K->51402K · the live set",
      text: (
        <>
          after a full GC, what's left in the old gen is (nearly) all live data: here about 50 MB, which is the 20,000 cached 2 KB arrays plus the map holding
          them. if this number keeps going up from one full GC to the next, you have a leak.
        </>
      ),
    },
    fh: { label: "207M->50M(245M)", when: "stopped", text: <>the whole heap, before and after. 157 MB of garbage in one go.</> },
    ft: { label: "3.827ms", when: "stopped", text: <>a full GC in under 4 ms, because this heap is small and only 50 MB is alive. the same pause on a 20 GB live set takes seconds.</> },
  },
};

const zgc: Sample = {
  label: "ZGC",
  first: "zd",
  lines: [
    "{up:[0.080s]}{lv:[info]}{tg:[gc          ]} {id:GC(3)} {mj:Major Collection} {ar:(Allocation Rate)}",
    "{up:[0.080s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:Y:} {zp:Pause Mark Start (Major) 0.004ms}",
    "{up:[0.087s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:Y:} {zc:Concurrent Mark 6.776ms}",
    "{up:[0.087s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:Y:} {zp:Pause Mark End 0.005ms}",
    "···",
    "{up:[0.087s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:Y:} {zp:Pause Relocate Start 0.002ms}",
    "{up:[0.089s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:Y:} {zc:Concurrent Relocate 1.548ms}",
    "···",
    "{up:[0.091s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:O:} {zc:Concurrent Mark 1.666ms}",
    "{up:[0.091s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:O:} {zp:Pause Mark End 0.006ms}",
    "···",
    "{up:[0.092s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:O:} {zp:Pause Relocate Start 0.002ms}",
    "{up:[0.092s]}{lv:[info]}{tg:[gc,phases   ]} {id:GC(3)} {yo:O:} {zc:Concurrent Relocate 0.538ms}",
    "···",
    "{up:[0.093s]}{lv:[info]}{tg:[gc          ]} {id:GC(3)} {mj:Major Collection} {ar:(Allocation Rate)} {zh:134M(52%)->136M(53%)} {zd:0.013s}",
  ],
  notes: {
    mj: { label: "Major Collection", text: <>generational ZGC collects young and old together in a major collection. a <code>Minor Collection</code> is young only.</> },
    ar: {
      label: "(Allocation Rate) · the cause",
      text: (
        <>
          ZGC starts a cycle early, based on how fast you allocate, so it can finish before the heap fills up. <code>(Warmup)</code> and <code>(Proactive)</code> are
          normal too. <code>(Allocation Stall)</code> is the one to worry about.
        </>
      ),
    },
    yo: { label: "Y: and O:", text: <>which generation the line is about: the young collection or the old one, which run as two separate pipelines inside one major collection.</> },
    zp: { label: "Pause ... · real pauses", when: "stopped", text: <>these three kinds of line are ZGC's only stop-the-world pauses. a few microseconds each, because none of them walks the heap.</> },
    zc: { label: "Concurrent ... · not pauses", when: "running", text: <>the actual work: marking and relocating, on GC threads, while the app runs. their times are how long the phase took, not how long anyone waited.</> },
    zh: {
      label: "134M(52%)->136M(53%)",
      text: <>heap used when the cycle started and when it ended. it grew: the app kept allocating while ZGC worked. with a concurrent collector, before → after is not "what the GC freed".</>,
    },
    zd: {
      label: "0.013s · NOT a pause",
      when: "running",
      text: <>the length of the whole cycle. people grep for the number at the end of the line and think ZGC paused for 13 ms. the pauses in this cycle add up to 0.019 ms.</>,
    },
  },
};

const SAMPLES = { g1y: g1Young, g1c: g1Cycle, par: parallelFull, zgc } as const;
type Key = keyof typeof SAMPLES;

function parse(line: string) {
  const out: { t: string; k?: string }[] = [];
  const re = /\{(\w+):([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    out.push({ t: m[2], k: m[1] });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

export function LogViewer({ start = "g1y" }: { start?: Key }) {
  const [key, setKey] = useState<Key>(start);
  const sample = SAMPLES[key];
  const [active, setActive] = useState<string>(sample.first);
  const notes = { ...common, ...sample.notes };
  const note = notes[active];

  return (
    <div className="@container grid grid-cols-[minmax(0,1fr)] gap-3">
      <Row k="log" kw="6ch" last>
        <Words
          options={(Object.keys(SAMPLES) as Key[]).map((k) => ({ v: k, label: SAMPLES[k].label }))}
          value={key}
          onChange={(k) => {
            setKey(k);
            setActive(SAMPLES[k].first);
          }}
          label="which log"
        />
      </Row>
      <div className="rounded-md bg-bg px-3 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="text-[10.5px] leading-[1.75] @[560px]:text-[11.5px]" style={{ fontFeatureSettings: '"calt" 0' }}>
          {sample.lines.map((line, i) =>
            line === "···" ? (
              <div key={i} className="pl-[2ch] text-faint select-none" aria-label="lines trimmed">
                ···
              </div>
            ) : (
              <div key={i} className="pl-[3ch] -indent-[3ch] break-all whitespace-pre-wrap text-mute">
                {parse(line).map((s, j) =>
                  s.k ? (
                    <button
                      key={j}
                      type="button"
                      onMouseEnter={() => setActive(s.k!)}
                      onFocus={() => setActive(s.k!)}
                      onClick={() => setActive(s.k!)}
                      aria-pressed={active === s.k}
                      className="cursor-help rounded-[2px] text-left indent-0 transition-colors duration-150"
                      style={{
                        color: active === s.k ? "var(--hi)" : "var(--ink)",
                        background: active === s.k ? "color-mix(in srgb, var(--hot) 22%, transparent)" : undefined,
                        textDecoration: active === s.k ? "none" : "underline dotted var(--line-2)",
                        textUnderlineOffset: 3,
                      }}
                    >
                      {s.t}
                    </button>
                  ) : (
                    <span key={j}>{s.t}</span>
                  ),
                )}
              </div>
            ),
          )}
        </div>
      </div>
      <div className="min-h-[8.5em] rounded-md px-1" aria-live="polite">
        {note && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-12 text-hi">{note.label}</span>
              {note.when && (
                <span
                  className="rounded-xs px-1.5 text-11 leading-[18px]"
                  style={{
                    color: note.when === "stopped" ? "var(--hot)" : "var(--meta)",
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${note.when === "stopped" ? "--hot" : "--meta"}) 55%, transparent)`,
                  }}
                >
                  {note.when === "stopped" ? "app stopped" : "concurrent, app running"}
                </span>
              )}
            </div>
            <p className="mt-1 font-serif text-[16px] leading-[1.6] text-ink">{note.text}</p>
          </>
        )}
      </div>
    </div>
  );
}
