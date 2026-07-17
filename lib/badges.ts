import { getDb } from "@/lib/db";

export interface BadgeStatus {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: boolean;
  progress: string; // "2/5" gibi
}

interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  target: number;
  count: (userId: number) => number;
}

const one = (sql: string) => (userId: number) =>
  (getDb().prepare(sql).get(userId) as { c: number }).c;

const BADGES: BadgeDef[] = [
  {
    id: "ilk-adim",
    emoji: "👣",
    title: "İlk Adım",
    desc: "İlk 'Gittim' işaretin",
    target: 1,
    count: one("SELECT COUNT(*) AS c FROM feedback WHERE user_id = ? AND went = 1"),
  },
  {
    id: "kasif",
    emoji: "🗺",
    title: "Kâşif",
    desc: "3 farklı semtte arama",
    target: 3,
    count: one(
      "SELECT COUNT(DISTINCT parsed_location) AS c FROM queries WHERE user_id = ? AND parsed_location IS NOT NULL"
    ),
  },
  {
    id: "gece-kusu",
    emoji: "🦉",
    title: "Gece Kuşu",
    desc: "5 akşam/gece planı",
    target: 5,
    count: one(
      "SELECT COUNT(*) AS c FROM queries WHERE user_id = ? AND parsed_time IN ('evening','night')"
    ),
  },
  {
    id: "topluluk-insani",
    emoji: "🎉",
    title: "Topluluk İnsanı",
    desc: "5 akış paylaşımı",
    target: 5,
    count: one("SELECT COUNT(*) AS c FROM posts WHERE user_id = ?"),
  },
  {
    id: "yorumcu",
    emoji: "💬",
    title: "Muhabbet Kuşu",
    desc: "5 yorum",
    target: 5,
    count: one("SELECT COUNT(*) AS c FROM post_comments WHERE user_id = ?"),
  },
  {
    id: "rota-ustasi",
    emoji: "🧭",
    title: "Rota Ustası",
    desc: "5 deneyime gitti",
    target: 5,
    count: one("SELECT COUNT(*) AS c FROM feedback WHERE user_id = ? AND went = 1"),
  },
  {
    id: "grup-lideri",
    emoji: "👥",
    title: "Grup Lideri",
    desc: "İlk grup planın",
    target: 1,
    count: one("SELECT COUNT(*) AS c FROM groups WHERE created_by = ?"),
  },
];

export function getBadges(userId: number): BadgeStatus[] {
  return BADGES.map((b) => {
    const c = Math.min(b.count(userId), b.target);
    return {
      id: b.id,
      emoji: b.emoji,
      title: b.title,
      desc: b.desc,
      earned: c >= b.target,
      progress: `${c}/${b.target}`,
    };
  });
}

export interface ProfileStats {
  plans_month: number;
  top_layer: string | null;
  top_location: string | null;
  total_searches: number;
}

const LAYER_TR: Record<string, string> = {
  ticketed: "biletli etkinlik",
  free: "ücretsiz etkinlik",
  venue: "mekan",
  experience: "deneyim rotası",
};

export function getProfileStats(userId: number): ProfileStats {
  const db = getDb();
  const plans = db
    .prepare(
      `SELECT COUNT(*) AS c FROM feedback
       WHERE user_id = ? AND went = 1 AND created_at >= datetime('now','-30 days')`
    )
    .get(userId) as { c: number };
  const layer = db
    .prepare(
      `SELECT s.layer AS l, COUNT(*) AS c FROM feedback f
       JOIN suggestions s ON s.id = f.suggestion_id
       WHERE f.user_id = ? AND f.liked = 1
       GROUP BY s.layer ORDER BY c DESC LIMIT 1`
    )
    .get(userId) as { l: string } | undefined;
  const loc = db
    .prepare(
      `SELECT parsed_location AS l, COUNT(*) AS c FROM queries
       WHERE user_id = ? AND parsed_location IS NOT NULL
       GROUP BY parsed_location ORDER BY c DESC LIMIT 1`
    )
    .get(userId) as { l: string } | undefined;
  const searches = db
    .prepare("SELECT COUNT(*) AS c FROM queries WHERE user_id = ?")
    .get(userId) as { c: number };

  return {
    plans_month: plans.c,
    top_layer: layer ? (LAYER_TR[layer.l] ?? layer.l) : null,
    top_location: loc?.l ?? null,
    total_searches: searches.c,
  };
}
