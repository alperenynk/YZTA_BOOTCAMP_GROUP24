import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { isRateLimited, rateLimitMessage } from "@/lib/ratelimit";
import { notify, actorName } from "@/lib/notifications";

function parsePostId(id: string): number | null {
  const postId = Number(id);
  return Number.isInteger(postId) && postId > 0 ? postId : null;
}

// Yorumları listele (herkese açık)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = parsePostId(id);
  if (!postId) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });

  const db = getDb();
  const comments = db
    .prepare(
      `SELECT c.id, c.content, c.created_at,
              u.name AS user_name, u.avatar_path
       FROM post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT 100`
    )
    .all(postId) as Record<string, unknown>[];

  return NextResponse.json({
    comments: comments.map((c) => ({
      ...c,
      avatar_url: c.avatar_path ? `/api/uploads/${c.avatar_path}` : null,
      avatar_path: undefined,
    })),
  });
}

// Yorum ekle
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (isRateLimited("comment", userId)) {
    return NextResponse.json({ error: rateLimitMessage("comment") }, { status: 429 });
  }

  const { id } = await params;
  const postId = parsePostId(id);
  if (!postId) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (!content || content.length > 300) {
    return NextResponse.json(
      { error: "Yorum 1-300 karakter arasında olmalı." },
      { status: 400 }
    );
  }

  const db = getDb();
  const post = db
    .prepare("SELECT user_id FROM posts WHERE id = ?")
    .get(postId) as { user_id: number } | undefined;
  if (!post) {
    return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  }

  const result = db
    .prepare(
      "INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)"
    )
    .run(postId, userId, content);

  notify({
    userId: post.user_id,
    actorId: userId,
    type: "comment",
    message: `${actorName(userId)} paylaşımına yorum yaptı: "${content.slice(0, 60)}"`,
    postId,
  });

  return NextResponse.json({ id: Number(result.lastInsertRowid), ok: true });
}
