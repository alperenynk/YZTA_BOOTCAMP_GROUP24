import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Topluluk akışı herkese açık; oturum varsa "beğendim mi" bilgisi de döner
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers).catch(() => null);
  const db = getDb();

  const posts = db
    .prepare(
      `SELECT p.id, p.content, p.image_path, p.created_at,
              u.name AS user_name, u.avatar_path,
              s.title AS suggestion_title, s.layer AS suggestion_layer,
              f.liked AS visit_liked,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
              ${userId ? "EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?)" : "0"} AS liked_by_me
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN suggestions s ON s.id = p.suggestion_id
       LEFT JOIN feedback f
         ON f.suggestion_id = p.suggestion_id AND f.user_id = p.user_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 50`
    )
    .all(...(userId ? [userId] : [])) as Record<string, unknown>[];

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      image_url: p.image_path ? `/api/uploads/${p.image_path}` : null,
      avatar_url: p.avatar_path ? `/api/uploads/${p.avatar_path}` : null,
      image_path: undefined,
      avatar_path: undefined,
    })),
  });
}
