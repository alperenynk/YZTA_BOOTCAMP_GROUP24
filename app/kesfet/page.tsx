"use client";

import { useEffect, useRef, useState } from "react";
import SuggestionCard from "../components/SuggestionCard";
import LoginModal from "../components/LoginModal";
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

const PLACEHOLDER =
  "Sevgilimle Kadıköy'deyiz, biraz yorgunuz, akşamı değerlendirmek istiyoruz";

// Hazır mod kartları — tıklayınca hazır metinle arama yapar
const MOODS = [
  {
    emoji: "🌅",
    title: "Gün batımı & sahil",
    desc: "sakin bir akşam",
    text: "Sahilde gün batımı izleyip sakin bir akşam geçirmek istiyorum",
    card: "card-venue",
  },
  {
    emoji: "🎉",
    title: "Enerjik gece",
    desc: "müzik & hareket",
    text: "Enerjim yüksek, canlı müzik olan hareketli bir gece istiyorum",
    card: "card-ticketed",
  },
  {
    emoji: "🎭",
    title: "Kültür turu",
    desc: "sergi & sahne",
    text: "Bugün sergi, tiyatro ya da kültürel bir şeyler yapmak istiyorum",
    card: "card-experience",
  },
  {
    emoji: "💸",
    title: "Sıfır bütçe",
    desc: "ücretsiz keyif",
    text: "Hiç para harcamadan güzel vakit geçirmek istiyorum",
    card: "card-free",
  },
];

interface RecentSearch {
  id: number;
  raw_text: string;
  parsed_location: string | null;
  created_at: string;
}

