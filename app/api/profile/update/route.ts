import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const birthDate = String(form.get("birth_date") ?? "").trim();
  const homeDistrict = String(form.get("home_district") ?? "").trim();
  const avatar = form.get("avatar");

  if (name && name.length > 80) {
    return NextResponse.json({ error: "İsim çok uzun." }, { status: 400 });
  }
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json(
      { error: "Doğum tarihi YYYY-AA-GG biçiminde olmalı." },
      { status: 400 }
    );
  }

  const db = getDb();

  let avatarPath: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    const ext = EXT_BY_MIME[avatar.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Profil fotoğrafı JPEG, PNG veya WebP olmalı." },
        { status: 400 }
      );
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "Fotoğraf en fazla 3 MB olabilir." },
        { status: 400 }
      );
    }
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    avatarPath = `${crypto.randomUUID()}.webp`;
    const resized = await sharp(Buffer.from(await avatar.arrayBuffer()))
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    fs.writeFileSync(path.join(UPLOAD_DIR, avatarPath), resized);
    // eski fotoğrafı temizle
    const old = db
      .prepare("SELECT avatar_path FROM users WHERE id = ?")
      .get(userId) as { avatar_path: string | null };
    if (old?.avatar_path) {
      fs.rmSync(path.join(UPLOAD_DIR, old.avatar_path), { force: true });
    }
  }

  db.prepare(
    `UPDATE users SET
       name = COALESCE(NULLIF(?, ''), name),
       birth_date = COALESCE(NULLIF(?, ''), birth_date),
       home_district = COALESCE(NULLIF(?, ''), home_district),
       avatar_path = COALESCE(?, avatar_path)
     WHERE id = ?`
  ).run(name, birthDate, homeDistrict, avatarPath, userId);

  const user = db
    .prepare(
      "SELECT name, birth_date, home_district, avatar_path FROM users WHERE id = ?"
    )
    .get(userId) as Record<string, unknown>;

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      avatar_url: user.avatar_path ? `/api/uploads/${user.avatar_path}` : null,
      avatar_path: undefined,
    },
  });
}
