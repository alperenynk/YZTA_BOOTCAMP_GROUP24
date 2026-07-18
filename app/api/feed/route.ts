import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

const PAGE_SIZE = 20;

// Topluluk akışı herkese açık; oturum varsa "beğendim mi" bilgisi de döner.
// Sayfalama: ?before=<post_id> (cursor), sayfa boyu 20.
export async function GET(request: Request) {
  const info = await getSessionInfo(request.headers).catch(() => null);
  const userId = info?.userId ?? null;
  const beforeRaw = new URL(request.url).searchParams.get("before");
  const before = beforeRaw ? Number(beforeRaw) : null;
  const db = getDb();

  const posts = db
    .prepare(
      `SELECT p.id, p.content, p.image_path, p.created_at,
              u.name AS user_name, u.avatar_path,
              s.title AS suggestion_title, s.layer AS suggestion_layer,
              f.liked AS visit_liked,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
              ${userId ? "EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?)" : "0"} AS liked_by_me,
              ${userId ? "CASE WHEN p.user_id = ? THEN 1 ELSE 0 END" : "0"} AS is_mine
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN suggestions s ON s.id = p.suggestion_id
       LEFT JOIN feedback f
         ON f.suggestion_id = p.suggestion_id AND f.user_id = p.user_id
       WHERE (? IS NULL OR p.id < ?)
       ORDER BY p.id DESC
       LIMIT ${PAGE_SIZE}`
    )
    .all(
      ...(userId ? [userId, userId] : []),
      before,
      before
    ) as Record<string, unknown>[];

  return NextResponse.json({
    viewer_is_admin: info?.isAdmin ?? false,
    has_more: posts.length === PAGE_SIZE,
    posts: posts.map((p) => ({
      ...p,
      image_url: p.image_path ? `/api/uploads/${p.image_path}` : null,
      avatar_url: p.avatar_path ? `/api/uploads/${p.avatar_path}` : null,
      image_path: undefined,
      avatar_path: undefined,
    })),
  });
}
