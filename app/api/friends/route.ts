import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";
import { notify, actorName } from "@/lib/notifications";

interface FriendRow {
  id: number;
  name: string;
  email: string;
  avatar_path: string | null;
}

function withAvatar(rows: FriendRow[]) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatar_url: r.avatar_path ? `/api/uploads/${r.avatar_path}` : null,
  }));
}

// Arkadaş listesi + bekleyen istekler
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const db = getDb();

  const friends = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_path FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'`
    )
    .all(userId, userId, userId) as FriendRow[];

  const incoming = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_path FROM friendships f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = ? AND f.status = 'pending'`
    )
    .all(userId) as FriendRow[];

  const outgoing = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_path FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ? AND f.status = 'pending'`
    )
    .all(userId) as FriendRow[];

  return NextResponse.json({
    friends: withAvatar(friends),
    incoming: withAvatar(incoming),
    outgoing: withAvatar(outgoing),
  });
}

// Arkadaşlık isteği gönder (e-posta ile)
export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLocaleLowerCase("tr");
  if (!email) {
    return NextResponse.json({ error: "E-posta gerekli." }, { status: 400 });
  }

  const db = getDb();
  const target = db
    .prepare("SELECT id, name FROM users WHERE lower(email) = ?")
    .get(email) as { id: number; name: string } | undefined;
  if (!target) {
    return NextResponse.json(
      { error: "Bu e-postayla kayıtlı kullanıcı yok — arkadaşını Lokál'e davet et!" },
      { status: 404 }
    );
  }
  if (target.id === userId) {
    return NextResponse.json(
      { error: "Kendinle arkadaş olamazsın 🙂" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare(
      `SELECT status FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
    )
    .get(userId, target.id, target.id, userId) as { status: string } | undefined;
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.status === "accepted"
            ? "Zaten arkadaşsınız."
            : "Zaten bekleyen bir istek var.",
      },
      { status: 409 }
    );
  }

  db.prepare(
    "INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')"
  ).run(userId, target.id);

  notify({
    userId: target.id,
    actorId: userId,
    type: "friend_request",
    message: `${actorName(userId)} sana arkadaşlık isteği gönderdi 👋`,
  });

  return NextResponse.json({ ok: true, name: target.name });
}
