"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Action {
  icon: string;
  label: string;
  keywords: string;
  run: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const actions: Action[] = [
    { icon: "🔍", label: "Yeni arama (Keşfet)", keywords: "kesfet ara yeni arama home", run: () => router.push("/kesfet") },
    { icon: "📰", label: "Akışa git", keywords: "akis feed topluluk paylasim", run: () => router.push("/feed") },
    { icon: "👤", label: "Profilim", keywords: "profil rozet ayarlar hesap", run: () => router.push("/profile") },
    {
      icon: "🌗",
      label: "Temayı değiştir (gece/gündüz)",
      keywords: "tema dark light gece gunduz",
      run: () => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("lokal-theme", next ? "dark" : "light");
        } catch {}
      },
    },
    { icon: "🛡", label: "Moderasyon paneli", keywords: "admin sikayet moderasyon", run: () => router.push("/admin") },
    { icon: "🔐", label: "Gizlilik politikası", keywords: "gizlilik kvkk privacy", run: () => router.push("/privacy") },
  ];

  const filtered = actions.filter(
    (a) =>
      !query.trim() ||
      (a.label + " " + a.keywords)
        .toLocaleLowerCase("tr")
        .includes(query.trim().toLocaleLowerCase("tr"))
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function runAction(a: Action) {
    close();
    a.run();
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Komut paleti"
        className="toast-enter w-full max-w-md overflow-hidden rounded-3xl border border-dusk-700/60 bg-dusk-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-dusk-700/60 px-4">
          <span className="text-dusk-300">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && filtered[active]) {
                runAction(filtered[active]);
              }
            }}
            placeholder="Ne yapmak istersin?"
            aria-label="Komut ara"
            className="w-full bg-transparent py-3.5 text-sm text-dusk-100 placeholder:text-dusk-300 focus:outline-none"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center font-mono text-xs text-dusk-300">
              eşleşen komut yok
            </li>
          )}
          {filtered.map((a, i) => (
            <li key={a.label}>
              <button
                onClick={() => runAction(a)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  i === active
                    ? "bg-dusk-800 text-dusk-100"
                    : "text-dusk-200"
                }`}
              >
                <span>{a.icon}</span>
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
