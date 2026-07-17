import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Paylaşımı şikayet et
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = (body.reason ?? "").trim().slice(0, 300) || null;

  const db = getDb();
  if (!db.prepare("SELECT 1 FROM posts WHERE id = ?").get(postId)) {
    return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  }
  const dup = db
    .prepare(
      "SELECT 1 FROM reports WHERE post_id = ? AND reporter_id = ? AND resolved = 0"
    )
    .get(postId, userId);
  if (dup) {
    return NextResponse.json(
      { error: "Bu paylaşımı zaten şikayet ettin — inceleyeceğiz." },
      { status: 409 }
    );
  }

  db.prepare(
    "INSERT INTO reports (post_id, reporter_id, reason) VALUES (?, ?, ?)"
  ).run(postId, userId, reason);

  return NextResponse.json({ ok: true });
}
