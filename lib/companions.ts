import { getDb } from "@/lib/db";
import { getLatestProfileSummary } from "@/lib/profile";
import type { CompanionProfile } from "@/lib/suggest";

/**
 * Grup planı: e-postalardan arkadaş profillerini çözer, grubu kaydeder.
 * Bulunamayan e-posta varsa hata mesajı döner.
 */
export function resolveCompanions(
  emails: unknown,
  ownerId: number
): { companions: CompanionProfile[] } | { error: string } {
  if (!Array.isArray(emails) || emails.length === 0) return { companions: [] };
  if (emails.length > 3) return { error: "En fazla 3 arkadaş ekleyebilirsin." };

  const db = getDb();
  const companions: CompanionProfile[] = [];
  const memberIds: number[] = [];
  const unknown: string[] = [];

  for (const raw of emails) {
    const email = String(raw).trim().toLocaleLowerCase("tr");
    if (!email) continue;
    const user = db
      .prepare("SELECT id, name FROM users WHERE lower(email) = ? AND id != ?")
      .get(email, ownerId) as { id: number; name: string } | undefined;
    if (!user) {
      unknown.push(email);
      continue;
    }
    memberIds.push(user.id);
    companions.push({
      name: user.name,
      summary: getLatestProfileSummary(user.id),
    });
  }

  if (unknown.length > 0) {
    return {
      error: `Bu e-postalarla kayıtlı kullanıcı bulunamadı: ${unknown.join(", ")}. Arkadaşının önce Lokál'e kayıt olması gerekiyor.`,
    };
  }

  // Grubu kaydet (Faz 2 şeması nihayet iş başında)
  if (memberIds.length > 0) {
    const g = db
      .prepare("INSERT INTO groups (name, created_by) VALUES (?, ?)")
      .run(`Plan · ${new Date().toISOString().slice(0, 10)}`, ownerId);
    const gid = Number(g.lastInsertRowid);
    const ins = db.prepare(
      "INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)"
    );
    ins.run(gid, ownerId);
    for (const id of memberIds) ins.run(gid, id);
  }

  return { companions };
}
