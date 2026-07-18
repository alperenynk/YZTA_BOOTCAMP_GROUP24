import { getDb } from "@/lib/db";
import sharp from "sharp";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Paylaşım linki için OG görseli (1200x630) — WhatsApp/Twitter kartı
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(token)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.title, s.steps_json, q.target_date, u.name AS owner
       FROM suggestions s
       JOIN queries q ON q.id = s.query_id
       JOIN users u ON u.id = q.user_id
       WHERE s.share_token = ?`
    )
    .get(token) as
    | { title: string; steps_json: string | null; target_date: string | null; owner: string }
    | undefined;

  if (!row) return new Response("Bulunamadı", { status: 404 });

  const stepCount = row.steps_json ? JSON.parse(row.steps_json).length : 0;
  // uzun başlığı iki satıra böl
  const words = row.title.split(" ");
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    if (line1.length + w.length < 28) line1 += (line1 ? " " : "") + w;
    else if (line2.length + w.length < 28) line2 += (line2 ? " " : "") + w;
    else {
      line2 += "…";
      break;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a5d43"/>
      <stop offset="1" stop-color="#33402e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="180" fill="#ffffff" opacity="0.06"/>
  <circle cx="120" cy="560" r="140" fill="#ffffff" opacity="0.06"/>
  <text x="90" y="130" font-family="Georgia, serif" font-size="44" letter-spacing="18" fill="#f4f7f1" font-weight="bold">LOKÁL</text>
  <text x="90" y="175" font-family="monospace" font-size="20" letter-spacing="8" fill="#c9d6c0">ŞEHRİ HİSSET, ANI YAŞA</text>
  <text x="90" y="330" font-family="Georgia, serif" font-size="64" fill="#ffffff" font-weight="bold">${esc(line1)}</text>
  ${line2 ? `<text x="90" y="410" font-family="Georgia, serif" font-size="64" fill="#ffffff" font-weight="bold">${esc(line2)}</text>` : ""}
  <text x="90" y="500" font-family="sans-serif" font-size="30" fill="#dbe6d3">🧭 ${stepCount} duraklı deneyim rotası${row.target_date ? ` · ${esc(row.target_date)}` : ""}</text>
  <text x="90" y="560" font-family="sans-serif" font-size="26" fill="#aebfa3">${esc(row.owner)} paylaştı — sen de rotanı çıkar</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
