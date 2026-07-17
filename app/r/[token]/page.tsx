import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import type { ExperienceStep } from "@/lib/types";

interface SharedRow {
  title: string;
  meta: string | null;
  reason_text: string | null;
  steps_json: string | null;
  target_date: string | null;
  owner_name: string;
}

function getShared(token: string): SharedRow | null {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(token)) return null;
  const row = getDb()
    .prepare(
      `SELECT s.title, s.meta, s.reason_text, s.steps_json,
              q.target_date, u.name AS owner_name
       FROM suggestions s
       JOIN queries q ON q.id = s.query_id
       JOIN users u ON u.id = q.user_id
       WHERE s.share_token = ?`
    )
    .get(token) as SharedRow | undefined;
  return row ?? null;
}

// WhatsApp/Twitter önizleme kartı için OG meta
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const row = getShared(token);
  if (!row) return { title: "Lokál" };

  const description = `${row.owner_name} bir deneyim rotası paylaştı${row.target_date ? ` · ${row.target_date}` : ""} — sen de ruh haline göre rotanı çıkar.`;
  return {
    title: `${row.title} — Lokál`,
    description,
    openGraph: {
      title: row.title,
      description,
      images: [{ url: `/api/og/${token}`, width: 1200, height: 630 }],
      siteName: "Lokál",
    },
    twitter: {
      card: "summary_large_image",
      title: row.title,
      description,
      images: [`/api/og/${token}`],
    },
  };
}

// Herkese açık paylaşılan rota sayfası — üyelik gerekmez (server component)
export default async function SharedRoutePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = getShared(token);
  if (!data) notFound();

  const steps: ExperienceStep[] = data.steps_json
    ? JSON.parse(data.steps_json)
    : [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="brand-panel rounded-3xl p-6 text-center">
        <p className="font-display text-xl font-semibold tracking-[0.3em]">LOKÁL</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.25em] opacity-80">
          ŞEHRİ HİSSET, ANI YAŞA
        </p>
      </div>

      <div className="rounded-3xl border border-dusk-700/50 p-6 shadow-sm card-experience">
        <p className="font-mono text-[11px] text-dusk-300">
          {data.owner_name} bir rota paylaştı
          {data.target_date && ` · ${data.target_date}`}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-dusk-100">
          {data.title}
        </h1>

        {steps.length > 0 && (
          <ol className="route-line mt-5 ml-2 space-y-4 pl-5">
            {steps.map((step, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-amber-glow" />
                <div className="font-mono text-xs text-amber-soft">{step.time}</div>
                <div className="font-medium text-dusk-100">{step.title}</div>
                <div className="text-sm text-dusk-200">{step.description}</div>
              </li>
            ))}
          </ol>
        )}

        {data.reason_text && (
          <p className="mt-4 border-t border-dusk-700/40 pt-3 text-sm italic text-lavender">
            {data.reason_text}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-dusk-700/60 bg-dusk-900 p-6 text-center">
        <p className="text-sm text-dusk-100">
          Sen de ruh haline ve semtine göre sana özel rotalar almak ister misin?
        </p>
        <Link href="/register" className="btn-primary mt-3 inline-block px-6 py-2 text-sm">
          Lokál&apos;e ücretsiz katıl
        </Link>
      </div>
    </div>
  );
}
