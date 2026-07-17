import type { ParsedQuery, SuggestionItem, WeatherInfo } from "@/lib/types";

function hasKey(): boolean {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return Boolean(key && key.trim() && !key.startsWith("your-"));
}

export function isPlacesMock(): boolean {
  return !hasKey();
}

const MOCK_VENUES: Record<string, Omit<SuggestionItem, "layer" | "reason_text">[]> = {
  default: [
    {
      title: "Sahil Parkı Yürüyüş Rotası",
      meta: "park · ücretsiz · açık hava",
      source_url: null,
    },
    {
      title: "Üçüncü Dalga Kahveci",
      meta: "kafe · ₺₺ · sakin",
      source_url: null,
    },
    {
      title: "Semt Müzesi",
      meta: "müze · ₺ · kapalı mekan",
      source_url: null,
    },
  ],
  kadıköy: [
    {
      title: "Moda Sahili",
      meta: "park/sahil · ücretsiz · açık hava · gün batımı manzarası",
      source_url: null,
    },
    {
      title: "Walter's Coffee Roastery",
      meta: "kafe · ₺₺ · Moda · sakin köşeler",
      source_url: null,
    },
    {
      title: "Barış Manço Evi",
      meta: "müze · ₺ · kapalı mekan · Moda",
      source_url: null,
    },
    {
      title: "Yoğurtçu Parkı",
      meta: "park · ücretsiz · açık hava · çay bahçesi",
      source_url: null,
    },
  ],
  beşiktaş: [
    {
      title: "Abbasağa Parkı",
      meta: "park · ücretsiz · açık hava",
      source_url: null,
    },
    {
      title: "Deniz Müzesi",
      meta: "müze · ₺ · kapalı mekan · sahil",
      source_url: null,
    },
    {
      title: "Çınaraltı Çay Bahçesi",
      meta: "çay bahçesi · ₺ · sahil manzarası",
      source_url: null,
    },
  ],
};

function isOpenAir(meta: string): boolean {
  return meta.includes("açık hava");
}

export async function getVenues(
  parsed: ParsedQuery,
  weather: WeatherInfo
): Promise<Omit<SuggestionItem, "layer" | "reason_text">[]> {
  let venues: Omit<SuggestionItem, "layer" | "reason_text">[];

  if (!hasKey()) {
    const key = (parsed.location || "").toLocaleLowerCase("tr");
    // "başka öner" akışında çeşitlilik için karıştır
    venues = [...(MOCK_VENUES[key] ?? MOCK_VENUES.default)].sort(
      () => Math.random() - 0.5
    );
  } else {
    venues = await fetchGooglePlaces(parsed);
  }

  // Yağmur varsa açık hava mekanlarını filtrele (hepsi açık havaysa dokunma)
  if (weather.is_rainy) {
    const indoor = venues.filter((v) => !isOpenAir(v.meta));
    if (indoor.length > 0) venues = indoor;
  }

  return venues.slice(0, 4);
}

async function fetchGooglePlaces(
  parsed: ParsedQuery
): Promise<Omit<SuggestionItem, "layer" | "reason_text">[]> {
  // Places API (New) — Text Search
  const query = [
    parsed.energy === "low" ? "sakin kafe veya park" : "kafe park müze",
    parsed.location || "İstanbul",
  ].join(" ");

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.priceLevel,places.types,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "tr" }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Places ${res.status}`);
    const data = await res.json();
    type Place = {
      displayName?: { text?: string };
      formattedAddress?: string;
      types?: string[];
      googleMapsUri?: string;
    };
    return ((data.places ?? []) as Place[]).map((p) => ({
      title: p.displayName?.text ?? "Mekan",
      meta: [
        p.types?.includes("park") ? "park · açık hava" : "mekan",
        p.formattedAddress ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
      source_url: p.googleMapsUri ?? null,
    }));
  } catch {
    const key = (parsed.location || "").toLocaleLowerCase("tr");
    return MOCK_VENUES[key] ?? MOCK_VENUES.default;
  }
}
