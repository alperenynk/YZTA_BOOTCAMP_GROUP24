import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { regenerateProfile, getLatestProfileSummary } from "@/lib/profile";
import { runSuggestionPipeline } from "@/lib/suggest";
import { sendEmail } from "@/lib/email";

export const maxDuration = 300;

/**
 * Haftalık tarama: her kullanıcı için profil tazele, hafta sonu önerisi üret,
 * fırsat tetikleyicisiyle birlikte e-posta gönder.
 *
 * Tetikleme: crontab / Vercel Cron / elle:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const db = getDb();
  const users = db
    .prepare(
      "SELECT id, name, email FROM users WHERE auth_id IS NOT NULL AND email IS NOT NULL"
    )
    .all() as { id: number; name: string; email: string }[];

  const results: { user: string; status: string }[] = [];

  for (const user of users) {
    try {
      // 1) Profili tazele
      await regenerateProfile(user.id).catch(() => null);
      const profile = getLatestProfileSummary(user.id);

      // 2) Kullanıcının bilinen son konumu
      const lastLoc = db
        .prepare(
          `SELECT parsed_location FROM queries
           WHERE user_id = ? AND parsed_location IS NOT NULL
           ORDER BY id DESC LIMIT 1`
        )
        .get(user.id) as { parsed_location: string } | undefined;
      const loc = lastLoc?.parsed_location ?? "İstanbul";

      // 3) Hafta sonu önerisi üret (geçmişte "📬" önekiyle görünür)
      const result = await runSuggestionPipeline(
        `📬 haftalık öneri: Bu hafta sonu ${loc}'de ne yapsak?`,
        user.id
      );

      // 4) Fırsat tetikleyicisi: hava güzelse özel satır
      const opportunity =
        !result.weather.is_rainy && result.weather.temp_c >= 18
          ? `☀️ Fırsat: hafta sonu ${loc}'de hava ${result.weather.temp_c}°C ve ${result.weather.condition} görünüyor — açık hava planı için ideal!`
          : null;

      // 5) E-posta içeriği (ilk 5 öneri)
      const top = result.suggestions.slice(0, 5);
      const items = top
        .map(
          (s) =>
            `<li style="margin-bottom:12px"><strong>${s.title}</strong><br/>
             <small>${s.meta}</small><br/><em>${s.reason_text}</em></li>`
        )
        .join("");

      await sendEmail({
        to: user.email,
        subject: `Lokál — bu hafta sonu ${loc} için sana göre planlar`,
        html: `<p>Merhaba ${user.name},</p>
${opportunity ? `<p><strong>${opportunity}</strong></p>` : ""}
${profile ? `<p><small>Profilin: ${profile}</small></p>` : ""}
<ul>${items}</ul>
<p>Tüm paket için uygulamaya göz at → <a href="${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/history/${result.query_id}">önerileri gör</a></p>`,
      });

      results.push({ user: user.email, status: "gönderildi" });
    } catch (err) {
      console.error(`Haftalık tarama hatası (${user.email}):`, err);
      results.push({ user: user.email, status: "hata" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
