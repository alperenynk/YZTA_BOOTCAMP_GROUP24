import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { notify, actorName } from "@/lib/notifications";

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
  const post = db
    .prepare("SELECT user_id FROM posts WHERE id = ?")
    .get(postId) as { user_id: number } | undefined;
  if (!post) {
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
    notify({
      userId: post.user_id,
      actorId: userId,
      type: "like",
      message: `${actorName(userId)} paylaşımını beğendi ♥`,
      postId,
    });
  }

  const { c } = db
    .prepare("SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?")
    .get(postId) as { c: number };

  return NextResponse.json({ liked: !existing, like_count: c });
}
