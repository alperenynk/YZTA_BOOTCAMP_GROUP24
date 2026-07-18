import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Paylaşılan öneriyi herkese açık getir (üyelik gerekmez)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(token)) {
    return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 404 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.title, s.meta, s.reason_text, s.layer, s.steps_json,
              q.target_date, u.name AS owner_name
       FROM suggestions s
       JOIN queries q ON q.id = s.query_id
       JOIN users u ON u.id = q.user_id
       WHERE s.share_token = ?`
    )
    .get(token) as
    | {
        title: string;
        meta: string | null;
        reason_text: string | null;
        layer: string;
        steps_json: string | null;
        target_date: string | null;
        owner_name: string;
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Bağlantı bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({
    suggestion: {
      title: row.title,
      meta: row.meta ?? "",
      reason_text: row.reason_text ?? "",
      layer: row.layer,
      steps: row.steps_json ? JSON.parse(row.steps_json) : undefined,
      target_date: row.target_date,
      owner_name: row.owner_name,
    },
  });
}
