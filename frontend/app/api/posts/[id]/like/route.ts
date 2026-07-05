import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Beğeni aç/kapa
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

  const db = getDb();
  if (!db.prepare("SELECT 1 FROM posts WHERE id = ?").get(postId)) {
    return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?")
    .get(postId, userId);

  if (existing) {
    db.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").run(
      postId,
      userId
    );
  } else {
    db.prepare("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)").run(
      postId,
      userId
    );
  }

  const { c } = db
    .prepare("SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?")
    .get(postId) as { c: number };

  return NextResponse.json({ liked: !existing, like_count: c });
}
