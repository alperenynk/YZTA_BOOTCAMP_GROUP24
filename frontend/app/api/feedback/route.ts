import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { maybeRegenerateProfile } from "@/lib/profile";

export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: {
    suggestion_id?: number;
    went?: boolean;
    liked?: boolean | null;
    note?: string;
    share?: boolean; // topluluk akışında paylaş
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const suggestionId = Number(body.suggestion_id);
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
    return NextResponse.json(
      { error: "Geçerli bir suggestion_id gerekli." },
      { status: 400 }
    );
  }

  const db = getDb();
  const suggestion = db
    .prepare("SELECT id FROM suggestions WHERE id = ?")
    .get(suggestionId);
  if (!suggestion) {
    return NextResponse.json({ error: "Öneri bulunamadı." }, { status: 404 });
  }

  const result = db
    .prepare(
      `INSERT INTO feedback (suggestion_id, user_id, went, liked, note)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      suggestionId,
      userId,
      body.went === false ? 0 : 1,
      body.liked === true ? 1 : body.liked === false ? 0 : null,
      (body.note ?? "").trim() || null
    );

  // Anıyı topluluk akışında paylaş
  if (body.share === true && body.went !== false) {
    db.prepare(
      "INSERT INTO posts (user_id, suggestion_id, content) VALUES (?, ?, ?)"
    ).run(userId, suggestionId, (body.note ?? "").trim() || null);
  }

  // Her 3 geri bildirimde bir profil özetini tazele (yanıtı bekletme)
  maybeRegenerateProfile(userId).catch((err) =>
    console.error("Profil özeti üretimi hatası:", err)
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid), ok: true });
}
