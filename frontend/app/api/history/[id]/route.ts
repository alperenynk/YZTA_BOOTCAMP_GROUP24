import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const { id } = await params;
  const queryId = Number(id);
  if (!Number.isInteger(queryId) || queryId <= 0) {
    return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const db = getDb();
  const query = db
    .prepare(
      `SELECT id, raw_text, parsed_json, target_date, created_at
       FROM queries WHERE id = ? AND user_id = ?`
    )
    .get(queryId, userId) as
    | { id: number; raw_text: string; parsed_json: string | null; target_date: string | null; created_at: string }
    | undefined;

  if (!query) {
    return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });
  }

  const rows = db
    .prepare(
      `SELECT id, layer, title, meta, reason_text, source_url, steps_json
       FROM suggestions WHERE query_id = ? ORDER BY id`
    )
    .all(queryId) as {
    id: number;
    layer: string;
    title: string;
    meta: string | null;
    reason_text: string | null;
    source_url: string | null;
    steps_json: string | null;
  }[];

  const suggestions = rows.map((r) => ({
    id: r.id,
    layer: r.layer,
    title: r.title,
    meta: r.meta ?? "",
    reason_text: r.reason_text ?? "",
    source_url: r.source_url,
    steps: r.steps_json ? JSON.parse(r.steps_json) : undefined,
  }));

  return NextResponse.json({
    query: {
      id: query.id,
      raw_text: query.raw_text,
      parsed: query.parsed_json ? JSON.parse(query.parsed_json) : null,
      target_date: query.target_date,
      created_at: query.created_at,
    },
    suggestions,
  });
}
