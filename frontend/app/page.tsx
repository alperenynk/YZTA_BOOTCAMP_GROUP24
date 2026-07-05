"use client";

import { useRef, useState } from "react";
import SuggestionCard from "./components/SuggestionCard";
import LoginModal from "./components/LoginModal";
import { authClient } from "@/lib/auth-client";
import type {
  ParsedQuery,
  SuggestResponse,
  SuggestionItem,
  SuggestionLayer,
  WeatherInfo,
} from "@/lib/types";

const LAYERS: { key: SuggestionLayer; label: string; badge: string }[] = [
  { key: "ticketed", label: "🎟 Biletli Etkinlikler", badge: "card-ticketed" },
  { key: "free", label: "🎈 Ücretsiz Etkinlikler", badge: "card-free" },
  { key: "venue", label: "📍 Mekan Önerileri", badge: "card-venue" },
  { key: "experience", label: "🧭 Deneyim Paketi", badge: "card-experience" },
];

function greeting(hour: number): string {
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

const EXAMPLES = [
  "Sevgilimle Kadıköy'deyiz, biraz yorgunuz, akşamı değerlendirmek istiyoruz",
  "Arkadaşlarla Beşiktaş'tayız, enerjimiz yüksek, bütçe kısıtlı",
  "Tek başımayım, sakin bir yer arıyorum, 2 saatim var",
];

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [text, setText] = useState("");
  const [lastText, setLastText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [locFix, setLocFix] = useState("");
  const [locating, setLocating] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Giriş yoksa modal aç; giriş varsa true dön
  function guardAuth(): boolean {
    if (isPending) return false;
    if (!session) {
      setShowLogin(true);
      textareaRef.current?.blur();
      return false;
    }
    return true;
  }

  // Streaming: katmanlar hazır oldukça ekrana düşer (NDJSON satırları)
  async function handleSubmit(input?: string) {
    const rawText = (input ?? text).trim();
    if (!rawText || loading) return;
    if (!guardAuth()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStage("başlıyor…");
    try {
      const res = await fetch("/api/suggest/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText }),
      });
      if (res.status === 401) {
        setShowLogin(true);
        return;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Bilinmeyen hata");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let partial: SuggestResponse | null = null;

      const handleEvent = (ev: {
        type: string;
        label?: string;
        parsed?: ParsedQuery;
        weather?: WeatherInfo;
        items?: SuggestionItem[];
        error?: string;
      }) => {
        if (ev.type === "stage" && ev.label) setStage(ev.label);
        else if (ev.type === "parsed" && ev.parsed && ev.weather) {
          partial = {
            query_id: 0,
            parsed: ev.parsed,
            weather: ev.weather,
            suggestions: [],
            mock_mode: { llm: false, places: false, weather: false, search: false },
          };
          setResult({ ...partial });
        } else if (ev.type === "layer" && ev.items && partial) {
          partial = {
            ...partial,
            suggestions: [...partial.suggestions, ...ev.items],
          };
          setResult(partial);
        } else if (ev.type === "done") {
          partial = ev as unknown as SuggestResponse;
          setResult(partial);
          setStage(null);
        } else if (ev.type === "error") {
          throw new Error(ev.error ?? "Bilinmeyen hata");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line) handleEvent(JSON.parse(line));
        }
      }
      setLastText(rawText);
      setLocFix("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir sorun oluştu.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  // Konum yardımı: semti metne ekleyip yeniden ara
  function retryWithLocation(district: string) {
    const d = district.trim();
    if (!d) return;
    const combined = `${lastText} (konum: ${d})`;
    setText(combined);
    handleSubmit(combined);
  }

  // Tarayıcı konumu → Nominatim ile semte çevir
  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Tarayıcın konum paylaşımını desteklemiyor.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=tr`
          );
          const data = await res.json();
          const a = data.address ?? {};
          const district =
            a.suburb || a.quarter || a.city_district || a.town || a.county;
          if (district) retryWithLocation(district);
          else setError("Konumdan semt çıkarılamadı, elle yazar mısın?");
        } catch {
          setError("Konum çözümlenemedi, elle yazar mısın?");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Konum izni verilmedi — semtini elle yazabilirsin.");
      },
      { timeout: 8000 }
    );
  }

  const anyMock =
    result &&
    (result.mock_mode.llm ||
      result.mock_mode.places ||
      result.mock_mode.weather ||
      result.mock_mode.search);

  return (
    <div className="space-y-10">
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      <section className="text-center">
        {session && (
          <p className="mb-2 font-mono text-sm text-dusk-300">
            {greeting(new Date().getHours())},{" "}
            <span className="text-dusk-100">{session.user.name}</span> ☀️
          </p>
        )}
        <h1 className="font-display text-4xl font-semibold leading-tight text-dusk-100 sm:text-5xl">
          Bugün <span className="italic text-amber-glow">ne yapsak?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-dusk-200">
          Nerede olduğunu, kiminle olduğunu ve nasıl hissettiğini yaz —
          gerisini biz düşünelim.
        </p>
      </section>

      <section className="mx-auto max-w-2xl space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => guardAuth()}
          onKeyDown={(e) => {
            // Enter yeni satır açar; gönderme sadece butonla veya ⌘/Ctrl+Enter ile
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={`Örn: "${EXAMPLES[0]}"`}
          rows={3}
          className="w-full resize-none rounded-2xl border border-dusk-700 bg-dusk-900 p-4 text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.slice(1).map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  if (!guardAuth()) return;
                  setText(ex);
                  handleSubmit(ex);
                }}
                className="rounded-full border border-dusk-700 px-3 py-1 font-mono text-xs text-dusk-300 hover:border-dusk-600 hover:text-dusk-100"
              >
                {ex.slice(0, 38)}…
              </button>
            ))}
          </div>
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !text.trim()}
            className="btn-primary px-6 py-2 text-sm"
          >
            {loading ? "düşünüyorum…" : "öner bana"}
          </button>
        </div>
        {stage && (
          <p className="animate-pulse font-mono text-xs text-amber-soft">
            ⏳ {stage}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="space-y-8">
          {!result.parsed.location && (
            <div className="space-y-2 rounded-xl border border-amber-glow/40 bg-amber-glow/5 p-4">
              <p className="text-sm text-dusk-100">
                📍 Metinden semtini çıkaramadım — konumu bilirsem öneriler çok
                daha isabetli olur.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={locFix}
                  onChange={(e) => setLocFix(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && retryWithLocation(locFix)}
                  placeholder="Semt yaz (örn. Kadıköy)"
                  className="rounded-full border border-dusk-700 bg-dusk-900 px-4 py-1.5 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
                />
                <button
                  onClick={() => retryWithLocation(locFix)}
                  disabled={!locFix.trim() || loading}
                  className="btn-primary px-4 py-1.5 text-xs"
                >
                  bununla ara
                </button>
                <button
                  onClick={useMyLocation}
                  disabled={locating || loading}
                  className="rounded-full border border-teal-glow/50 px-4 py-1.5 font-mono text-xs text-teal-glow hover:bg-teal-glow/10 disabled:opacity-40"
                >
                  {locating ? "konum alınıyor…" : "📍 konumumu kullan"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dusk-700 bg-dusk-900/60 p-4 font-mono text-xs text-dusk-200">
            <Chip label={`konum: ${result.parsed.location ?? "belirsiz"}`} />
            <Chip label={`tarih: ${result.parsed.date_label}`} />
            <Chip label={`enerji: ${trEnergy(result.parsed.energy)}`} />
            <Chip label={`zaman: ${trTime(result.parsed.time_of_day)}`} />
            <Chip label={`bütçe: ${trBudget(result.parsed.budget)}`} />
            {result.parsed.companion && (
              <Chip label={`kiminle: ${trCompanion(result.parsed.companion)}`} />
            )}
            {result.parsed.time_limit && (
              <Chip label={`süre: ${result.parsed.time_limit}`} />
            )}
            <Chip
              label={`hava: ${result.weather.temp_c}°C ${result.weather.condition}`}
            />
            <button
              onClick={() => handleSubmit(lastText)}
              disabled={loading}
              className="ml-auto rounded-full border border-lavender/50 px-3 py-1 text-lavender transition-colors hover:bg-lavender/10 disabled:opacity-40"
            >
              {loading ? "üretiliyor…" : "🎲 başka öner"}
            </button>
          </div>

          {anyMock && (
            <p className="rounded-lg border border-lavender/30 bg-lavender/5 p-3 font-mono text-xs text-lavender">
              ⓘ Mock mod:{" "}
              {[
                result.mock_mode.llm && "LLM",
                result.mock_mode.places && "Places",
                result.mock_mode.weather && "Hava",
                result.mock_mode.search && "Arama",
              ]
                .filter(Boolean)
                .join(", ")}{" "}
              — API key eklenince gerçek veriye geçilecek.
            </p>
          )}

          {LAYERS.map(({ key, label, badge }) => {
            const items = result.suggestions.filter((s) => s.layer === key);
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <h2
                  className={`mb-3 inline-flex items-center rounded-full border border-dusk-700/50 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-dusk-100 ${badge}`}
                >
                  {label}
                  <span className="ml-2 rounded-full bg-dusk-900/70 px-2 py-0.5 text-[10px]">
                    {items.length}
                  </span>
                </h2>
                <div className="space-y-4">
                  {items.map((item) => (
                    <SuggestionCard
                      key={item.id ?? item.title}
                      item={item}
                      location={result.parsed.location}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-dusk-600 px-2.5 py-1">
      {label}
    </span>
  );
}

function trEnergy(e: string) {
  return { low: "düşük", medium: "orta", high: "yüksek" }[e] ?? e;
}
function trTime(t: string) {
  return { morning: "sabah", noon: "öğlen", evening: "akşam", night: "gece" }[t] ?? t;
}
function trBudget(b: string) {
  return { free: "ücretsiz", low: "düşük", medium: "orta", high: "yüksek" }[b] ?? b;
}
function trCompanion(c: string) {
  return {
    alone: "tek başına",
    couple: "çift",
    friends: "arkadaşlar",
    family: "aile",
  }[c] ?? c;
}
