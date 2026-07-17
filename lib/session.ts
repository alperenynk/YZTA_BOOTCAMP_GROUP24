import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Better Auth oturumundan uygulama içi (integer) kullanıcı id'sini çözer.
 * İlk girişte users tablosunda satır yoksa oluşturur.
 * Oturum yoksa null döner.
 */
export async function getAppUserId(headers: Headers): Promise<number | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE auth_id = ?")
    .get(session.user.id) as { id: number } | undefined;
  if (existing) return existing.id;

  db.prepare(
    `INSERT INTO users (name, email, auth_id) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET auth_id = excluded.auth_id, name = excluded.name`
  ).run(session.user.name || "Kullanıcı", session.user.email, session.user.id);

  const row = db
    .prepare("SELECT id FROM users WHERE auth_id = ?")
    .get(session.user.id) as { id: number };
  return row.id;
}

/** Oturum + admin bilgisi (ADMIN_EMAILS env'indeki e-postalar moderatördür). */
export async function getSessionInfo(
  headers: Headers
): Promise<{ userId: number; isAdmin: boolean } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const userId = await getAppUserId(headers);
  if (!userId) return null;

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLocaleLowerCase("tr"))
    .filter(Boolean);
  const isAdmin = admins.includes(session.user.email.toLocaleLowerCase("tr"));
  return { userId, isAdmin };
}
