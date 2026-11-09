"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type Ctx = {
  theme: ResolvedTheme;
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  toggleTheme: () => void;
};

const THEME_KEY = "nutriscan.theme";
const ThemeContext = createContext<Ctx | null>(null);

function readSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [system, setSystem] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const saved = (() => {
      try { return localStorage.getItem(THEME_KEY) as ThemeChoice | null; } catch { return null; }
    })();
    const nextChoice = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const nextSystem = readSystem();
    setChoiceState(nextChoice);
    setSystem(nextSystem);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme = choice === "system" ? system : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setChoice = (next: ThemeChoice) => {
    setChoiceState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  };

  const toggleTheme = () => setChoice(theme === "dark" ? "light" : "dark");

  const value = useMemo(() => ({ theme, choice, setChoice, toggleTheme }), [theme, choice]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
