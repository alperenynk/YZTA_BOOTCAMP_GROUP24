import { NextResponse } from "next/server";
import { runSuggestionPipeline } from "@/lib/suggest";
import { getAppUserId } from "@/lib/session";
import { isRateLimited, rateLimitMessage } from "@/lib/ratelimit";
import { resolveCompanions } from "@/lib/companions";

export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (isRateLimited("search", userId)) {
    return NextResponse.json({ error: rateLimitMessage("search") }, { status: 429 });
  }

  let body: { raw_text?: string; companions?: string[]; target_date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  let dateOverride: string | undefined;
  if (body.target_date) {
    const d = String(body.target_date);
    const today = new Date().toISOString().slice(0, 10);
    const max = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today || d > max) {
      return NextResponse.json(
        { error: "Tarih bugün ile önümüzdeki 60 gün arasında olmalı." },
        { status: 400 }
      );
    }
    dateOverride = d;
  }

  const rawText = (body.raw_text ?? "").trim();
  if (!rawText) {
    return NextResponse.json(
      { error: "raw_text alanı boş olamaz." },
      { status: 400 }
    );
  }
  if (rawText.length > 1000) {
    return NextResponse.json(
      { error: "Metin çok uzun (en fazla 1000 karakter)." },
      { status: 400 }
    );
  }

  const resolved = resolveCompanions(body.companions, userId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    const result = await runSuggestionPipeline(
      rawText,
      userId,
      undefined,
      resolved.companions,
      dateOverride
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Öneri hattı hatası:", err);
    return NextResponse.json(
      { error: "Öneriler üretilirken bir sorun oluştu." },
      { status: 500 }
    );
  }
}
