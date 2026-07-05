import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
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

  const content = String(form.get("content") ?? "").trim();
  const suggestionRaw = form.get("suggestion_id");
  const suggestionId = suggestionRaw ? Number(suggestionRaw) : null;
  const image = form.get("image");

  if (!content && !(image instanceof File && image.size > 0) && !suggestionId) {
    return NextResponse.json(
      { error: "Paylaşım boş olamaz — metin, görsel ya da etkinlik seç." },
      { status: 400 }
    );
  }
  if (content.length > 500) {
    return NextResponse.json(
      { error: "Metin en fazla 500 karakter olabilir." },
      { status: 400 }
    );
  }

  const db = getDb();

  // Etkinlik seçildiyse gerçekten bu kullanıcının "Gittim" kaydı olmalı
  if (suggestionId) {
    const visited = db
      .prepare(
        "SELECT 1 FROM feedback WHERE user_id = ? AND suggestion_id = ? AND went = 1"
      )
      .get(userId, suggestionId);
    if (!visited) {
      return NextResponse.json(
        { error: "Sadece gittiğin etkinlikleri etiketleyebilirsin." },
        { status: 400 }
      );
    }
  }

  // Görseli kaydet
  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    const ext = EXT_BY_MIME[image.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Sadece JPEG, PNG, WebP veya GIF yüklenebilir." },
        { status: 400 }
      );
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Görsel en fazla 5 MB olabilir." },
        { status: 400 }
      );
    }
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(
      path.join(UPLOAD_DIR, name),
      Buffer.from(await image.arrayBuffer())
    );
    imagePath = name;
  }

  const result = db
    .prepare(
      `INSERT INTO posts (user_id, suggestion_id, content, image_path)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, suggestionId, content || null, imagePath);

  return NextResponse.json({ id: Number(result.lastInsertRowid), ok: true });
}
