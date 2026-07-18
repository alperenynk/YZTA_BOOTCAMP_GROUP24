import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { notify, actorName } from "@/lib/notifications";

// Gelen arkadaşlık isteğini kabul et / reddet
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: { user_id?: number; accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const requesterId = Number(body.user_id);
  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    return NextResponse.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
  }

  const db = getDb();
  const pending = db
    .prepare(
      "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
    )
    .get(requesterId, userId);
  if (!pending) {
    return NextResponse.json({ error: "Bekleyen istek bulunamadı." }, { status: 404 });
  }

  if (body.accept) {
    db.prepare(
      "UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?"
    ).run(requesterId, userId);
    notify({
      userId: requesterId,
      actorId: userId,
      type: "friend_accept",
      message: `${actorName(userId)} arkadaşlık isteğini kabul etti 🎉`,
    });
  } else {
    db.prepare(
      "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?"
    ).run(requesterId, userId);
  }

  return NextResponse.json({ ok: true });
}
