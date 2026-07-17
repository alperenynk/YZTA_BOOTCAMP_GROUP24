import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { reviseExperiencePackage } from "@/lib/llm";
import { getWeather } from "@/lib/services/weather";
import type { ParsedQuery } from "@/lib/types";

// Sohbet modu: "daha ucuz olsun" gibi taleple deneyim paketini revize et
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: { query_id?: number; instruction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const queryId = Number(body.query_id);
  const instruction = (body.instruction ?? "").trim();
  if (!Number.isInteger(queryId) || queryId <= 0 || !instruction) {
    return NextResponse.json(
      { error: "query_id ve instruction gerekli." },
      { status: 400 }
    );
  }
  if (instruction.length > 200) {
    return NextResponse.json({ error: "Talimat çok uzun." }, { status: 400 });
  }

  const db = getDb();
  const query = db
    .prepare(
      "SELECT parsed_json FROM queries WHERE id = ? AND user_id = ?"
    )
    .get(queryId, userId) as { parsed_json: string | null } | undefined;
  if (!query?.parsed_json) {
    return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });
  }

  const current = db
    .prepare(
      `SELECT id, title, reason_text, steps_json FROM suggestions
       WHERE query_id = ? AND layer = 'experience'
       ORDER BY id DESC LIMIT 1`
    )
    .get(queryId) as
    | { id: number; title: string; reason_text: string | null; steps_json: string | null }
    | undefined;
  if (!current) {
    return NextResponse.json({ error: "Deneyim paketi bulunamadı." }, { status: 404 });
  }

  const parsed = JSON.parse(query.parsed_json) as ParsedQuery;
  const weather = await getWeather(parsed);

  const revised = await reviseExperiencePackage(
    parsed,
    weather,
    {
      title: current.title,
      reason: current.reason_text ?? "",
      steps: current.steps_json ? JSON.parse(current.steps_json) : [],
    },
    instruction
  );

  // Yeni versiyonu aynı sorguya kaydet (geçmişte ikisi de dursun)
  const res = db
    .prepare(
      `INSERT INTO suggestions (query_id, layer, title, meta, reason_text, source_url, steps_json)
       VALUES (?, 'experience', ?, ?, ?, NULL, ?)`
    )
    .run(
      queryId,
      revised.title,
      "LLM deneyim paketi · revize rota",
      revised.reason,
      JSON.stringify(revised.steps)
    );

  return NextResponse.json({
    suggestion: {
      id: Number(res.lastInsertRowid),
      layer: "experience",
      title: revised.title,
      meta: "LLM deneyim paketi · revize rota",
      reason_text: revised.reason,
      source_url: null,
      steps: revised.steps,
    },
  });
}
