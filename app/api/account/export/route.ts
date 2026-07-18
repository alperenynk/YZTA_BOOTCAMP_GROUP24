import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// KVKK erişim hakkı: kullanıcının tüm verilerini JSON olarak indir
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const data = {
    exported_at: new Date().toISOString(),
    profile: db
      .prepare(
        "SELECT name, email, birth_date, home_district, created_at FROM users WHERE id = ?"
      )
      .get(userId),
    searches: db
      .prepare("SELECT raw_text, parsed_json, target_date, created_at FROM queries WHERE user_id = ?")
      .all(userId),
    feedback: db
      .prepare(
        `SELECT s.title, f.went, f.liked, f.note, f.created_at
         FROM feedback f JOIN suggestions s ON s.id = f.suggestion_id
         WHERE f.user_id = ?`
      )
      .all(userId),
    posts: db
      .prepare("SELECT content, created_at FROM posts WHERE user_id = ?")
      .all(userId),
    comments: db
      .prepare("SELECT content, created_at FROM post_comments WHERE user_id = ?")
      .all(userId),
    friends: db
      .prepare(
        `SELECT u.name, u.email, f.status FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
         WHERE f.user_id = ? OR f.friend_id = ?`
      )
      .all(userId, userId, userId),
    notifications: db
      .prepare("SELECT type, message, created_at FROM notifications WHERE user_id = ?")
      .all(userId),
    profile_summaries: db
      .prepare("SELECT summary_text, updated_at FROM profile_summaries WHERE user_id = ?")
      .all(userId),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lokal-verilerim.json"',
    },
  });
}
