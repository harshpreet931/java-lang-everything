"use client";

import { useState, type ReactNode } from "react";
import { Row, Words, ring, tint, type Tone, NARR } from "./kit";

// where the bytes go on a FileChannel.read(), per kind of buffer.
// heap: sun.nio.ch.IOUtil.read() borrows a temporary direct buffer (Util.getTemporaryDirectBuffer),
// reads into it with the syscall, then copies into your byte[]. direct: the syscall writes straight
// into your native memory. mapped: your buffer IS the page cache pages, no read() at all.
// transferTo: the kernel moves the bytes itself (sendfile/copy_file_range where the OS has them).

type Mode = "heap" | "direct" | "mapped" | "transferTo";
type Band = "heap" | "native" | "kernel" | "device";

const BANDS: { id: Band; label: string; sub: string }[] = [
  { id: "heap", label: "java heap", sub: "GC'd, objects can move" },
  { id: "native", label: "native memory", sub: "your process, outside the heap" },
  { id: "kernel", label: "kernel", sub: "page cache, socket buffers" },
  { id: "device", label: "disk / network card", sub: "" },
];

type Box = { label: ReactNode; tone?: Tone; dashed?: boolean };
type Edge = { label: string; tone: Tone | "mute" };

const MODES: Record<Mode, { boxes: Partial<Record<Band, Box>>; edges: Partial<Record<Band, Edge>>; copies: number; note: ReactNode; code: string }> = {
  heap: {
    code: "ByteBuffer.allocate(64 * 1024)",
    boxes: {
      heap: { label: "your ByteBuffer (a byte[])", tone: "hot" },
      native: { label: "temporary direct buffer, borrowed by the JDK", tone: "meta" },
      kernel: { label: "page cache" },
      device: { label: "file blocks" },
    },
    edges: {
      heap: { label: "copy #2: JDK copies into your array", tone: "hot" },
      native: { label: "copy #1: read() syscall", tone: "hot" },
      kernel: { label: "DMA, the CPU isn't involved", tone: "mute" },
    },
    copies: 2,
    note: (
      <>
        the OS can&apos;t write into the heap safely: the GC is allowed to move your <code>byte[]</code> mid-syscall. so the JDK reads into a
        native buffer it keeps per thread, then copies over. two CPU copies for every read.
      </>
    ),
  },
  direct: {
    code: "ByteBuffer.allocateDirect(64 * 1024)",
    boxes: {
      native: { label: "your direct ByteBuffer", tone: "hot" },
      kernel: { label: "page cache" },
      device: { label: "file blocks" },
    },
    edges: {
      native: { label: "copy #1: read() syscall", tone: "hot" },
      kernel: { label: "DMA", tone: "mute" },
    },
    copies: 1,
    note: (
      <>
        the buffer lives outside the heap at a fixed address, so the syscall writes straight into it. one copy. the price: slower to allocate,
        freed only when the GC collects the small heap object that owns it, and capped by <code>-XX:MaxDirectMemorySize</code>.
      </>
    ),
  },
  mapped: {
    code: "channel.map(READ_ONLY, 0, size)",
    boxes: {
      native: { label: "your MappedByteBuffer = the same physical pages", tone: "ref", dashed: true },
      kernel: { label: "page cache" },
      device: { label: "file blocks" },
    },
    edges: {
      native: { label: "no copy: mapped into your address space", tone: "ref" },
      kernel: { label: "DMA, on first touch (page fault)", tone: "mute" },
    },
    copies: 0,
    note: (
      <>
        no read() at all. the OS maps the file&apos;s pages into your address space, and a <code>get()</code> is a plain memory load. touching a page
        that isn&apos;t loaded yet triggers a page fault, and the OS fetches it. the file <em>is</em> the memory.
      </>
    ),
  },
  transferTo: {
    code: "in.transferTo(0, size, out)",
    boxes: {
      kernel: { label: "page cache → socket or other file", tone: "live" },
      device: { label: "file blocks" },
    },
    edges: {
      kernel: { label: "DMA", tone: "mute" },
    },
    copies: 0,
    note: (
      <>
        when you only move bytes from one channel to another, tell the OS and get out of the way. on linux this becomes <code>sendfile</code> or{" "}
        <code>copy_file_range</code>: the bytes never enter your process. static file servers live on this.
      </>
    ),
  },
};

export function CopyPath() {
  const [mode, setMode] = useState<Mode>("heap");
  const m = MODES[mode];
  return (
    <div className="text-13">
      <Row k="buffer =" w="8ch" last>
        <Words label="kind of buffer" options={["heap", "direct", "mapped", "transferTo"] as Mode[]} value={mode} onChange={setMode} />
      </Row>
      <div className="mt-2 mb-4 text-12 text-faint">
        <code className="text-mute">{m.code}</code> · CPU copies per read ={" "}
        <span className={`text-14 tabular ${m.copies === 2 ? "text-dead" : m.copies === 1 ? "text-hi" : "text-live"}`}>{m.copies}</span>
      </div>

      <div className="grid">
        {BANDS.map((b, i) => {
          const box = m.boxes[b.id];
          const edge = m.edges[b.id];
          return (
            <div key={b.id}>
              <div className="grid min-h-[52px] items-center gap-x-4 gap-y-1 border-t border-line py-2 sm:grid-cols-[16ch_minmax(0,1fr)]">
                <div>
                  <div className={`text-12 ${box ? "text-ink" : "text-faint"}`}>{b.label}</div>
                  {b.sub && <div className="text-[10px] leading-tight text-faint">{b.sub}</div>}
                </div>
                <div className="min-h-9">
                  {box && (
                    <span
                      className="inline-flex min-h-9 items-center rounded-md px-3 py-1.5 text-12 transition-[box-shadow] duration-200"
                      style={{
                        color: box.tone ? `var(--${box.tone})` : "var(--ink)",
                        boxShadow: box.dashed ? "none" : box.tone ? ring(box.tone, 80) : ring("line-2"),
                        outline: box.dashed ? `1px dashed var(--${box.tone ?? "line-2"})` : undefined,
                        outlineOffset: box.dashed ? -1 : undefined,
                        background: box.tone ? tint(box.tone, 7) : "var(--well)",
                      }}
                    >
                      {box.label}
                    </span>
                  )}
                </div>
              </div>
              {i < BANDS.length - 1 && (
                <div className="grid h-7 items-center gap-x-4 sm:grid-cols-[16ch_minmax(0,1fr)]">
                  <span className="hidden sm:block" />
                  <span className="flex items-center gap-2 pl-4 text-11">
                    {edge && (
                      <>
                        <span style={{ color: `var(--${edge.tone})` }}>↑</span>
                        <span style={{ color: `var(--${edge.tone})` }}>{edge.label}</span>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className={`mt-3 border-t border-line pt-3 ${NARR}`} aria-live="polite">
        {m.note}
      </p>
    </div>
  );
}
