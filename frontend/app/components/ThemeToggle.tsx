"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (dark === null) return <span className="w-7" />; // hidrasyon öncesi yer tutucu

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
      className="rounded-full border border-dusk-600 px-2 py-1 text-sm transition-colors hover:border-amber-glow"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
