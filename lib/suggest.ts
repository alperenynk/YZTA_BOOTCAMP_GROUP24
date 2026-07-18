import { getDb } from "@/lib/db";
import {
  parseUserText,
  buildExperiencePackage,
  curateEvents,
  isLlmMock,
  toIsoDate,
  formatTrDate,
} from "@/lib/llm";
import { getLatestProfileSummary } from "@/lib/profile";
import { getStoredEvents } from "@/lib/events";
import { getWeather, isWeatherMock } from "@/lib/services/weather";
import { getVenues, isPlacesMock } from "@/lib/services/places";
import { searchEvents, isSearchMock } from "@/lib/services/search";
import type {
  ParsedQuery,
  SuggestionItem,
  SuggestResponse,
  WeatherInfo,
} from "@/lib/types";

const COMPANION_TR: Record<string, string> = {
  alone: "tek başına",
  couple: "çift olarak",
  friends: "arkadaşlarla",
  family: "aileyle",
};

const TIME_TR: Record<string, string> = {
  morning: "sabah",
  noon: "öğlen",
  evening: "akşam",
  night: "gece",
};

// Seçilen tarihi kullanıcı diline çevir: bugün / yarın / "18 Temmuz Cuma"
function labelForDate(iso: string): string {
  const today = toIsoDate(new Date());
  if (iso === today) return "bugün";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === toIsoDate(tomorrow)) return "yarın";
  return formatTrDate(new Date(iso + "T12:00:00"));
}

// ---------------------------------------------------------------------------
// Tarih doğrulama: LLM ayıklaması (curateEvents) hedef tarihe uymayan sonuçları
// kaçırabiliyor — burada metinde geçen somut bir tarih varsa deterministik
// olarak da kontrol edip hedef tarihle çelişenleri eleriz. Metinde hiç tarih
// geçmiyorsa (belirsiz/süreli etkinlik) dokunmayız.
// ---------------------------------------------------------------------------
const TR_MONTHS = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
];

function extractDatesMentioned(text: string): { day: number; month: number }[] {
  const lower = text.toLocaleLowerCase("tr");
  const found: { day: number; month: number }[] = [];

  const monthRe = new RegExp(`\\b(\\d{1,2})\\s+(${TR_MONTHS.join("|")})\\b`, "g");
  for (const m of lower.matchAll(monthRe)) {
    const day = parseInt(m[1], 10);
    const month = TR_MONTHS.indexOf(m[2]) + 1;
    if (day >= 1 && day <= 31) found.push({ day, month });
  }

  const numRe = /\b(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?\b/g;
  for (const m of lower.matchAll(numRe)) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) found.push({ day, month });
  }

  return found;
}

function matchesTargetDate(text: string, targetIso: string): boolean {
  const dates = extractDatesMentioned(text);
  if (dates.length === 0) return true; // belirsiz — reddetmek yerine kalsın
  const [, tm, td] = targetIso.split("-").map(Number);
  return dates.some((d) => d.day === td && d.month === tm);
}

function filterByTargetDate<T extends { title: string; meta: string }>(
  items: T[],
  targetIso: string
): T[] {
  return items.filter((i) => matchesTargetDate(`${i.title} ${i.meta}`, targetIso));
}

function contextPhrase(parsed: ParsedQuery, weather: WeatherInfo): string {
  const parts: string[] = [];
  if (parsed.companion) parts.push(COMPANION_TR[parsed.companion]);
  if (parsed.energy === "low") parts.push("enerjiniz düşükken");
  if (parsed.energy === "high") parts.push("enerjiniz yüksekken");
  const when =
    parsed.date_label === "bugün"
      ? TIME_TR[parsed.time_of_day]
      : `${parsed.date_label} ${TIME_TR[parsed.time_of_day]}`;
  parts.push(`${when} saatleri için`);
  if (weather.is_rainy) parts.push("yağmurlu havada");
  return parts.join(", ");
}

