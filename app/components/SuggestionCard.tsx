"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { SuggestionItem } from "@/lib/types";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

type FeedbackStage = "idle" | "rating" | "note" | "done";

const CARD_BG: Record<string, string> = {
  ticketed: "card-ticketed",
  free: "card-free",
  venue: "card-venue",
  experience: "card-experience",
};

export default function SuggestionCard({
  item,
  location = null,
}: {
  item: SuggestionItem;
  location?: string | null;
}) {
  const [stage, setStage] = useState<FeedbackStage>("idle");
  const [liked, setLiked] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("🔗 paylaş");
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  async function toggleSave() {
    if (!item.id || savingBookmark) return;
    setSavingBookmark(true);
    try {
      const res = await fetch(`/api/suggestions/${item.id}/save`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSaved(d.saved);
    } catch {
      // sessizce başarısız ol, kullanıcı tekrar deneyebilir
    } finally {
      setSavingBookmark(false);
    }
  }

  async function sharePost() {
    if (!item.id) return;
    try {
      const res = await fetch(`/api/suggestions/${item.id}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      const url = `${window.location.origin}${d.url}`;
      await navigator.clipboard.writeText(url);
      setShareLabel("kopyalandı ✓");
      setTimeout(() => setShareLabel("🔗 paylaş"), 2500);
    } catch {
      setShareLabel("olmadı :(");
      setTimeout(() => setShareLabel("🔗 paylaş"), 2500);
    }
  }

  async function submitFeedback(finalNote: string) {
    if (!item.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion_id: item.id,
          went: true,
          liked,
          note: finalNote,
          share,
        }),
      });
      if (!res.ok) throw new Error();
      setStage("done");
    } catch {
      setError("Kaydedilemedi, tekrar dener misin?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`card-enter rounded-3xl border border-dusk-700/50 p-5 shadow-sm transition-transform hover:-translate-y-0.5 sm:p-6 ${CARD_BG[item.layer] ?? "card-neutral"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-dusk-100">{item.title}</h3>
          <p className="mt-1 font-mono text-xs text-teal-glow">{item.meta}</p>
        </div>
        {stage === "idle" && (
          <div className="flex shrink-0 items-center gap-2">
            {item.id && (
              <button
                onClick={toggleSave}
                disabled={savingBookmark}
                title={saved ? "Kayıtlardan çıkar" : "Sonra bakmak için kaydet"}
                aria-label={saved ? "Kayıtlardan çıkar" : "Kaydet"}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                  saved
                    ? "border-amber-glow bg-amber-glow/10 text-amber-glow"
                    : "border-dusk-600 text-dusk-200 hover:border-amber-glow"
                }`}
              >
                {saved ? "🔖 kaydedildi" : "🔖 kaydet"}
              </button>
            )}
            <button
              onClick={() => setStage("rating")}
              className="btn-primary px-4 py-1.5 text-xs"
            >
              Gittim ✓
            </button>
          </div>
        )}
        {stage === "done" && (
          <span className="shrink-0 font-mono text-xs text-teal-glow">
            kaydedildi ✓
          </span>
        )}
      </div>

      {item.steps && (
        <>
          <ol className="route-line mt-4 ml-2 space-y-4 pl-5">
            {item.steps.map((step, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-amber-glow" />
                <div className="font-mono text-xs text-amber-soft">{step.time}</div>
                <div className="font-medium text-dusk-100">{step.title}</div>
                <div className="text-sm text-dusk-200">{step.description}</div>
              </li>
            ))}
          </ol>
          <button
            onClick={() => setShowMap((v) => !v)}
            className="mt-3 rounded-full border border-teal-glow/50 px-3 py-1 font-mono text-xs text-teal-glow hover:bg-teal-glow/10"
          >
            {showMap ? "haritayı gizle" : "🗺 haritada gör"}
          </button>
          {showMap && <RouteMap steps={item.steps} location={location} />}
        </>
      )}

      <p className="mt-3 border-t border-dusk-700/60 pt-3 text-sm italic text-lavender">
        <span className="font-mono not-italic text-xs uppercase tracking-wider text-dusk-300">
          neden bu öneri? ·{" "}
        </span>
        {item.reason_text}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-teal-glow underline-offset-4 hover:underline"
          >
            kaynağa git ↗
          </a>
        )}
        {item.id && (
          <a
            href={`/api/suggestions/${item.id}/ics`}
            download
            className="font-mono text-xs text-dusk-200 underline-offset-4 hover:text-teal-glow hover:underline"
            title="Telefon/bilgisayar takvimine ekle"
          >
            🗓 takvime ekle
          </a>
        )}
        {item.id && (
          <button
            onClick={sharePost}
            className="font-mono text-xs text-dusk-200 underline-offset-4 hover:text-teal-glow hover:underline"
            title="Herkese açık link kopyala"
          >
            {shareLabel}
          </button>
        )}
      </div>

      {stage === "rating" && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-dusk-900/70 p-3">
          <span className="font-mono text-xs text-dusk-200">Nasıldı?</span>
          <button
            onClick={() => {
              setLiked(true);
              setStage("note");
            }}
            className="rounded-full border border-teal-glow/50 px-3 py-1 text-sm text-teal-glow hover:bg-teal-glow/10"
          >
            Beğendim 👍
          </button>
          <button
            onClick={() => {
              setLiked(false);
              setStage("note");
            }}
            className="rounded-full border border-dusk-600 px-3 py-1 text-sm text-dusk-200 hover:bg-dusk-700/50"
          >
            Beğenmedim 👎
          </button>
        </div>
      )}

      {stage === "note" && (
        <div className="mt-4 space-y-2 rounded-2xl bg-dusk-900/70 p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="İstersen kısa bir not bırak (opsiyonel)…"
            rows={2}
            className="w-full resize-none rounded-md border border-dusk-600 bg-dusk-900 p-2 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
          />
          <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-dusk-200">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="accent-amber-glow"
            />
            🌍 Topluluk akışında paylaş
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => submitFeedback(note)}
              disabled={saving}
              className="btn-primary px-4 py-1.5 text-xs"
            >
              {saving ? "kaydediliyor…" : "kaydet"}
            </button>
            <button
              onClick={() => submitFeedback("")}
              disabled={saving}
              className="font-mono text-xs text-dusk-300 hover:text-dusk-100"
            >
              notsuz kaydet
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
