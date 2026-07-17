import { getDb } from "@/lib/db";
import { summarizeProfileWithLlm } from "@/lib/llm";

const LAYER_TR: Record<string, string> = {
  ticketed: "biletli etkinlik",
  free: "ücretsiz etkinlik",
  venue: "mekan",
  experience: "deneyim rotası",
};

export function getLatestProfileSummary(userId: number): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT summary_text FROM profile_summaries
       WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`
    )
    .get(userId) as { summary_text: string } | undefined;
  return row?.summary_text ?? null;
}

/**
 * Geri bildirim + arama geçmişinden karakter profili üretir ve kaydeder.
 * LLM yoksa istatistik tabanlı şablon özet üretir.
 */
export async function regenerateProfile(userId: number): Promise<string | null> {
  const db = getDb();

  const feedback = db
    .prepare(
      `SELECT f.liked, f.note, s.title, s.layer
       FROM feedback f JOIN suggestions s ON s.id = f.suggestion_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 30`
    )
    .all(userId) as { liked: number | null; note: string | null; title: string; layer: string }[];

  if (feedback.length < 3) return null; // yeterli sinyal yok

  const queries = db
    .prepare(
      `SELECT parsed_location, parsed_mood, parsed_time, parsed_companion
       FROM queries WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(userId) as {
    parsed_location: string | null;
    parsed_mood: string | null;
    parsed_time: string | null;
    parsed_companion: string | null;
  }[];

  let summary = await summarizeProfileWithLlm({
    aramalar: queries,
    geri_bildirimler: feedback.map((f) => ({
      oneri: f.title,
      katman: LAYER_TR[f.layer] ?? f.layer,
      begendi: f.liked === 1 ? "evet" : f.liked === 0 ? "hayır" : "belirsiz",
      not: f.note,
    })),
  });

  if (!summary) summary = templateSummary(feedback, queries);
  if (!summary) return null;

  db.prepare(
    "INSERT INTO profile_summaries (user_id, summary_text) VALUES (?, ?)"
  ).run(userId, summary);
  return summary;
}

/** Her 3 geri bildirimde bir profili tazele (feedback route'tan fire-and-forget çağrılır). */
export async function maybeRegenerateProfile(userId: number): Promise<void> {
  const db = getDb();
  const { c } = db
    .prepare("SELECT COUNT(*) AS c FROM feedback WHERE user_id = ?")
    .get(userId) as { c: number };
  if (c >= 3 && c % 3 === 0) {
    await regenerateProfile(userId);
  }
}

// LLM yokken: basit istatistiklerden Türkçe özet
function templateSummary(
  feedback: { liked: number | null; layer: string }[],
  queries: { parsed_mood: string | null; parsed_time: string | null; parsed_companion: string | null }[]
): string {
  const likedByLayer = new Map<string, number>();
  const dislikedByLayer = new Map<string, number>();
  for (const f of feedback) {
    if (f.liked === 1) likedByLayer.set(f.layer, (likedByLayer.get(f.layer) ?? 0) + 1);
    if (f.liked === 0) dislikedByLayer.set(f.layer, (dislikedByLayer.get(f.layer) ?? 0) + 1);
  }
  const topLiked = [...likedByLayer.entries()].sort((a, b) => b[1] - a[1])[0];
  const topDisliked = [...dislikedByLayer.entries()].sort((a, b) => b[1] - a[1])[0];

  const count = (arr: (string | null)[], val: string) =>
    arr.filter((x) => x === val).length;
  const times = queries.map((q) => q.parsed_time);
  const prefersEvening = count(times, "evening") + count(times, "night") > times.length / 2;
  const moods = queries.map((q) => q.parsed_mood);
  const lowEnergy = count(moods, "low") > moods.length / 2;

  const parts: string[] = [];
  if (topLiked) parts.push(`En çok ${LAYER_TR[topLiked[0]] ?? topLiked[0]} önerilerinden keyif alıyor`);
  if (topDisliked && topDisliked[0] !== topLiked?.[0])
    parts.push(`${LAYER_TR[topDisliked[0]] ?? topDisliked[0]} önerilerine mesafeli`);
  parts.push(prefersEvening ? "genellikle akşam planları yapıyor" : "gündüz planlarına açık");
  if (lowEnergy) parts.push("sakin, düşük tempolu aktiviteleri tercih ediyor");

  return parts.join("; ") + ".";
}
