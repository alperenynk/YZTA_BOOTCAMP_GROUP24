import type { ParsedQuery, SuggestionItem } from "@/lib/types";

type EventResult = Omit<SuggestionItem, "layer" | "reason_text">;

// Alan kısıtlı arama: alakasız blog/haber sonuçlarını en baştan ele
const TICKET_DOMAINS = [
  "biletix.com",
  "bubilet.com.tr",
  "passo.com.tr",
  "biletinial.com",
  "mobilet.com",
];

const FREE_EVENT_DOMAINS = [
  "kultur.istanbul", // İBB Kültür
  "kulturportali.gov.tr",
  "kadikoy.bel.tr",
  "besiktas.bel.tr",
  "sisli.bel.tr",
  "uskudar.bel.tr",
  "beyoglu.bel.tr",
  "ibb.istanbul",
];

function tavilyKey(): string | null {
  const key = process.env.TAVILY_API_KEY;
  return key && key.trim() && !key.startsWith("your-") ? key : null;
}

function serperKey(): string | null {
  const key = process.env.SERPER_API_KEY;
  return key && key.trim() && !key.startsWith("your-") ? key : null;
}

export function isSearchMock(): boolean {
  return !tavilyKey() && !serperKey();
}

const MOCK_TICKETED: EventResult[] = [
  {
    title: "Akustik Akşam: Şehir Sahnesi Konseri",
    meta: "konser · 20:30 · ₺₺ · bilet gerekli",
    source_url: "https://example.com/bilet/akustik-aksam",
  },
  {
    title: "Kara Komedi Tek Kişilik Oyun",
    meta: "tiyatro · 20:00 · ₺₺ · sınırlı koltuk",
    source_url: "https://example.com/bilet/kara-komedi",
  },
  {
    title: "Seramik Atölyesi: Kendi Kupanı Yap",
    meta: "workshop · 19:00 · ₺₺₺ · malzeme dahil",
    source_url: "https://example.com/bilet/seramik-atolyesi",
  },
  {
    title: "Caz Kulübünde Kuartet Gecesi",
    meta: "konser · 21:30 · ₺₺₺ · rezervasyon önerilir",
    source_url: "https://example.com/bilet/caz-kuartet",
  },
];

const MOCK_FREE: EventResult[] = [
  {
    title: "Belediye Açık Hava Film Gösterimi",
    meta: "sinema · 21:00 · ücretsiz · açık hava",
    source_url: "https://example.com/belediye/acik-hava-sinema",
  },
  {
    title: "Fotoğraf Sergisi: Şehrin Halleri",
    meta: "sergi · 10:00–20:00 · ücretsiz · kapalı mekan",
    source_url: "https://example.com/sergi/sehrin-halleri",
  },
  {
    title: "Sahilde Gün Batımı Yoga Buluşması",
    meta: "topluluk etkinliği · 19:30 · ücretsiz · açık hava",
    source_url: "https://example.com/etkinlik/gunbatimi-yoga",
  },
  {
    title: "Kütüphanede Söyleşi: Şehir ve Bellek",
    meta: "söyleşi · 18:30 · ücretsiz · kapalı mekan",
    source_url: "https://example.com/etkinlik/sehir-bellek",
  },
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ham arama sonuçları döner (LLM ayıklama adımı suggest.ts'te).
 * Mock modda "başka öner" için karıştırılmış sahte veri döner.
 */
export async function searchEvents(parsed: ParsedQuery): Promise<{
  ticketed: EventResult[];
  free: EventResult[];
}> {
  if (isSearchMock()) {
    return {
      ticketed: shuffled(MOCK_TICKETED).slice(0, 3),
      free: shuffled(MOCK_FREE).slice(0, 3),
    };
  }

  const loc = parsed.location || "İstanbul";
  const when = parsed.date_label === "bugün" ? "bugün" : parsed.date_label;
  // kullanıcının özel ilgisi varsa ("heykel workshop") aramayı ona odakla
  const interests = (parsed.interests ?? []).slice(0, 3).join(" ");
  const [ticketed, free] = await Promise.all([
    webSearch(
      `${loc} ${when} ${interests || "konser tiyatro"} etkinlik`,
      TICKET_DOMAINS
    ),
    webSearch(
      `${loc} ${when} ${interests || "sergi söyleşi atölye"} ücretsiz etkinlik`,
      FREE_EVENT_DOMAINS
    ),
  ]);

  return {
    ticketed: ticketed.length ? ticketed.slice(0, 8) : shuffled(MOCK_TICKETED).slice(0, 3),
    free: free.length ? free.slice(0, 8) : shuffled(MOCK_FREE).slice(0, 3),
  };
}

async function webSearch(
  query: string,
  domains: string[]
): Promise<EventResult[]> {
  try {
    if (tavilyKey()) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tavilyKey()}`,
        },
        body: JSON.stringify({
          query,
          max_results: 8,
          include_domains: domains,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Tavily ${res.status}`);
      const data = await res.json();
      type TavilyResult = { title: string; url: string; content?: string };
      return ((data.results ?? []) as TavilyResult[]).map((r) => ({
        title: r.title,
        meta: (r.content ?? "").slice(0, 160),
        source_url: r.url,
      }));
    }

    if (serperKey()) {
      const siteFilter = domains.map((d) => `site:${d}`).join(" OR ");
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": serperKey()!,
        },
        body: JSON.stringify({
          q: `${query} (${siteFilter})`,
          gl: "tr",
          hl: "tr",
          num: 8,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Serper ${res.status}`);
      const data = await res.json();
      type SerperResult = { title: string; link: string; snippet?: string };
      return ((data.organic ?? []) as SerperResult[]).map((r) => ({
        title: r.title,
        meta: (r.snippet ?? "").slice(0, 160),
        source_url: r.link,
      }));
    }
  } catch {
    // düş: boş dön, çağıran mock'a düşer
  }
  return [];
}
