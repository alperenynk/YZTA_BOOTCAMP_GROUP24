"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

// Modül seviyesi olay köprüsü: herhangi bir bileşenden toast("...") çağrılır
let pushToast: ((t: ToastItem) => void) | null = null;
let nextId = 1;

export function toast(text: string, kind: ToastKind = "info") {
  pushToast?.({ id: nextId++, text, kind });
}

const KIND_CLS: Record<ToastKind, string> = {
  success: "border-teal-glow/50 text-dusk-100",
  error: "border-red-400/60 text-dusk-100",
  info: "border-dusk-600 text-dusk-100",
};

const KIND_ICON: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "ⓘ",
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (t) => {
      setItems((prev) => [...prev.slice(-3), t]); // en fazla 4 üst üste
      setTimeout(
        () => setItems((prev) => prev.filter((x) => x.id !== t.id)),
        4000
      );
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-enter flex items-start gap-2.5 rounded-2xl border bg-dusk-900 px-4 py-3 text-sm shadow-xl ${KIND_CLS[t.kind]}`}
        >
          <span
            className={`mt-0.5 font-mono text-xs ${
              t.kind === "success"
                ? "text-teal-glow"
                : t.kind === "error"
                  ? "text-red-400"
                  : "text-dusk-300"
            }`}
          >
            {KIND_ICON[t.kind]}
          </span>
          <span className="min-w-0 flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
