import { NextResponse } from "next/server";
import { runSuggestionPipeline } from "@/lib/suggest";
import { getAppUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: { raw_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
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

  try {
    const result = await runSuggestionPipeline(rawText, userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Öneri hattı hatası:", err);
    return NextResponse.json(
      { error: "Öneriler üretilirken bir sorun oluştu." },
      { status: 500 }
    );
  }
}
