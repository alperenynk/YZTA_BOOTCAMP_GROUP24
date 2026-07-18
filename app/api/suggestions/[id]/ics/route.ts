import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// time_of_day → varsayılan başlangıç saati
const HOUR_BY_TIME: Record<string, number> = {
  morning: 10,
  noon: 13,
  evening: 19,
  night: 21,
};

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Öneriyi .ics takvim dosyası olarak indir
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const suggestionId = Number(id);
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
    return Response.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.title, s.meta, s.reason_text, s.source_url,
              q.target_date, q.parsed_json, q.user_id
       FROM suggestions s
       JOIN queries q ON q.id = s.query_id
       WHERE s.id = ?`
    )
    .get(suggestionId) as
    | {
        title: string;
        meta: string | null;
        reason_text: string | null;
        source_url: string | null;
        target_date: string | null;
        parsed_json: string | null;
        user_id: number;
      }
    | undefined;

  if (!row || row.user_id !== userId) {
    return Response.json({ error: "Öneri bulunamadı." }, { status: 404 });
  }

  // Tarih: sorgunun hedef tarihi (yoksa bugün)
  const date = row.target_date ?? new Date().toISOString().slice(0, 10);

  // Saat: meta'da geçen "20:30" gibi bir saat varsa onu, yoksa time_of_day varsayılanını kullan
  const metaTime = (row.meta ?? "").match(/(\d{1,2})[:.](\d{2})/);
  let hour = 19;
  let minute = 0;
  if (metaTime) {
    hour = Math.min(23, parseInt(metaTime[1], 10));
    minute = Math.min(59, parseInt(metaTime[2], 10));
  } else if (row.parsed_json) {
    try {
      const parsed = JSON.parse(row.parsed_json);
      hour = HOUR_BY_TIME[parsed.time_of_day] ?? 19;
    } catch {}
  }

  const d = date.replace(/-/g, "");
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${d}T${pad(hour)}${pad(minute)}00`;
  const endHour = Math.min(23, hour + 2);
  const end = `${d}T${pad(endHour)}${pad(minute)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const description = [row.meta, row.reason_text, row.source_url]
    .filter(Boolean)
    .join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lokal//Deneyim Asistani//TR",
    "BEGIN:VEVENT",
    `UID:lokal-suggestion-${suggestionId}@lokal.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Istanbul:${start}`,
    `DTEND;TZID=Europe/Istanbul:${end}`,
    `SUMMARY:${icsEscape(row.title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="lokal-${suggestionId}.ics"`,
    },
  });
}
