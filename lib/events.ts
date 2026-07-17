import { getDb } from "@/lib/db";

export interface StoredEvent {
  title: string;
  meta: string;
  source_url: string | null;
}

/**
 * Kendi etkinlik veritabanından hedef tarihe uyanları getirir.
 * Cron (/api/cron/events) tarafından doldurulur.
 */
export function getStoredEvents(
  targetDate: string,
  location: string | null
): { ticketed: StoredEvent[]; free: StoredEvent[]; enough: boolean } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT title, meta, layer, source_url FROM events
       WHERE event_date = ?
         AND (location IS NULL OR location = 'İstanbul' OR location = ? OR ? IS NULL)
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(targetDate, location, location) as {
    title: string;
    meta: string | null;
    layer: "ticketed" | "free";
    source_url: string | null;
  }[];

  const ticketed = rows
    .filter((r) => r.layer === "ticketed")
    .slice(0, 3)
    .map((r) => ({ title: r.title, meta: r.meta ?? "", source_url: r.source_url }));
  const free = rows
    .filter((r) => r.layer === "free")
    .slice(0, 3)
    .map((r) => ({ title: r.title, meta: r.meta ?? "", source_url: r.source_url }));

  return {
    ticketed,
    free,
    enough: ticketed.length >= 2 && free.length >= 2,
  };
}

export function upsertEvents(
  events: {
    title: string;
    meta: string;
    layer: "ticketed" | "free";
    source_url: string | null;
    event_date: string;
    location: string | null;
  }[]
): number {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO events (title, meta, layer, source_url, event_date, location)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(title, event_date) DO UPDATE SET
       meta = excluded.meta, source_url = excluded.source_url, location = excluded.location`
  );
  let count = 0;
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.event_date)) continue;
    insert.run(e.title, e.meta, e.layer, e.source_url, e.event_date, e.location);
    count++;
  }
  return count;
}
