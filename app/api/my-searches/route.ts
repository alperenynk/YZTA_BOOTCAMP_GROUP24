import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAppUserId } from "@/lib/session";

// Ana sayfadaki "son aramaların" şeridi için hafif uç
export async function GET(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  const db = getDb();
  const searches = db
    .prepare(
      `SELECT id, raw_text, parsed_location, created_at
       FROM queries WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 4`
    )
    .all(userId);

  return NextResponse.json({ searches });
}
