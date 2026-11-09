"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "./Icons";

type Theme = "dark" | "light" | "auto";
const KEY = "soul-theme";

/** Daylight reading mode for the report pages. Dark is the brand; this is opt-in and remembered per device. */
export function useReadingTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    let t: Theme = "auto";
    try { t = (localStorage.getItem(KEY) as Theme) || "auto"; } catch { /* ignore */ }
    setTheme(t);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    return () => { document.documentElement.removeAttribute("data-theme"); };
  }, [theme]);
  const toggle = () => {
    const dark = theme === "dark" || (theme === "auto" && !window.matchMedia("(prefers-color-scheme: light)").matches);
    const nextT: Theme = dark ? "light" : "dark";
    setTheme(nextT);
    try { localStorage.setItem(KEY, nextT); } catch { /* ignore */ }
  };
  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useReadingTheme();
  const light = theme === "light" || (theme === "auto" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches);
  return (
    <button type="button" className="icon-btn outlined" onClick={toggle} aria-label={light ? "Switch to dark" : "Switch to daylight reading"} aria-pressed={light}>
      {light ? <Moon /> : <Sun />}
    </button>
  );
}
