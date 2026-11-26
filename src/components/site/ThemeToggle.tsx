"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";

/** dark and paper. also bound to "t" anywhere outside a text field. `withLabel` names the theme it switches to. */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    if (withLabel) return; // the bar's own toggle owns the key
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true], .cm-editor")) return;
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme, withLabel]);

  return (
    <button
      onClick={() => setTheme(next)}
      className={`flex h-10 shrink-0 items-center gap-2.5 rounded-md text-ink transition-colors duration-150 hover:bg-well-2 hover:text-hi ${
        withLabel ? "px-3 font-ui text-[0.9375rem]" : "w-10 justify-center"
      }`}
      aria-label={`switch to the ${next} theme (t)`}
      title={`${next} theme · t`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
      </svg>
      {withLabel && <span>{next} theme</span>}
    </button>
  );
}
