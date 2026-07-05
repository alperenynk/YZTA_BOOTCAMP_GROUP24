import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  ParsedQuery,
  ExperienceStep,
  WeatherInfo,
  TimeOfDay,
} from "@/lib/types";

// Varsayılan: en yetenekli model. Maliyeti düşürmek için .env.local'de
// LOKAL_LLM_MODEL=claude-haiku-4-5 ayarlanabilir (~10 kat ucuz).
const MODEL = process.env.LOKAL_LLM_MODEL || "claude-opus-4-8";

function apiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key && key.trim() && !key.startsWith("your-") ? key : null;
}

export function isLlmMock(): boolean {
  return !apiKey();
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: apiKey()! });
  return _client;
}

// ---------------------------------------------------------------------------
// 1) Kullanıcı metnini yapılandırılmış sorguya çevirme
// ---------------------------------------------------------------------------

const ParsedQuerySchema = z.object({
  location: z
    .string()
    .nullable()
    .describe("Semt/mahalle adı, örn. 'Kadıköy'. Belirtilmemişse null."),
  target_date: z
    .string()
    .describe(
      "Hedef tarih, YYYY-MM-DD. 'yarın', 'cumartesi', 'hafta sonu' gibi ifadeleri bugünün tarihine göre çöz. Belirtilmemişse bugün."
    ),
  date_label: z
    .string()
    .describe(
      "Tarihin Türkçe kısa etiketi: 'bugün', 'yarın' veya '12 Temmuz Cumartesi' gibi."
    ),
  companion: z
    .enum(["alone", "couple", "friends", "family"])
    .nullable()
    .describe("Kiminle: tek başına / çift / arkadaş grubu / aile."),
  energy: z
    .enum(["low", "medium", "high"])
    .describe("Enerji seviyesi. 'Yorgunuz' → low."),
  time_of_day: z
    .enum(["morning", "noon", "evening", "night"])
    .describe("Günün zamanı. Belirtilmemişse şu anki saate göre tahmin et."),
  wants_crowd: z
    .boolean()
    .nullable()
    .describe("Kalabalık istiyor mu? Belirsizse null."),
  budget: z
    .enum(["free", "low", "medium", "high"])
    .describe("Bütçe ipucu. Belirtilmemişse 'medium'."),
  time_limit: z
    .string()
    .nullable()
    .describe("Zaman kısıtı, örn. '2 saat'. Yoksa null."),
  mobility: z
    .string()
    .nullable()
    .describe("Mobilite kısıtı, örn. 'arabasız', 'yürüyerek'. Yoksa null."),
});

const PARSE_SYSTEM = `Türkçe bir "bugün ne yapsak" metnini analiz eden bir asistansın.
Kullanıcının serbest metninden konum, hedef tarih, kiminle olduğu, enerji seviyesi,
günün zamanı, kalabalık tercihi, bütçe, zaman kısıtı ve mobilite bilgilerini çıkar.
Tarih ifadelerini ("yarın", "cumartesi", "hafta sonu", "15 Temmuz") sana verilen
bugünün tarihine göre YYYY-MM-DD biçimine çevir; tarih geçmiyorsa bugünü kullan.
Emin olamadığın alanlarda şemadaki varsayılanları ve null'ı kullan; uydurma.`;

export async function parseUserText(
  rawText: string,
  now: Date
): Promise<ParsedQuery> {
  if (isLlmMock()) return mockParse(rawText, now);

  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: PARSE_SYSTEM,
      output_config: { format: zodOutputFormat(ParsedQuerySchema) },
      messages: [
        {
          role: "user",
          content: `Bugünün tarihi: ${toIsoDate(now)} (${formatTrDate(now)}). Şu anki saat: ${now.getHours()}:00.\nKullanıcı metni: "${rawText}"`,
        },
      ],
    });
    if (response.parsed_output) return response.parsed_output;
  } catch (err) {
    console.error("LLM parse hatası, mock parser'a düşülüyor:", err);
  }
  return mockParse(rawText, now);
}

