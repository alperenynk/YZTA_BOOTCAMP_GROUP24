import { runSuggestionPipeline } from "@/lib/suggest";
import { getAppUserId } from "@/lib/session";
import { isRateLimited, rateLimitMessage } from "@/lib/ratelimit";
import { resolveCompanions } from "@/lib/companions";

/**
 * NDJSON streaming: her satır bir JSON olayı.
 * stage → parsed → layer(lar) → done | error
 */
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (isRateLimited("search", userId)) {
    return Response.json({ error: rateLimitMessage("search") }, { status: 429 });
  }

  let body: { raw_text?: string; companions?: string[]; target_date?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const rawText = (body.raw_text ?? "").trim();
  if (!rawText || rawText.length > 1000) {
    return Response.json({ error: "Geçersiz metin." }, { status: 400 });
  }

  // arayüzden seçilen hedef tarih: bugünden geriye ve 60 günden ileriye izin yok
  let dateOverride: string | undefined;
  if (body.target_date) {
    const d = String(body.target_date);
    const today = new Date().toISOString().slice(0, 10);
    const max = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today || d > max) {
      return Response.json(
        { error: "Tarih bugün ile önümüzdeki 60 gün arasında olmalı." },
        { status: 400 }
      );
    }
    dateOverride = d;
  }

  const resolved = resolveCompanions(body.companions, userId);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runSuggestionPipeline(
          rawText,
          userId,
          send,
          resolved.companions,
          dateOverride
        );
        send({ type: "done", ...result });
      } catch (err) {
        console.error("Streaming öneri hatası:", err);
        send({ type: "error", error: "Öneriler üretilirken bir sorun oluştu." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
