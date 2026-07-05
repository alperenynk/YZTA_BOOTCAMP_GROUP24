"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SuggestionCard from "@/app/components/SuggestionCard";
import type { SuggestionItem, SuggestionLayer } from "@/lib/types";

const LAYERS: { key: SuggestionLayer; label: string; badge: string }[] = [
  { key: "ticketed", label: "🎟 Biletli Etkinlikler", badge: "card-ticketed" },
  { key: "free", label: "🎈 Ücretsiz Etkinlikler", badge: "card-free" },
  { key: "venue", label: "📍 Mekan Önerileri", badge: "card-venue" },
  { key: "experience", label: "🧭 Deneyim Paketi", badge: "card-experience" },
];

interface HistoryData {
  query: {
    id: number;
    raw_text: string;
    parsed: { location?: string | null } | null;
    target_date: string | null;
    created_at: string;
  };
  suggestions: SuggestionItem[];
}

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/history/${id}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (res.status === 404) throw new Error("Bu arama bulunamadı.");
        if (!res.ok) throw new Error("Arama yüklenemedi.");
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch((e) => setError(e.message));
  }, [id, router]);

  if (error)
    return (
      <div className="space-y-4">
        <p className="text-red-300">{error}</p>
        <Link href="/profile" className="font-mono text-xs text-teal-glow hover:underline">
          ← profile dön
        </Link>
      </div>
    );
  if (!data)
    return <p className="font-mono text-sm text-dusk-300">yükleniyor…</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/profile"
          className="font-mono text-xs text-teal-glow hover:underline"
        >
          ← profile dön
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-dusk-100">
          “{data.query.raw_text}”
        </h1>
        <p className="mt-1 font-mono text-xs text-dusk-300">
          {data.query.target_date && `hedef tarih: ${data.query.target_date} · `}
          aranma: {data.query.created_at}
        </p>
      </div>

      {LAYERS.map(({ key, label, badge }) => {
        const items = data.suggestions.filter((s) => s.layer === key);
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <h2
              className={`mb-3 inline-flex items-center rounded-full border border-dusk-700/50 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-dusk-100 ${badge}`}
            >
              {label}
            </h2>
            <div className="space-y-4">
              {items.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  location={data.query.parsed?.location ?? null}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
