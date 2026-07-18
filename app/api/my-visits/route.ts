import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Paylaşım kutusundaki "gittiğim etkinlik" seçici için: kullanıcının Gittim kayıtları
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const visits = db
    .prepare(
      `SELECT DISTINCT s.id, s.title, s.layer, MAX(f.created_at) AS visited_at
       FROM feedback f
       JOIN suggestions s ON s.id = f.suggestion_id
       WHERE f.user_id = ? AND f.went = 1
       GROUP BY s.id
       ORDER BY visited_at DESC
       LIMIT 30`
    )
    .all(userId);

  return NextResponse.json({ visits });
}
