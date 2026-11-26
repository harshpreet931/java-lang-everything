"use client";

import { useEffect, useRef } from "react";

/**
 * waits for the footer to come near the viewport, then loads the lamp (bedrock-lamp.ts) and its data
 * with a dynamic import. until then this is the only js the floor costs a page.
 */
export function BedrockLamp() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    let gone = false;
    let stop: (() => void) | undefined;
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        import("./bedrock-lamp").then((m) => {
          if (!gone) stop = m.mountLamp(host);
        });
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(host);
    return () => {
      gone = true;
      io.disconnect();
      stop?.();
    };
  }, []);
  return <span ref={ref} hidden />;
}
