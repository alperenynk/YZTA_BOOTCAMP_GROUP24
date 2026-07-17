import webpush from "web-push";
import { getDb } from "@/lib/db";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:lokal@example.com",
    pub,
    priv
  );
  configured = true;
  return true;
}

/** Kullanıcının tüm cihazlarına push gönder (en iyi çaba — hata akışı bozmaz). */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string
): Promise<void> {
  if (!ensureConfigured()) return;

  const db = getDb();
  const subs = db
    .prepare(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?"
    )
    .all(userId) as { id: number; endpoint: string; p256dh: string; auth: string }[];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body })
        );
      } catch (err) {
        // süresi dolmuş abonelikleri temizle
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
        }
      }
    })
  );
}
