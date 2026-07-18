import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// "Gittim"den bağımsız kaydetme (bookmark) aç/kapa
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const suggestionId = Number(id);
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const db = getDb();
  if (!db.prepare("SELECT 1 FROM suggestions WHERE id = ?").get(suggestionId)) {
    return NextResponse.json({ error: "Öneri bulunamadı." }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT 1 FROM saved_items WHERE user_id = ? AND suggestion_id = ?")
    .get(userId, suggestionId);

  if (existing) {
    db.prepare(
      "DELETE FROM saved_items WHERE user_id = ? AND suggestion_id = ?"
    ).run(userId, suggestionId);
    return NextResponse.json({ saved: false });
  }

  db.prepare(
    "INSERT INTO saved_items (user_id, suggestion_id) VALUES (?, ?)"
  ).run(userId, suggestionId);
  return NextResponse.json({ saved: true });
}
