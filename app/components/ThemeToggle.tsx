"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (dark === null) return <span className="w-7" />;

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("lokal-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Gündüz moduna geç" : "Gece moduna geç"}
      aria-label={dark ? "Gündüz moduna geç" : "Gece moduna geç"}
      className="rounded-full border border-dusk-700 px-2.5 py-1 text-sm transition-colors hover:border-amber-glow hover:text-amber-glow"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
