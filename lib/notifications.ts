import { getDb } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

/**
 * Bildirim üret (kendine bildirim atılmaz).
 * type: like | comment | friend_request | friend_accept | report
 * Web push aboneliği varsa cihaza da iletilir (en iyi çaba).
 */
export function notify(opts: {
  userId: number; // alıcı
  actorId?: number; // olayı yapan (alıcıyla aynıysa atlanır)
  type: string;
  message: string;
  postId?: number | null;
}): void {
  if (opts.actorId && opts.actorId === opts.userId) return;
  getDb()
    .prepare(
      `INSERT INTO notifications (user_id, type, message, post_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(opts.userId, opts.type, opts.message, opts.postId ?? null);

  void sendPushToUser(opts.userId, "Lokál", opts.message).catch(() => {});
}

export function actorName(userId: number): string {
  const row = getDb()
    .prepare("SELECT name FROM users WHERE id = ?")
    .get(userId) as { name: string } | undefined;
  return row?.name ?? "Biri";
}
