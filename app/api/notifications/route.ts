import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Bildirim listesi + okunmamış sayısı
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const notifications = db
    .prepare(
      `SELECT id, type, message, post_id, read, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 20`
    )
    .all(userId);
  const { c } = db
    .prepare(
      "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0"
    )
    .get(userId) as { c: number };

  return NextResponse.json({ notifications, unread: c });
}

// Hepsini okundu işaretle
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  getDb()
    .prepare("UPDATE notifications SET read = 1 WHERE user_id = ?")
    .run(userId);
  return NextResponse.json({ ok: true });
}
