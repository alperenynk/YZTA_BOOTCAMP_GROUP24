import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAppUserId } from "@/lib/session";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/**
 * Hesabı ve TÜM verileri kalıcı olarak sil (KVKK silme hakkı).
 * Better Auth tabloları (user/session/account) dahil.
 */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = await getAppUserId(request.headers);
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const authId = session.user.id;
  const db = getDb();

  // silinecek görsel dosyalarını topla (transaction dışında sileceğiz)
  const files: string[] = [];
  const avatar = db
    .prepare("SELECT avatar_path FROM users WHERE id = ?")
    .get(userId) as { avatar_path: string | null };
  if (avatar?.avatar_path) files.push(avatar.avatar_path);
  for (const r of db
    .prepare("SELECT image_path FROM posts WHERE user_id = ? AND image_path IS NOT NULL")
    .all(userId) as { image_path: string }[]) {
    files.push(r.image_path);
  }

  db.transaction(() => {
    // sosyal içerik
    db.prepare(
      "DELETE FROM post_likes WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)"
    ).run(userId, userId);
    db.prepare(
      "DELETE FROM post_comments WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)"
    ).run(userId, userId);
    db.prepare(
      "DELETE FROM reports WHERE reporter_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)"
    ).run(userId, userId);
    db.prepare("DELETE FROM posts WHERE user_id = ?").run(userId);

    // öneri geçmişi
    db.prepare(
      "DELETE FROM feedback WHERE user_id = ? OR suggestion_id IN (SELECT s.id FROM suggestions s JOIN queries q ON q.id = s.query_id WHERE q.user_id = ?)"
    ).run(userId, userId);
    db.prepare(
      "DELETE FROM suggestions WHERE query_id IN (SELECT id FROM queries WHERE user_id = ?)"
    ).run(userId);
    db.prepare("DELETE FROM queries WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM profile_summaries WHERE user_id = ?").run(userId);

    // sosyal graf
    db.prepare(
      "DELETE FROM friendships WHERE user_id = ? OR friend_id = ?"
    ).run(userId, userId);
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
    db.prepare(
      "DELETE FROM group_members WHERE user_id = ? OR group_id IN (SELECT id FROM groups WHERE created_by = ?)"
    ).run(userId, userId);
    db.prepare("DELETE FROM groups WHERE created_by = ?").run(userId);
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(userId);

    // uygulama kullanıcısı
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    // Better Auth kayıtları
    db.prepare("DELETE FROM session WHERE userId = ?").run(authId);
    db.prepare("DELETE FROM account WHERE userId = ?").run(authId);
    db.prepare("DELETE FROM user WHERE id = ?").run(authId);
  })();

  for (const f of files) {
    fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
  }

  return NextResponse.json({ ok: true });
}
