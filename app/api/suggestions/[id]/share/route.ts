import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import crypto from "crypto";

// Öneri için herkese açık paylaşım linki üret (sadece sahibi)
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
  const row = db
    .prepare(
      `SELECT s.share_token, q.user_id FROM suggestions s
       JOIN queries q ON q.id = s.query_id WHERE s.id = ?`
    )
    .get(suggestionId) as { share_token: string | null; user_id: number } | undefined;

  if (!row || row.user_id !== userId) {
    return NextResponse.json({ error: "Öneri bulunamadı." }, { status: 404 });
  }

  let token = row.share_token;
  if (!token) {
    token = crypto.randomBytes(6).toString("base64url"); // kısa, URL dostu
    db.prepare("UPDATE suggestions SET share_token = ? WHERE id = ?").run(
      token,
      suggestionId
    );
  }

  return NextResponse.json({ url: `/r/${token}` });
}
