import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Üst menü ve composer avatarı için hafif kimlik ucu
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT name, avatar_path FROM users WHERE id = ?")
    .get(userId) as { name: string; avatar_path: string | null };

  return NextResponse.json({
    name: user.name,
    avatar_url: user.avatar_path ? `/api/uploads/${user.avatar_path}` : null,
  });
}
