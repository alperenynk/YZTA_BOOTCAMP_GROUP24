import { NextResponse } from "next/server";
import { AssemblyAI } from "assemblyai";
import { getAppUserId } from "@/lib/session";
import { isRateLimited, rateLimitMessage } from "@/lib/ratelimit";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB (~kısa sesli not için bol bol)

function apiKey(): string | null {
  const key = process.env.ASSEMBLYAI_API_KEY;
  return key && key.trim() && !key.startsWith("your-") ? key : null;
}

/**
 * Sesli arama: tarayıcı mikrofonundan gelen kısa kaydı metne çevirir.
 * AssemblyAI Universal-3.5-Pro (Türkçe 18 yerel dilden biri; kod geçişi doğal).
 * Anahtar sunucuda kalır — istemciye asla gitmez.
 */
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  // sesli arama sonuçta bir arama başlatır — aynı kota havuzunu kullan
  if (isRateLimited("search", userId)) {
    return NextResponse.json({ error: rateLimitMessage("search") }, { status: 429 });
  }

  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { error: "Sesli arama için AssemblyAI anahtarı gerekli (mock modda kapalı)." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Ses kaydı bulunamadı." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Kayıt çok büyük (en fazla 10 MB)." },
      { status: 400 }
    );
  }

  try {
    const client = new AssemblyAI({ apiKey: key });
    // SDK upload + submit + polling'i kendisi yönetir
    const transcript = await client.transcripts.transcribe({
      audio: Buffer.from(await audio.arrayBuffer()),
      speech_models: ["universal-3-5-pro", "universal-2"],
      prompt:
        "Türkçe kısa sesli not: kullanıcı nerede olduğunu, kiminle olduğunu, nasıl hissettiğini ve bugün ne yapmak istediğini anlatıyor.",
    });

    if (transcript.status === "error") {
      console.error("AssemblyAI hatası:", transcript.error);
      return NextResponse.json(
        { error: "Ses çözümlenemedi, tekrar dener misin?" },
        { status: 502 }
      );
    }

    const text = (transcript.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Kayıtta konuşma algılanamadı — biraz daha yakın konuşmayı dene." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Sesli arama hatası:", err);
    return NextResponse.json(
      { error: "Ses servisi şu an yanıt vermiyor." },
      { status: 502 }
    );
  }
}