// ---------------------------------------------------------------------------
// 2) Etkinlik ayıklama — ham arama sonuçlarından hedef tarihe uyanları seç
// ---------------------------------------------------------------------------

export interface EventLike {
  title: string;
  meta: string;
  source_url: string | null;
}

const CuratedEventsSchema = z.object({
  ticketed: z
    .array(
      z.object({
        title: z.string().describe("Temizlenmiş etkinlik adı"),
        meta: z.string().describe("tür · saat · mekan · fiyat ipucu (bilinenler)"),
        source_url: z.string().nullable().describe("Kaynak URL, varsa"),
      })
    )
    .describe("Hedef tarihte gerçekten yapılacak biletli etkinlikler, en fazla 3."),
  free: z
    .array(
      z.object({
        title: z.string(),
        meta: z.string(),
        source_url: z.string().nullable(),
      })
    )
    .describe("Ücretsiz etkinlikler, en fazla 3."),
});

const CURATE_SYSTEM = `Sana bilet siteleri ve belediye kültür sayfalarından gelen ham arama
sonuçları verilecek. Görevin, kullanıcının hedef tarihinde GERÇEKTEN yapılacak etkinlikleri ayıklamak:
- Tarihi hedef tarihle uyuşmayan, geçmiş veya alakasız sonuçları ele.
- Süreli sergiler gibi "her gün açık" etkinlikler hedef tarihi kapsıyorsa kalabilir.
- Sonuç başlıklarını temizle (site adı, gereksiz ekler çıkar).
- meta alanına bildiğin kadarını yaz: tür · saat · mekan · fiyat ipucu. Bilmediğini uydurma.
- Emin olamadığın ama muhtemel görünen etkinliği meta'da "(tarihi teyit edilmeli)" notuyla bırakabilirsin.
- Hiçbir sonuç uygun değilse boş dizi dön.`;

export async function curateEvents(
  raw: { ticketed: EventLike[]; free: EventLike[] },
  parsed: ParsedQuery
): Promise<{ ticketed: EventLike[]; free: EventLike[] }> {
  const fallback = {
    ticketed: raw.ticketed.slice(0, 3),
    free: raw.free.slice(0, 3),
  };
  if (isLlmMock()) return fallback;

  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: CURATE_SYSTEM,
      output_config: { format: zodOutputFormat(CuratedEventsSchema) },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            hedef_tarih: parsed.target_date,
            tarih_etiketi: parsed.date_label,
            konum: parsed.location,
            ham_biletli_sonuclar: raw.ticketed,
            ham_ucretsiz_sonuclar: raw.free,
          }),
        },
      ],
    });
    if (response.parsed_output) return response.parsed_output;
  } catch (err) {
    console.error("LLM etkinlik ayıklama hatası, ham sonuçlara düşülüyor:", err);
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// 3) LLM Deneyim Paketi — ürünün ayırt edici özelliği
// ---------------------------------------------------------------------------

const ExperienceSchema = z.object({
  title: z.string().describe("Deneyim rotasının kısa, davetkar başlığı."),
  reason: z
    .string()
    .describe("Bu rota neden bu kullanıcıya uygun? 1-2 cümle, Türkçe."),
  steps: z
    .array(
      z.object({
        time: z.string().describe("Saat aralığı, örn. '19:00'"),
        title: z.string().describe("Adım başlığı"),
        description: z.string().describe("1-2 cümlelik yönlendirme"),
        place_query: z
          .string()
          .nullable()
          .describe(
            "Adım somut bir mekansa haritada aranabilir adı, örn. 'Yoğurtçu Parkı Kadıköy İstanbul'. Somut mekan değilse null."
          ),
      })
    )
    .describe("3-5 adımlık sıralı rota."),
});

const EXPERIENCE_SYSTEM = `Sen İstanbul'u iyi bilen yerel bir deneyim tasarımcısısın.
Kullanıcının bağlamına (konum, ruh hali, kiminle, bütçe, hava durumu, tarih) göre
adım adım, yürünebilir, gerçekçi bir mini deneyim rotası tasarla.
Sana "gercek_mekanlar" listesi verilirse rotanın adımlarında öncelikle bu gerçek
mekanları kullan ve adım başlığında mekan adını geçir. Listede uygun mekan yoksa
işletme adı uydurma; "sahil hattında bir çay bahçesi" gibi tarif et.
Sana "kullanici_profili" verilirse (geçmiş beğenilerden çıkarılmış karakter özeti)
rotayı bu profile göre eğ: sevdiği türleri öne çıkar, sevmediklerinden kaçın.
Yağmur varsa kapalı mekan ağırlıklı kur. Sıcak ve samimi bir Türkçe kullan.`;

export interface ExperiencePackage {
  title: string;
  reason: string;
  steps: ExperienceStep[];
}

export async function buildExperiencePackage(
  parsed: ParsedQuery,
  weather: WeatherInfo,
  venues: { title: string; meta: string }[] = [],
  profileSummary: string | null = null
): Promise<ExperiencePackage> {
  if (isLlmMock()) return mockExperience(parsed, weather);

  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: EXPERIENCE_SYSTEM,
      output_config: { format: zodOutputFormat(ExperienceSchema) },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            baglam: parsed,
            hava_durumu: {
              sicaklik: weather.temp_c,
              durum: weather.condition,
              yagmurlu: weather.is_rainy,
            },
            gercek_mekanlar: venues,
            kullanici_profili: profileSummary,
          }),
        },
      ],
    });
    if (response.parsed_output) return response.parsed_output;
  } catch (err) {
    console.error("LLM deneyim paketi hatası, mock'a düşülüyor:", err);
  }
  return mockExperience(parsed, weather);
}

