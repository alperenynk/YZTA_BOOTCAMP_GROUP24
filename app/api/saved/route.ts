import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Kullanıcının kaydettiği (bookmark) öneriler
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const items = db
    .prepare(
      `SELECT si.id AS saved_id, si.created_at,
              s.id AS suggestion_id, s.title, s.meta, s.layer, s.reason_text, s.source_url
       FROM saved_items si
       JOIN suggestions s ON s.id = si.suggestion_id
       WHERE si.user_id = ?
       ORDER BY si.created_at DESC`
    )
    .all(userId);

  return NextResponse.json({ items });
}