function buildReason(
  layer: "ticketed" | "free" | "venue",
  item: { title: string; meta: string },
  parsed: ParsedQuery,
  weather: WeatherInfo
): string {
  const ctx = contextPhrase(parsed, weather);
  const isQuiet = parsed.wants_crowd === false;
  const meta = item.meta.toLocaleLowerCase("tr");

  const bits: string[] = [];
  if (layer === "ticketed") {
    bits.push(`${ctx} planlı bir etkinlik arıyorsanız iyi bir seçenek`);
    if (parsed.budget === "free" || parsed.budget === "low")
      bits.push("bütçenizi zorlamadan önce fiyatı kontrol etmenizi öneririz");
  } else if (layer === "free") {
    bits.push(`${ctx} cüzdana dokunmadan vakit geçirme fırsatı`);
    if (parsed.budget === "free") bits.push("ücretsiz tercihinize birebir uyuyor");
  } else {
    bits.push(`${ctx} uygun bir mekan`);
    if (meta.includes("sakin") && (isQuiet || parsed.energy === "low"))
      bits.push("sakin atmosferi düşük enerjili bir plana iyi oturuyor");
    if (meta.includes("açık hava") && !weather.is_rainy)
      bits.push(`hava ${weather.condition} olduğu için açık hava keyfi yapılabilir`);
    if (meta.includes("kapalı") && weather.is_rainy)
      bits.push("yağmura karşı kapalı mekan güvenli liman");
  }
  const sentence = bits.join("; ");
  return sentence.charAt(0).toLocaleUpperCase("tr") + sentence.slice(1) + ".";
}

/** Streaming arayüz için ara aşama olayları (NDJSON satırları olarak yollanır). */
export type PipelineEvent =
  | { type: "stage"; label: string }
  | { type: "parsed"; parsed: ParsedQuery; weather: WeatherInfo }
  | { type: "layer"; items: SuggestionItem[] };

export interface CompanionProfile {
  name: string;
  summary: string | null;
}

