import { runSuggestionPipeline } from "@/lib/suggest";
import { getAppUserId } from "@/lib/session";

/**
 * NDJSON streaming: her satır bir JSON olayı.
 * stage → parsed → layer(lar) → done | error
 */
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: { raw_text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const rawText = (body.raw_text ?? "").trim();
  if (!rawText || rawText.length > 1000) {
    return Response.json({ error: "Geçersiz metin." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runSuggestionPipeline(rawText, userId, send);
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
