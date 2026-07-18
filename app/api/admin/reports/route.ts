import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";

// Moderasyon: bekleyen şikayetler (sadece ADMIN_EMAILS)
export async function GET(request: Request) {
  const info = await getSessionInfo(request.headers);
  if (!info) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (!info.isAdmin) {
    return NextResponse.json({ error: "Yetkin yok." }, { status: 403 });
  }

  const db = getDb();
  const reports = (
    db
      .prepare(
        `SELECT r.id, r.reason, r.created_at, r.post_id,
                ru.name AS reporter_name,
                p.content AS post_content, p.image_path,
                pu.name AS post_owner
         FROM reports r
         JOIN users ru ON ru.id = r.reporter_id
         LEFT JOIN posts p ON p.id = r.post_id
         LEFT JOIN users pu ON pu.id = p.user_id
         WHERE r.resolved = 0
         ORDER BY r.created_at DESC LIMIT 50`
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    image_url: r.image_path ? `/api/uploads/${r.image_path}` : null,
    image_path: undefined,
  }));

  return NextResponse.json({ reports });
}

// Şikayeti çözüldü işaretle
export async function POST(request: Request) {
  const info = await getSessionInfo(request.headers);
  if (!info) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (!info.isAdmin) {
    return NextResponse.json({ error: "Yetkin yok." }, { status: 403 });
  }

  let body: { report_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const reportId = Number(body.report_id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  getDb()
    .prepare("UPDATE reports SET resolved = 1 WHERE id = ?")
    .run(reportId);
  return NextResponse.json({ ok: true });
}