// ---------------------------------------------------------------------------
// 4) Profil özeti — geçmiş geri bildirimlerden karakter profili
// ---------------------------------------------------------------------------

const ProfileSummarySchema = z.object({
  summary: z
    .string()
    .describe(
      "Kullanıcının zevk profili: 2-3 cümle, Türkçe, ikinci tekil şahıs olmadan. Örn: 'Akşam planlarını tercih ediyor, kalabalıktan kaçınıyor; canlı müzik ve sahil yürüyüşlerini seviyor, atölye etkinliklerine mesafeli.'"
    ),
});

const PROFILE_SYSTEM = `Bir deneyim öneri uygulamasının kullanıcısına ait geçmiş
aramaları ve geri bildirimleri (beğendi/beğenmedi + notlar) alacaksın.
Bunlardan kısa bir zevk profili çıkar: neleri seviyor, nelerden kaçınıyor,
hangi saatleri ve ortamları tercih ediyor. Sadece verilerden çıkarım yap, uydurma.`;

export async function summarizeProfileWithLlm(payload: {
  aramalar: unknown[];
  geri_bildirimler: unknown[];
}): Promise<string | null> {
  if (isLlmMock()) return null;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: PROFILE_SYSTEM,
      output_config: { format: zodOutputFormat(ProfileSummarySchema) },
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    return response.parsed_output?.summary ?? null;
  } catch (err) {
    console.error("LLM profil özeti hatası:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mock uygulamalar (API key yokken)
// ---------------------------------------------------------------------------

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTrDate(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(d);
}

const WEEKDAYS_TR: Record<string, number> = {
  pazartesi: 1,
  salı: 2,
  çarşamba: 3,
  perşembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 0,
};

function resolveDate(text: string, now: Date): { target_date: string; date_label: string } {
  const addDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  if (/öbür gün/.test(text)) {
    const d = addDays(2);
    return { target_date: toIsoDate(d), date_label: formatTrDate(d) };
  }
  if (/yarın/.test(text)) {
    return { target_date: toIsoDate(addDays(1)), date_label: "yarın" };
  }
  if (/hafta sonu/.test(text)) {
    // bir sonraki cumartesi (bugün cumartesi/pazar ise bugün)
    const day = now.getDay();
    const toSaturday = day === 6 || day === 0 ? 0 : 6 - day;
    const d = addDays(toSaturday);
    return {
      target_date: toIsoDate(d),
      date_label: toSaturday === 0 ? "bu hafta sonu (bugün)" : `hafta sonu · ${formatTrDate(d)}`,
    };
  }
  // gün adı: "cumartesi", "salı günü"... (bugünden sonraki ilk eşleşme)
  for (const [name, dow] of Object.entries(WEEKDAYS_TR)) {
    if (text.includes(name)) {
      // "cuma" kelimesi "cumartesi"nin içinde geçer — daha uzun eşleşme öncelikli
      if (name === "cuma" && text.includes("cumartesi")) continue;
      let diff = (dow - now.getDay() + 7) % 7;
      if (diff === 0 && !/bugün/.test(text)) diff = 7; // "salı" dendiyse ve bugün salıysa, gelecek salı
      const d = addDays(diff);
      return { target_date: toIsoDate(d), date_label: formatTrDate(d) };
    }
  }
  return { target_date: toIsoDate(now), date_label: "bugün" };
}

const KNOWN_DISTRICTS = [
  "kadıköy", "beşiktaş", "moda", "cihangir", "karaköy", "beyoğlu",
  "üsküdar", "bakırköy", "nişantaşı", "balat", "ortaköy", "bebek",
  "sarıyer", "fatih", "şişli", "taksim", "bostancı", "caddebostan",
];

function mockParse(rawText: string, now: Date): ParsedQuery {
  const text = rawText.toLocaleLowerCase("tr");
  const nowHour = now.getHours();

  const { target_date, date_label } = resolveDate(text, now);

  const district = KNOWN_DISTRICTS.find((d) => text.includes(d));
  const location = district
    ? district.charAt(0).toLocaleUpperCase("tr") + district.slice(1)
    : null;

  let companion: ParsedQuery["companion"] = null;
  if (/sevgili|eşim|kız arkadaş|erkek arkadaş|partnerim/.test(text)) companion = "couple";
  else if (/arkadaş|ekip|grup/.test(text)) companion = "friends";
  else if (/aile|çocuk|annem|babam/.test(text)) companion = "family";
  else if (/tek başıma|yalnız/.test(text)) companion = "alone";

  let energy: ParsedQuery["energy"] = "medium";
  if (/yorgun|bitkin|halsiz|sakin/.test(text)) energy = "low";
  else if (/enerjik|coşku|dans|parti|hareketli/.test(text)) energy = "high";

  let time_of_day: TimeOfDay;
  if (/sabah/.test(text)) time_of_day = "morning";
  else if (/öğle/.test(text)) time_of_day = "noon";
  else if (/akşam/.test(text)) time_of_day = "evening";
  else if (/gece/.test(text)) time_of_day = "night";
  else if (nowHour < 11) time_of_day = "morning";
  else if (nowHour < 16) time_of_day = "noon";
  else if (nowHour < 22) time_of_day = "evening";
  else time_of_day = "night";

  let wants_crowd: boolean | null = null;
  if (/kalabalık olmasın|sakin|sessiz|tenha/.test(text)) wants_crowd = false;
  else if (/kalabalık|canlı|hareketli/.test(text)) wants_crowd = true;

  let budget: ParsedQuery["budget"] = "medium";
  if (/ücretsiz|bedava|parasız/.test(text)) budget = "free";
  else if (/ucuz|bütçe|ekonomik|az para/.test(text)) budget = "low";
  else if (/lüks|pahalı|özel/.test(text)) budget = "high";

  const timeLimitMatch = text.match(/(\d+)\s*saat/);
  const time_limit = timeLimitMatch ? `${timeLimitMatch[1]} saat` : null;

  let mobility: string | null = null;
  if (/arabasız|araba yok|toplu taşıma/.test(text)) mobility = "toplu taşıma";
  else if (/yürüyerek|yürüme mesafesi/.test(text)) mobility = "yürüyerek";

  return {
    location,
    target_date,
    date_label,
    companion,
    energy,
    time_of_day,
    wants_crowd,
    budget,
    time_limit,
    mobility,
  };
}

function mockExperience(
  parsed: ParsedQuery,
  weather: WeatherInfo
): ExperiencePackage {
  const loc = parsed.location || "bulunduğun semt";
  const isEvening =
    parsed.time_of_day === "evening" || parsed.time_of_day === "night";
  // harita için: semt merkezi + biliniyorsa somut nokta
  const districtQ = parsed.location ? `${parsed.location}, İstanbul` : null;
  const shoreQ = /kadıköy|moda/i.test(loc)
    ? "Moda Sahili, Kadıköy, İstanbul"
    : districtQ;

  if (weather.is_rainy) {
    return {
      title: `${loc}'de Yağmurlu Gün Sığınağı`,
      reason:
        "Hava yağmurlu göründüğü için rotayı kapalı ve sıcak mekanlar üzerine kurduk; yorgunluğa iyi gelen, acele ettirmeyen bir akış.",
      steps: [
        { time: isEvening ? "18:30" : "13:00", title: "Sıcak bir başlangıç", description: "Ara sokaklarda camları buğulu, sakin bir kahveciye gir; pencere kenarına otur.", place_query: districtQ },
        { time: isEvening ? "19:30" : "14:00", title: "Sahaf & kitapçı molası", description: "Yakındaki bir sahafta 20 dakika amaçsız gezin; birbirinize kitap seçin." },
        { time: isEvening ? "20:30" : "15:30", title: "Küçük bir sofra", description: "Ev yemekleri yapan küçük bir lokantada erken ve keyifli bir yemek." },
        { time: isEvening ? "21:45" : "17:00", title: "Tatlı kapanış", description: "Fırından sıcak bir şeyler alıp yağmuru izleyerek günü kapatın." },
      ],
    };
  }

  if (parsed.energy === "low") {
    return {
      title: `${loc}'de Yavaş Akşam Rotası`,
      reason:
        "Yorgun olduğunuzu söylediniz; bu rota az yürüme, çok oturma ve iyi manzara üzerine kurulu. Çift için sakin, konuşmaya alan açan bir akış.",
      steps: [
        { time: "18:45", title: "Sahile inen yoldan yürüyüş", description: "Acele etmeden, vitrinlere baka baka sahile doğru inin.", place_query: districtQ },
        { time: "19:15", title: "Gün batımı noktası", description: "Sahilde bir banka ya da çimlere kurulun; termosunuz varsa çay, yoksa seyyar çaycı.", place_query: shoreQ },
        { time: "20:00", title: "Hafif bir akşam yemeği", description: "Sahil hattında sakin bir meze/makarna mekanında paylaşmalık birkaç tabak.", place_query: null },
        { time: "21:30", title: "Dondurma & dönüş yürüyüşü", description: "Elde dondurmayla ara sokaklardan yavaş bir dönüş; günü değerlendirin.", place_query: null },
      ],
    };
  }

  return {
    title: `${loc}'de Keşif Turu`,
    reason:
      "Enerjiniz yerinde göründüğü için rotada biraz yürüyüş, biraz keşif ve sürpriz molalar var.",
    steps: [
      { time: "17:30", title: "Ara sokak keşfi", description: "Ana caddeyi bırakıp ara sokaklara dalın; ilginç bir dükkan bulma oyunu oynayın.", place_query: districtQ },
      { time: "18:30", title: "Üçüncü dalga kahve molası", description: "Denk geldiğiniz bağımsız bir kahvecide ayakta hızlı bir mola." },
      { time: "19:30", title: "Sokak lezzetleri turu", description: "Tek mekanda oturmak yerine 2-3 durakta paylaşarak atıştırın." },
      { time: "21:00", title: "Canlı müzik araması", description: "Sesin geldiği yöne yürüyün; küçük bir barda canlı müzikle kapanış." },
    ],
  };
}
