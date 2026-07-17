import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// Kendi paylaşımını sil (beğeniler + yorumlar + görsel dosyası dahil)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSessionInfo(request.headers);
  if (!info) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const db = getDb();
  const post = db
    .prepare("SELECT user_id, image_path FROM posts WHERE id = ?")
    .get(postId) as { user_id: number; image_path: string | null } | undefined;

  if (!post) {
    return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  }
  // sahibi ya da moderatör silebilir
  if (post.user_id !== info.userId && !info.isAdmin) {
    return NextResponse.json(
      { error: "Sadece kendi paylaşımını silebilirsin." },
      { status: 403 }
    );
  }

  db.transaction(() => {
    db.prepare("DELETE FROM post_likes WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM post_comments WHERE post_id = ?").run(postId);
    db.prepare("UPDATE reports SET resolved = 1 WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
  })();

  if (post.image_path) {
    fs.rmSync(path.join(UPLOAD_DIR, post.image_path), { force: true });
  }

  return NextResponse.json({ ok: true });
}
