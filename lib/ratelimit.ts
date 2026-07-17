import { getDb } from "@/lib/db";

// Saatlik kullanım sınırları (kullanıcı başına)
export const LIMITS = {
  search: 15, // LLM maliyeti — queries tablosundan sayılır
  post: 10, // spam koruması
  comment: 30,
} as const;

const TABLE_BY_KIND = {
  search: "queries",
  post: "posts",
  comment: "post_comments",
} as const;

/** Son 1 saatteki kayıt sayısı sınırı aşıyorsa true döner. */
export function isRateLimited(
  kind: keyof typeof LIMITS,
  userId: number
): boolean {
  const db = getDb();
  const { c } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ${TABLE_BY_KIND[kind]}
       WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`
    )
    .get(userId) as { c: number };
  return c >= LIMITS[kind];
}

export function rateLimitMessage(kind: keyof typeof LIMITS): string {
  const label = { search: "arama", post: "paylaşım", comment: "yorum" }[kind];
  return `Saatlik ${label} sınırına ulaştın (${LIMITS[kind]}). Biraz sonra tekrar dene.`;
}
