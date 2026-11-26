"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "jle-theme";

/** switch themes. the change snaps: transitions are off for two frames while every token flips. */
export function setTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.add("no-tr");
  root.dataset.theme = t;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-tr")));
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  window.dispatchEvent(new CustomEvent("jle-theme", { detail: t }));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>("light");
  useEffect(() => {
    set((document.documentElement.dataset.theme as Theme) ?? "light");
    const on = (e: Event) => set((e as CustomEvent<Theme>).detail);
    window.addEventListener("jle-theme", on);
    return () => window.removeEventListener("jle-theme", on);
  }, []);
  return [theme, setTheme];
}
