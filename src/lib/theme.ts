"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "jle-theme";

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
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
