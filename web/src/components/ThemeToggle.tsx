"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = (localStorage.getItem("oclaw-theme") as "dark" | "light") || "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);
  const toggle = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("oclaw-theme", t); } catch {}
    window.dispatchEvent(new CustomEvent("oclaw:theme", { detail: t }));
  };
  return (
    <button onClick={toggle} title="Toggle light / dark" aria-label="Toggle theme"
      className="rounded-full border border-[var(--color-line-2)] p-1.5 text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