interface TeaserPost {
  id: number;
  user_name: string;
  suggestion_title: string | null;
  content: string | null;
}

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
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [teaser, setTeaser] = useState<TeaserPost[]>([]);
  const [showGroup, setShowGroup] = useState(false);
  const [companionsInput, setCompanionsInput] = useState("");
  const [friends, setFriends] = useState<{ id: number; name: string; email: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [reviseText, setReviseText] = useState("");
  const [revising, setRevising] = useState(false);
  const [today, setToday] = useState<{
    district: string;
    temp_c: number;
    condition: string;
    is_rainy: boolean;
    is_mock: boolean;
  } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // hedefli tarih seçimi: seçilmeden arama yapılamaz; metinde "bugün/yarın/hafta sonu"
  // geçiyorsa kullanıcı elle seçmemişse otomatik işaretlenir
  const [dateMode, setDateMode] = useState<
    "none" | "today" | "tomorrow" | "weekend" | "custom"
  >("none");
  const [dateTouched, setDateTouched] = useState(false);
  const [customDate, setCustomDate] = useState("");

  function localIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function targetDateFor(): string | undefined {
    const now = new Date();
    if (dateMode === "today") return localIso(now);
    if (dateMode === "tomorrow") {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return localIso(t);
    }
    if (dateMode === "weekend") {
      const t = new Date(now);
      const day = t.getDay();
      t.setDate(t.getDate() + (day === 6 || day === 0 ? 0 : 6 - day));
      return localIso(t);
    }
    if (dateMode === "custom" && customDate) return customDate;
    return undefined;
  }

  // metinden "bugün/yarın/hafta sonu" geçiyorsa tarihi otomatik entegre et —
  // kullanıcı elle bir tarih seçtiyse (dateTouched) artık üzerine yazma
  useEffect(() => {
    if (dateTouched) return;
    const t = text.toLowerCase();
    if (/\byarın\b/.test(t)) setDateMode("tomorrow");
    else if (/hafta ?sonu/.test(t)) setDateMode("weekend");
    else if (/\bbug[üu]n\b/.test(t)) setDateMode("today");
  }, [text, dateTouched]);

  // sesli arama
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function toggleRecording() {
    if (!guardAuth()) return;
    if (recording) {
      mediaRecorderRef.current?.stop(); // onstop akışı devralır
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        setError(null);
        try {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const form = new FormData();
          form.set("audio", blob, "voice.webm");
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: form,
          });
          if (res.status === 401) {
            setShowLogin(true);
            return;
          }
          const d = await res.json();
          if (!res.ok) throw new Error(d.error ?? "Ses çözümlenemedi.");
          setText((prev) => (prev.trim() ? prev.trim() + " " : "") + d.text);
          textareaRef.current?.focus();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ses çözümlenemedi.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Mikrofona erişilemedi — tarayıcı iznini kontrol eder misin?");
    }
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Boş sayfayı dolduran veriler: son aramalar (girişliyse) + topluluk önizlemesi
  useEffect(() => {
    fetch("/api/feed")
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setTeaser((d.posts ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/my-searches")
      .then((r) => (r.ok ? r.json() : { searches: [] }))
      .then((d) => setRecent(d.searches ?? []))
      .catch(() => {});
    fetch("/api/friends")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFriends(d.friends ?? []))
      .catch(() => {});
    fetch("/api/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setToday(d))
      .catch(() => {});
    // ilk giriş turu: daha önce görmemişse göster
    try {
      if (!localStorage.getItem("lokal-onboarded")) setShowOnboarding(true);
    } catch {}
  }, [session]);

  function dismissOnboarding() {
    setShowOnboarding(false);
    try {
      localStorage.setItem("lokal-onboarded", "1");
    } catch {}
  }

  // Deneyim paketini sohbet modunda revize et
  async function handleRevise() {
    const instruction = reviseText.trim();
    if (!instruction || !result || revising) return;
    setRevising(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_id: result.query_id, instruction }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Revize edilemedi.");
      // eski deneyim paketini yenisiyle değiştir
      setResult((prev) =>
        prev
          ? {
              ...prev,
              suggestions: [
                ...prev.suggestions.filter((s) => s.layer !== "experience"),
                d.suggestion,
              ],
            }
          : prev
      );
      setReviseText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir sorun oluştu.");
    } finally {
      setRevising(false);
    }
  }

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
  // dateOverride: aynı tık anında tarihi de ayarlayan hızlı-başlat akışları için
  // (setDateMode'un React state'i asenkron güncellemesi yüzünden dateMode'a güvenilemez)
  async function handleSubmit(input?: string, dateOverride?: string) {
    const rawText = (input ?? text).trim();
    if (!rawText || loading) return;
    if (!guardAuth()) return;
    const targetDate = dateOverride ?? targetDateFor();
    if (!targetDate) {
      setError("Aramadan önce bir tarih seç: bugün, yarın, hafta sonu ya da özel bir tarih.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStage("başlıyor…");
    try {
      // Grup planı: seçili arkadaşlar + elle yazılan e-postalar
      const companions = [
        ...new Set([
          ...selectedFriends,
          ...companionsInput.split(",").map((s) => s.trim()).filter(Boolean),
        ]),
      ];

      const res = await fetch("/api/suggest/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: rawText,
          companions,
          target_date: targetDate,
        }),
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

      {/* ilk giriş turu */}
      {session && showOnboarding && (
        <section className="app-panel mx-auto max-w-2xl p-5">
          <div className="flex items-start justify-between">
            <p className="font-display text-lg font-semibold text-dusk-100">
              Lokál&apos;e hoş geldin! 3 adımda:
            </p>
            <button
              onClick={dismissOnboarding}
              aria-label="Turu kapat"
              className="text-dusk-300 hover:text-dusk-100"
            >
              ✕
            </button>
          </div>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            <li className="rounded-2xl bg-dusk-800 p-3 text-sm text-dusk-100">
              <span className="text-xl">✍️</span>
              <p className="mt-1 font-medium">Anlat</p>
              <p className="text-xs text-dusk-200">
                &quot;Yorgunum, Kadıköy&apos;deyim&quot; gibi — nasıl hissettiğini yaz
              </p>
            </li>
            <li className="rounded-2xl bg-dusk-800 p-3 text-sm text-dusk-100">
              <span className="text-xl">🧭</span>
              <p className="mt-1 font-medium">Önerini al</p>
              <p className="text-xs text-dusk-200">
                Etkinlik, mekan ve adım adım deneyim rotası
              </p>
            </li>
            <li className="rounded-2xl bg-dusk-800 p-3 text-sm text-dusk-100">
              <span className="text-xl">💚</span>
              <p className="mt-1 font-medium">Yaşa & değerlendir</p>
              <p className="text-xs text-dusk-200">
                &quot;Gittim&quot; dedikçe öneriler sana göre şekillenir
              </p>
            </li>
          </ol>
          <button
            onClick={() => {
              dismissOnboarding();
              setText(PLACEHOLDER);
              setDateMode("today");
              setDateTouched(true);
              handleSubmit(PLACEHOLDER, localIso(new Date()));
            }}
            className="btn-primary mt-3 px-5 py-1.5 text-xs"
          >
            örnekle dene →
          </button>
        </section>
      )}

      <section className="app-hero">
        <div className="app-hero-inner">
          <span className="app-eyebrow mx-auto mb-4 justify-center">
            Yapay zekâ destekli şehir küratörü
          </span>
          {session && (
            <p className="mb-2 font-mono text-sm text-dusk-300">
              {greeting(new Date().getHours())},{" "}
              <span className="text-dusk-100">{session.user.name}</span> ☀️
            </p>
          )}
          {session && today && (
            <p className="mb-3 inline-block rounded-full border border-dusk-700 bg-dusk-900/70 px-4 py-1.5 font-mono text-xs text-dusk-200">
              {today.is_rainy ? "🌧" : "☀️"} Bugün {today.district}&apos;de{" "}
              {today.temp_c}°C, {today.condition}
              {!today.is_rainy && " — açık hava planına uygun"}
              {today.is_mock && (
                <span className="text-dusk-300"> · demo verisi</span>
              )}
            </p>
          )}
          <h1 className="font-display text-5xl font-semibold leading-[0.95] text-dusk-100 sm:text-6xl">
            Bugün <span className="italic text-amber-glow">ne yapsak?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-dusk-200">
            Nerede olduğunu, kiminle olduğunu ve nasıl hissettiğini yaz —
            gerisini biz düşünelim.
          </p>
        </div>
      </section>

      <section className="app-glass mx-auto max-w-2xl space-y-3 p-6 sm:p-8">
        <span className="app-glass-tag">
          <i /> Canlı Kürasyon Motoru
        </span>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => guardAuth()}
            aria-label="Plan isteğin — nerede olduğunu ve nasıl hissettiğini yaz"
            onKeyDown={(e) => {
              // Enter yeni satır açar; gönderme sadece butonla veya ⌘/Ctrl+Enter ile
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Örn: "${PLACEHOLDER}"`}
            rows={3}
            className="w-full resize-none rounded-2xl border border-dusk-700 bg-dusk-900/80 p-4 pr-14 text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={transcribing}
            aria-label={
              recording
                ? "Kaydı durdur"
                : transcribing
                  ? "Ses çözümleniyor"
                  : "Sesli anlat — mikrofonla konuş"
            }
            title={
              recording
                ? "Kaydı durdur"
                : transcribing
                  ? "Ses çözümleniyor…"
                  : "Sesli anlat"
            }
            className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border text-base transition-colors ${
              recording
                ? "animate-pulse border-red-400 bg-red-400/10 text-red-400"
                : "border-dusk-700 text-dusk-300 hover:border-amber-glow hover:text-amber-glow"
            } disabled:opacity-50`}
          >
            {recording ? "⏹" : transcribing ? "⏳" : "🎙"}
          </button>
        </div>
        {/* hedefli tarih seçimi — zorunlu */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-dusk-300">
            📅 ne zaman: *
          </span>
          {(
            [
              ["today", "bugün"],
              ["tomorrow", "yarın"],
              ["weekend", "hafta sonu"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setDateMode(mode);
                setCustomDate("");
                setDateTouched(true);
              }}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                dateMode === mode
                  ? "border-amber-glow bg-amber-glow/10 text-amber-glow"
                  : "border-dusk-700 text-dusk-300 hover:border-dusk-600"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={customDate}
            min={localIso(new Date())}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setDateMode(e.target.value ? "custom" : "none");
              setDateTouched(true);
            }}
            aria-label="Belirli bir tarih seç"
            className={`rounded-full border bg-dusk-900 px-3 py-1 font-mono text-xs transition-colors focus:border-amber-glow focus:outline-none ${
              dateMode === "custom"
                ? "border-amber-glow text-amber-glow"
                : "border-dusk-700 text-dusk-300"
            }`}
          />
          {dateMode === "none" && (
            <span className="font-mono text-[10px] text-dusk-300">
              tarih seçmeden aranamaz
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              if (!guardAuth()) return;
              setShowGroup((v) => !v);
            }}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
              showGroup || companionsInput
                ? "border-amber-glow text-amber-glow"
                : "border-dusk-700 text-dusk-300 hover:border-dusk-600"
            }`}
          >
            👥 birlikte planla
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !text.trim() || dateMode === "none"}
            className="btn-primary px-6 py-2 text-sm"
          >
            {loading ? "düşünüyorum…" : "öner bana"}
          </button>
        </div>

        {showGroup && (
          <div className="app-panel p-4">
            <p className="mb-2 text-sm text-dusk-100">
              👥 Grup planı: arkadaşlarını seç — herkesin zevkine uyan ortak
              öneri üretelim.
            </p>
            {friends.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {friends.map((f) => {
                  const on = selectedFriends.has(f.email);
                  return (
                    <button
                      key={f.id}
                      onClick={() =>
                        setSelectedFriends((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(f.email);
                          else if (next.size < 3) next.add(f.email);
                          return next;
                        })
                      }
                      className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                        on
                          ? "border-amber-glow bg-amber-glow/10 text-amber-glow"
                          : "border-dusk-700 text-dusk-300 hover:border-dusk-600"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {f.name}
                    </button>
                  );
                })}
              </div>
            )}
            <input
              value={companionsInput}
              onChange={(e) => setCompanionsInput(e.target.value)}
              placeholder={
                friends.length > 0
                  ? "ya da e-postayla ekle: arkadas@mail.com"
                  : "arkadas@mail.com, digeri@mail.com (en fazla 3)"
              }
              className="w-full rounded-full border border-dusk-700 bg-dusk-950 px-4 py-2 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
            />
            <p className="mt-1.5 font-mono text-[10px] text-dusk-300">
              not: arkadaşının Lokál&apos;e kayıtlı olması gerekir; profili
              varsa öneriler ona göre de eğilir
            </p>
          </div>
        )}
        {stage && (
          <p className="animate-pulse font-mono text-xs text-amber-soft">
            ⏳ {stage}
          </p>
        )}
        {loading && !result && (
          <div className="space-y-3 pt-2">
            <div className="skeleton h-10 rounded-2xl" />
            <div className="skeleton h-28 rounded-3xl" />
            <div className="skeleton h-28 rounded-3xl" />
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>

      {/* girişsiz ziyaretçiye: nasıl çalışır */}
      {!isPending && !session && !result && (
        <section className="mx-auto max-w-2xl">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { e: "✍️", t: "Anlat", d: "Nerede olduğunu ve nasıl hissettiğini yaz" },
              { e: "🧭", t: "Rotanı al", d: "Etkinlik + mekan + adım adım deneyim paketi" },
              { e: "💚", t: "Kişiselleşsin", d: "Gittikçe zevkini öğrenir, sana göre önerir" },
            ].map((c) => (
              <div
                key={c.t}
                className="app-panel p-4 text-center"
              >
                <span className="text-2xl">{c.e}</span>
                <p className="mt-1 font-display font-semibold text-dusk-100">{c.t}</p>
                <p className="mt-0.5 text-xs text-dusk-200">{c.d}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Boş durum: hazır modlar + son aramalar + topluluk ---- */}
      {!result && !loading && (
        <>
          <section className="mx-auto max-w-2xl">
            <h2 className="app-eyebrow mb-3">
              Bir modla hızlı başla
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MOODS.map((m) => (
                <button
                  key={m.title}
                  onClick={() => {
                    if (!guardAuth()) return;
                    setText(m.text);
                    setDateMode("today");
                    setDateTouched(true);
                    handleSubmit(m.text, localIso(new Date()));
                  }}
                  className={`rounded-3xl border border-dusk-700/50 p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${m.card}`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <p className="mt-2 text-sm font-semibold leading-tight text-dusk-100">
                    {m.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-dusk-200">
                    {m.desc}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
            {recent.length > 0 && (
              <div>
                <h2 className="app-eyebrow mb-3">
                  Son aramaların
                </h2>
                <ul className="space-y-2">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setText(r.raw_text);
                          textareaRef.current?.focus();
                        }}
                        className={`app-panel w-full px-4 py-3 text-left text-sm text-dusk-100 transition-colors hover:border-amber-glow/60`}
                        title="Metne yükle — düzenleyip 'öner bana' ile ara"
                      >
                        <span className="mr-1.5">↻</span>
                        {r.raw_text.length > 60
                          ? r.raw_text.slice(0, 60) + "…"
                          : r.raw_text}
                        {r.parsed_location && (
                          <span className="ml-1 font-mono text-[10px] text-teal-glow">
                            · {r.parsed_location}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {teaser.length > 0 && (
              <div className={recent.length === 0 ? "sm:col-span-2" : ""}>
                <h2 className="app-eyebrow mb-3">
                  Topluluktan
                </h2>
                <ul className="space-y-2">
                  {teaser.map((p) => (
                    <li
                      key={p.id}
                      className="app-panel px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-amber-glow">
                        {p.user_name}
                      </span>{" "}
                      {p.suggestion_title ? (
                        <span className="text-dusk-200">
                          “{p.suggestion_title}” deneyimine gitti
                        </span>
                      ) : (
                        <span className="text-dusk-200">bir anı paylaştı</span>
                      )}
                      {p.content && (
                        <p className="mt-1 truncate text-xs italic text-dusk-300">
                          “{p.content}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <a
                  href="/feed"
                  className="mt-2 inline-block font-mono text-xs text-teal-glow hover:underline"
                >
                  akışa git →
                </a>
              </div>
            )}
          </section>
        </>
      )}

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
            {(result.parsed.interests ?? []).length > 0 && (
              <Chip label={`ilgi: ${result.parsed.interests.join(", ")}`} />
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

          {/* sohbet modu: deneyim paketini revize et */}
          {result.query_id > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dusk-700 bg-dusk-900 p-3">
              <span className="font-mono text-xs text-dusk-300">✏️ pakete yön ver:</span>
              <input
                value={reviseText}
                onChange={(e) => setReviseText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRevise()}
                placeholder='örn. "daha ucuz olsun", "yürüme mesafesinde kalsın"'
                maxLength={200}
                className="min-w-0 flex-1 rounded-full border border-dusk-700 bg-dusk-950 px-4 py-1.5 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
              />
              <button
                onClick={handleRevise}
                disabled={revising || !reviseText.trim()}
                className="btn-primary px-4 py-1.5 text-xs"
              >
                {revising ? "revize ediliyor…" : "rotayı güncelle"}
              </button>
            </div>
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

          {/* akış sürerken: daha fazla öneri geldiğini açıkça belirt */}
          {loading && (
            <div className="app-panel space-y-4 border-amber-glow/30 p-4">
              <p className="flex items-center gap-2 font-mono text-xs text-amber-soft">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-glow" />
                {stage ?? "diğer öneriler hazırlanıyor…"}
              </p>
              <div className="skeleton h-28 rounded-3xl" />
              <div className="skeleton h-20 rounded-3xl" />
            </div>
          )}
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
