import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { getWeather, isWeatherMock } from "@/lib/services/weather";
import { toIsoDate } from "@/lib/llm";
import type { ParsedQuery, TimeOfDay } from "@/lib/types";

// Ana sayfa hava kartı: kullanıcının semtinde bugün hava nasıl?
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const home = db
    .prepare("SELECT home_district FROM users WHERE id = ?")
    .get(userId) as { home_district: string | null };
  const district = home?.home_district ?? "İstanbul";

  const hour = new Date().getHours();
  const time_of_day: TimeOfDay =
    hour < 11 ? "morning" : hour < 16 ? "noon" : hour < 22 ? "evening" : "night";

  const weather = await getWeather({
    location: district === "İstanbul" ? null : district,
    target_date: toIsoDate(new Date()),
    time_of_day,
  } as ParsedQuery);

  return NextResponse.json({
    district,
    temp_c: weather.temp_c,
    condition: weather.condition,
    is_rainy: weather.is_rainy,
    is_mock: isWeatherMock() || weather.source === "mock",
  });
}