export async function runSuggestionPipeline(
  rawText: string,
  userId: number,
  emit?: (event: PipelineEvent) => void,
  companions: CompanionProfile[] = [],
  dateOverride?: string // kullanıcı arayüzden tarih seçtiyse (YYYY-MM-DD)
): Promise<SuggestResponse> {
  // 1) LLM parsing (tarih çözümlemesi için bugünün tarihi de gider)
  emit?.({ type: "stage", label: "seni anlamaya çalışıyorum…" });
  const parsed = await parseUserText(rawText, new Date());

  // Arayüzden seçilen tarih, metinden çıkarılanı ezer — daha hedefli arama
  if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
    parsed.target_date = dateOverride;
    parsed.date_label = labelForDate(dateOverride);
  }

  // Konum çıkarılamadıysa kullanıcının profilindeki semte düş
  if (!parsed.location) {
    const home = getDb()
      .prepare("SELECT home_district FROM users WHERE id = ?")
      .get(userId) as { home_district: string | null } | undefined;
    if (home?.home_district) parsed.location = home.home_district;
  }

  // 2) Paralel servis çağrıları (hava durumu önce — mekan filtresi ona bağlı)
  const weather = await getWeather(parsed);
  emit?.({ type: "parsed", parsed, weather });
  emit?.({ type: "stage", label: "mekanlar ve etkinlikler aranıyor…" });

  // Profil: tek kişiyse kendi özeti; grup planıysa herkesinki birlikte
  const ownSummary = getLatestProfileSummary(userId);
  const profileSummary =
    companions.length > 0
      ? [
          ownSummary && `Plan sahibi: ${ownSummary}`,
          ...companions.map(
            (c) => `${c.name}: ${c.summary ?? "henüz profil özeti yok"}`
          ),
        ]
          .filter(Boolean)
          .join("\n")
      : ownSummary;

  // Etkinlikler: önce kendi veritabanımız (cron doldurur), yetmezse canlı arama.
  // Özel ilgi varsa ("heykel workshop") genel DB'yi atla — canlı hedefli arama yap.
  const stored =
    (parsed.interests ?? []).length > 0
      ? { ticketed: [], free: [], enough: false }
      : getStoredEvents(parsed.target_date, parsed.location);

  const [venues, rawEvents] = await Promise.all([
    getVenues(parsed, weather),
    stored.enough ? Promise.resolve(stored) : searchEvents(parsed),
  ]);

  const venueSuggestions: SuggestionItem[] = venues.map((v) => ({
    ...v,
    layer: "venue" as const,
    reason_text: buildReason("venue", v, parsed, weather),
  }));
  emit?.({ type: "layer", items: venueSuggestions });
  emit?.({ type: "stage", label: "etkinlikler ayıklanıyor, rota tasarlanıyor…" });

  // 3) LLM adımları: ham arama sonuçlarından tarihe uyanları ayıkla
  //    (kendi DB'mizden geldiyse zaten temiz — ayıklama atlanır) +
  //    gerçek mekanları ve profilleri deneyim rotasına besle
  const eventsPromise = (
    stored.enough
      ? Promise.resolve({ ticketed: stored.ticketed, free: stored.free })
      : curateEvents(rawEvents, parsed)
  ).then((ev) => {
    // LLM ayıklaması bazen tarihi uyuşmayan sonuçları kaçırıyor — burada
    // metinde geçen somut bir tarih varsa hedef tarihle çelişenleri deterministik
    // olarak da eleriz (aynı gün farklı tarihli etkinliklerin karışmasını önler).
    const ticketed = filterByTargetDate(ev.ticketed, parsed.target_date);
    const free = filterByTargetDate(ev.free, parsed.target_date);
    const items: SuggestionItem[] = [
      ...ticketed.map((e) => ({
        ...e,
        layer: "ticketed" as const,
        reason_text: buildReason("ticketed", e, parsed, weather),
      })),
      ...free.map((e) => ({
        ...e,
        layer: "free" as const,
        reason_text: buildReason("free", e, parsed, weather),
      })),
    ];
    emit?.({ type: "layer", items });
    return items;
  });

  const experiencePromise = buildExperiencePackage(
    parsed,
    weather,
    venues,
    profileSummary
  ).then((exp) => {
    const item: SuggestionItem = {
      layer: "experience" as const,
      title: exp.title,
      meta: "LLM deneyim paketi · adım adım rota",
      reason_text: exp.reason,
      source_url: null,
      steps: exp.steps,
    };
    emit?.({ type: "layer", items: [item] });
    return item;
  });

  const [eventSuggestions, experienceSuggestion] = await Promise.all([
    eventsPromise,
    experiencePromise,
  ]);

  // 4) 4 katmanlı öneri paketi
  const suggestions: SuggestionItem[] = [
    ...eventSuggestions,
    ...venueSuggestions,
    experienceSuggestion,
  ];

  // 5) Veritabanına kaydet
  const db = getDb();
  const queryId = db.transaction(() => {
    const q = db
      .prepare(
        `INSERT INTO queries
           (user_id, raw_text, parsed_location, parsed_mood, parsed_companion, parsed_time, parsed_budget, target_date, parsed_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        rawText,
        parsed.location,
        parsed.energy,
        parsed.companion,
        parsed.time_of_day,
        parsed.budget,
        parsed.target_date,
        JSON.stringify(parsed)
      );
    const qid = Number(q.lastInsertRowid);

    const insert = db.prepare(
      `INSERT INTO suggestions (query_id, layer, title, meta, reason_text, source_url, steps_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of suggestions) {
      const res = insert.run(
        qid,
        s.layer,
        s.title,
        s.meta,
        s.reason_text,
        s.source_url,
        s.steps ? JSON.stringify(s.steps) : null
      );
      s.id = Number(res.lastInsertRowid);
    }
    return qid;
  })();

  return {
    query_id: queryId,
    parsed,
    weather,
    suggestions,
    mock_mode: {
      llm: isLlmMock(),
      places: isPlacesMock(),
      weather: isWeatherMock(),
      search: isSearchMock(),
    },
  };
}
