"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

interface Notification {
  id: number;
  type: string;
  message: string;
  read: number;
  created_at: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function NotificationBell() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushState, setPushState] = useState<"unknown" | "available" | "granted">(
    "unknown"
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPushState(Notification.permission === "granted" ? "granted" : "available");
  }, []);

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushState("granted");
    } catch (err) {
      console.error("Push aboneliği başarısız:", err);
    }
  }

  useEffect(() => {
    if (!session) return;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setItems(d.notifications ?? []);
          setUnread(d.unread ?? 0);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000); // dakikada bir tazele
    return () => clearInterval(t);
  }, [session]);

  if (!session) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <span className="relative">
      <button
        onClick={toggle}
        title="Bildirimler"
        aria-label={`Bildirimler${unread > 0 ? ` (${unread} okunmamış)` : ""}`}
        aria-expanded={open}
        className="relative rounded-full border border-dusk-600 px-2 py-1 text-sm transition-colors hover:border-amber-glow"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-glow px-1 font-mono text-[9px] font-bold text-dusk-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="app-panel absolute right-0 top-10 z-50 w-80 overflow-hidden shadow-xl">
          <p className="border-b border-dusk-700/60 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-dusk-300">
            Bildirimler
          </p>
          {pushState === "available" && (
            <button
              onClick={enablePush}
              className="w-full border-b border-dusk-700/60 px-4 py-2 text-left font-mono text-xs text-teal-glow hover:bg-dusk-800"
            >
              📲 telefon/masaüstü bildirimlerini aç
            </button>
          )}
          {items.length === 0 ? (
            <p className="p-4 text-sm text-dusk-200">Henüz bildirim yok.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-dusk-700/40 overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-2.5 text-sm normal-case tracking-normal ${
                    n.read ? "text-dusk-200" : "font-medium text-dusk-100"
                  }`}
                >
                  {n.message}
                  <span className="mt-0.5 block font-mono text-[9px] text-dusk-300">
                    {n.created_at}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
