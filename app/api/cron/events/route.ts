import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchEvents, isSearchMock } from "@/lib/services/search";
import { extractEventsWithDates, isLlmMock, toIsoDate } from "@/lib/llm";
import { upsertEvents } from "@/lib/events";
import type { ParsedQuery } from "@/lib/types";

export const maxDuration = 300;

/**
 * Gece taraması: popüler semtler için bilet siteleri + belediye takvimlerini
 * tarar, tarihli etkinlikleri kendi events tablomuza yazar.
 * Aramalar önce bu tabloya bakar → hızlı ve temiz sonuç.
 *
 * Tetikleme: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/events
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (isSearchMock() || isLlmMock()) {
    return NextResponse.json({
      skipped: true,
      reason:
        "Etkinlik taraması için hem arama (Tavily/Serper) hem LLM (Anthropic) key'i gerekli — mock modda güvenilir tarih çıkarımı yapılamaz.",
    });
  }

  const db = getDb();
  const today = toIsoDate(new Date());

  // Taranacak semtler: kullanıcıların semtleri + son aramalardaki konumlar
  const districts = new Set<string>(["İstanbul"]);
  for (const r of db
    .prepare(
      "SELECT DISTINCT home_district AS d FROM users WHERE home_district IS NOT NULL LIMIT 5"
    )
    .all() as { d: string }[]) {
    districts.add(r.d);
  }
  for (const r of db
    .prepare(
      `SELECT DISTINCT parsed_location AS d FROM queries
       WHERE parsed_location IS NOT NULL ORDER BY id DESC LIMIT 5`
    )
    .all() as { d: string }[]) {
    districts.add(r.d);
  }

  const results: { district: string; found: number }[] = [];

  for (const district of [...districts].slice(0, 6)) {
    try {
      // searchEvents alan kısıtlı arama yapar; "bu hafta" ifadesiyle geniş tarama
      const fakeParsed = {
        location: district === "İstanbul" ? null : district,
        date_label: "bu hafta",
        target_date: today,
      } as ParsedQuery;

      const raw = await searchEvents(fakeParsed);
      const extracted = await extractEventsWithDates(
        [...raw.ticketed, ...raw.free],
        today,
        district
      );
      const count = upsertEvents(
        extracted.map((e) => ({ ...e, location: district }))
      );
      results.push({ district, found: count });
    } catch (err) {
      console.error(`Etkinlik taraması hatası (${district}):`, err);
      results.push({ district, found: -1 });
    }
  }

  // 2 günden eski etkinlikleri temizle
  db.prepare("DELETE FROM events WHERE event_date < date('now', '-1 day')").run();

  return NextResponse.json({ scanned: results });
}
