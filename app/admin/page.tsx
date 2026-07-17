"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/components/Toaster";
import { askConfirm } from "@/app/components/DialogHost";

interface Report {
  id: number;
  reason: string | null;
  created_at: string;
  post_id: number | null;
  reporter_name: string;
  post_content: string | null;
  post_owner: string | null;
  image_url: string | null;
}

// Moderasyon paneli — sadece ADMIN_EMAILS'teki hesaplar
export default function AdminPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/reports")
      .then((res) => {
        if (res.status === 401) throw new Error("Giriş gerekli.");
        if (res.status === 403) throw new Error("Bu sayfa moderatörlere özel.");
        if (!res.ok) throw new Error("Yüklenemedi.");
        return res.json();
      })
      .then((d) => setReports(d.reports ?? []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveReport(id: number) {
    await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: id }),
    });
    load();
  }

  async function deletePost(postId: number) {
    const ok = await askConfirm({
      title: "Paylaşımı sil? (moderasyon)",
      message: "Paylaşım kalıcı olarak kaldırılır ve ilgili şikayetler kapanır.",
      confirmLabel: "sil",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    toast("Paylaşım kaldırıldı. 🛡", "success");
    load();
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!reports)
    return <p className="font-mono text-sm text-dusk-300">yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-dusk-100">
        🛡 Moderasyon
      </h1>
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dusk-700/60 bg-dusk-900 p-6 text-center text-sm text-dusk-200">
          Bekleyen şikayet yok — her şey yolunda ✨
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-dusk-700/60 bg-dusk-900 p-4"
            >
              <p className="font-mono text-xs text-dusk-300">
                {r.reporter_name} şikayet etti · {r.created_at}
                {r.reason && ` · gerekçe: "${r.reason}"`}
              </p>
              {r.post_content !== null || r.image_url ? (
                <div className="mt-2 rounded-xl bg-dusk-800 p-3">
                  <p className="font-mono text-[10px] text-dusk-300">
                    {r.post_owner} yazdı:
                  </p>
                  {r.post_content && (
                    <p className="mt-1 text-sm text-dusk-100">{r.post_content}</p>
                  )}
                  {r.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.image_url}
                      alt=""
                      className="mt-2 max-h-40 rounded-lg object-cover"
                    />
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm italic text-dusk-300">
                  (paylaşım zaten silinmiş)
                </p>
              )}
              <div className="mt-3 flex gap-3">
                {r.post_id && (
                  <button
                    onClick={() => deletePost(r.post_id!)}
                    className="rounded-full border border-red-400/50 px-4 py-1 font-mono text-xs text-red-400 hover:bg-red-400/10"
                  >
                    paylaşımı sil
                  </button>
                )}
                <button
                  onClick={() => resolveReport(r.id)}
                  className="rounded-full border border-teal-glow/50 px-4 py-1 font-mono text-xs text-teal-glow hover:bg-teal-glow/10"
                >
                  sorun yok, kapat
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
