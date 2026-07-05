import type { ParsedQuery, WeatherInfo } from "@/lib/types";
import { toIsoDate } from "@/lib/llm";

function hasKey(): boolean {
  const key = process.env.OPENWEATHER_API_KEY;
  return Boolean(key && key.trim() && !key.startsWith("your-"));
}

export function isWeatherMock(): boolean {
  return !hasKey();
}

const MOCK_WEATHER: WeatherInfo = {
  temp_c: 21,
  condition: "açık",
  is_rainy: false,
  source: "mock",
};

const RAINY_MAINS = ["Rain", "Drizzle", "Thunderstorm", "Snow"];

// time_of_day → forecast'ta hedeflenecek saat
const HOUR_BY_TIME: Record<ParsedQuery["time_of_day"], number> = {
  morning: 9,
  noon: 13,
  evening: 19,
  night: 22,
};

export async function getWeather(parsed: ParsedQuery): Promise<WeatherInfo> {
  if (!hasKey()) return MOCK_WEATHER;

  const q = encodeURIComponent(`${parsed.location || "Istanbul"},TR`);
  const key = process.env.OPENWEATHER_API_KEY;
  const today = toIsoDate(new Date());

  try {
    if (parsed.target_date === today) {
      // bugün → anlık hava durumu
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${q}&units=metric&lang=tr&appid=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`OpenWeatherMap ${res.status}`);
      const data = await res.json();
      const main: string = data.weather?.[0]?.main ?? "";
      return {
        temp_c: Math.round(data.main?.temp ?? 20),
        condition: data.weather?.[0]?.description ?? "bilinmiyor",
        is_rainy: RAINY_MAINS.includes(main),
        source: "api",
      };
    }

    // gelecek tarih → 5 günlük / 3 saatlik tahmin; hedef gün + saate en yakın dilim
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${q}&units=metric&lang=tr&appid=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`OpenWeatherMap forecast ${res.status}`);
    const data = await res.json();

    type Slot = {
      dt_txt: string; // "2026-07-12 18:00:00"
      main?: { temp?: number };
      weather?: { main?: string; description?: string }[];
    };
    const slots = ((data.list ?? []) as Slot[]).filter((s) =>
      s.dt_txt.startsWith(parsed.target_date)
    );
    if (slots.length === 0) {
      // tahmin ufku (5 gün) dışındaki tarih — hava bilinmiyor, filtre uygulama
      return { ...MOCK_WEATHER, condition: "tahmin ufku dışında" };
    }

    const targetHour = HOUR_BY_TIME[parsed.time_of_day];
    const best = slots.reduce((a, b) => {
      const ha = Math.abs(parseInt(a.dt_txt.slice(11, 13), 10) - targetHour);
      const hb = Math.abs(parseInt(b.dt_txt.slice(11, 13), 10) - targetHour);
      return hb < ha ? b : a;
    });
    const main = best.weather?.[0]?.main ?? "";
    return {
      temp_c: Math.round(best.main?.temp ?? 20),
      condition: best.weather?.[0]?.description ?? "bilinmiyor",
      is_rainy: RAINY_MAINS.includes(main),
      source: "api",
    };
  } catch {
    // API hatasında öneri akışını düşürme — mock'a düş
    return MOCK_WEATHER;
  }
}
