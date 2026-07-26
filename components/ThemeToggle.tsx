"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setDark(attr ? attr === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const flip = () => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("bb-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — the attribute still applies for this session */
    }
    setDark(next);
  };

  return (
    <button type="button" className="theme-toggle" onClick={flip} suppressHydrationWarning>
      {dark ? "Day Edition" : "Night Edition"}
    </button>
  );
}
