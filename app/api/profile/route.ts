import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { getBadges, getProfileStats } from "@/lib/badges";

export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();

  const user = db
    .prepare(
      `SELECT id, name, email, avatar_path, birth_date, home_district, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as Record<string, unknown>;

  const queries = db
    .prepare(
      `SELECT id, raw_text, parsed_location, parsed_mood, parsed_companion,
              parsed_time, parsed_budget, target_date, created_at
       FROM queries WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`
    )
    .all(userId);

  // Gittiklerim: Gittim işaretli öneriler (beğeni + not ile)
  const visits = db
    .prepare(
      `SELECT f.id, f.went, f.liked, f.note, f.created_at,
              s.id AS suggestion_id, s.title AS suggestion_title, s.layer AS suggestion_layer
       FROM feedback f
       JOIN suggestions s ON s.id = f.suggestion_id
       WHERE f.user_id = ? AND f.went = 1
       ORDER BY f.created_at DESC LIMIT 50`
    )
    .all(userId);

  // Paylaşımlarım: akışa attığı postlar
  const posts = (
    db
      .prepare(
        `SELECT p.id, p.content, p.image_path, p.created_at,
                s.title AS suggestion_title, s.layer AS suggestion_layer,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count
         FROM posts p
         LEFT JOIN suggestions s ON s.id = p.suggestion_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC LIMIT 50`
      )
      .all(userId) as Record<string, unknown>[]
  ).map((p) => ({
    ...p,
    image_url: p.image_path ? `/api/uploads/${p.image_path}` : null,
    image_path: undefined,
  }));

  const summary = db
    .prepare(
      `SELECT summary_text, updated_at FROM profile_summaries
       WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`
    )
    .get(userId);

  return NextResponse.json({
    user: {
      ...user,
      avatar_url: user.avatar_path ? `/api/uploads/${user.avatar_path}` : null,
      avatar_path: undefined,
    },
    queries,
    visits,
    posts,
    summary: summary ?? null,
    badges: getBadges(userId),
    stats: getProfileStats(userId),
  });
}
