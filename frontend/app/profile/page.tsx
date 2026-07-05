"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/app/components/Avatar";
import { authClient } from "@/lib/auth-client";

interface VisitRow {
  id: number;
  liked: number | null;
  note: string | null;
  created_at: string;
  suggestion_title: string;
  suggestion_layer: string;
}

interface PostRow {
  id: number;
  content: string | null;
  image_url: string | null;
  created_at: string;
  suggestion_title: string | null;
  like_count: number;
}

interface QueryRow {
  id: number;
  raw_text: string;
  parsed_location: string | null;
  target_date: string | null;
  created_at: string;
}

interface ProfileData {
  user: {
    name: string;
    email: string;
    avatar_url: string | null;
    birth_date: string | null;
    home_district: string | null;
    created_at: string;
  };
  queries: QueryRow[];
  visits: VisitRow[];
  posts: PostRow[];
  summary: { summary_text: string; updated_at: string } | null;
}

const LAYER_TR: Record<string, string> = {
  ticketed: "biletli",
  free: "ücretsiz",
  venue: "mekan",
  experience: "deneyim",
};

const LAYER_ICON: Record<string, string> = {
  ticketed: "🎟",
  free: "🎈",
  venue: "📍",
  experience: "🧭",
};

type Tab = "visits" | "posts" | "searches" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "visits", label: "🧭 Gittiklerim" },
  { key: "posts", label: "📝 Paylaşımlarım" },
  { key: "searches", label: "🔍 Aramalarım" },
  { key: "settings", label: "⚙️ Ayarlar" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("visits");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ayarlar formu
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [district, setDistrict] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/profile")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d: ProfileData | null) => {
        if (!d) return;
        setData(d);
        setName(d.user.name ?? "");
        setBirthDate(d.user.birth_date ?? "");
        setDistrict(d.user.home_district ?? "");
      })
      .catch(() => setError("Profil yüklenemedi."));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.set("avatar", file);
    const res = await fetch("/api/profile/update", { method: "POST", body: form });
    if (res.ok) load();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("birth_date", birthDate);
      form.set("home_district", district);
      const res = await fetch("/api/profile/update", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Kaydedilemedi.");
      // üst menüdeki isim de güncellensin diye auth tarafına da yaz
      if (name.trim()) await authClient.updateUser({ name: name.trim() });
      setSaveMsg("Kaydedildi ✓");
      load();
      router.refresh();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Bir sorun oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data)
    return <p className="font-mono text-sm text-dusk-300">yükleniyor…</p>;

  const memberSince = data.user.created_at?.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ---- Kapak + profil kartı ---- */}
      <section className="overflow-hidden rounded-3xl border border-dusk-700/60 bg-dusk-900 shadow-sm">
        <div className="brand-panel relative h-36 sm:h-44">
          <div className="absolute inset-0 flex items-center justify-center opacity-90">
            <div className="text-center">
              <p className="font-display text-2xl font-semibold tracking-[0.35em]">
                LOKÁL
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.3em] opacity-80">
                ŞEHRİ HİSSET, ANI YAŞA
              </p>
            </div>
          </div>
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-14 flex flex-col items-center">
            <div className="relative">
              <Avatar
                name={data.user.name}
                imageUrl={data.user.avatar_url}
                size="xl"
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                title="Profil fotoğrafını değiştir"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-dusk-900 bg-amber-glow text-sm text-dusk-900"
              >
                📷
              </button>
            </div>

            <h1 className="mt-3 font-display text-2xl font-semibold text-dusk-100">
              {data.user.name}
            </h1>
            <div className="mt-1 h-1 w-12 rounded-full bg-amber-glow" />

            <div className="mt-4 w-full max-w-md rounded-2xl bg-dusk-800 p-4 text-sm">
              <p>
                <span className="font-semibold">E-posta:</span> {data.user.email}
              </p>
              <div className="mt-1 flex flex-wrap justify-between gap-2">
                <p>
                  <span className="font-semibold">Semt:</span>{" "}
                  {data.user.home_district ?? "—"}
                </p>
                <p className="text-dusk-200">üyelik: {memberSince}</p>
              </div>
            </div>

            {data.summary && (
              <p className="mt-3 max-w-md text-center text-sm italic text-lavender">
                “{data.summary.summary_text}”
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Sekmeler ---- */}
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 font-mono text-xs transition-colors ${
              tab === t.key
                ? "btn-primary"
                : "border border-dusk-700 text-dusk-200 hover:border-dusk-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ---- Gittiklerim ---- */}
      {tab === "visits" &&
        (data.visits.length === 0 ? (
          <Empty text='Henüz "Gittim" işaretlediğin bir öneri yok.' />
        ) : (
          <ul className="space-y-3">
            {data.visits.map((v) => (
              <li
                key={v.id}
                className="rounded-2xl border border-dusk-700/60 bg-dusk-900 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-dusk-100">
                    {LAYER_ICON[v.suggestion_layer]} {v.suggestion_title}
                  </span>
                  <span className="font-mono text-xs text-dusk-300">
                    {LAYER_TR[v.suggestion_layer] ?? v.suggestion_layer} ·{" "}
                    {v.liked === 1 ? "👍" : v.liked === 0 ? "👎" : "—"}
                  </span>
                </div>
                {v.note && (
                  <p className="mt-2 text-sm italic text-dusk-200">“{v.note}”</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-dusk-300">
                  {v.created_at}
                </p>
              </li>
            ))}
          </ul>
        ))}

      {/* ---- Paylaşımlarım ---- */}
      {tab === "posts" &&
        (data.posts.length === 0 ? (
          <Empty text="Henüz akışta bir paylaşımın yok." />
        ) : (
          <ul className="space-y-3">
            {data.posts.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-dusk-700/60 bg-dusk-900 p-4"
              >
                {p.suggestion_title && (
                  <p className="mb-1 font-mono text-xs text-teal-glow">
                    📍 {p.suggestion_title}
                  </p>
                )}
                {p.content && (
                  <p className="text-sm text-dusk-100">{p.content}</p>
                )}
                {p.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.image_url}
                    alt=""
                    className="mt-2 max-h-64 rounded-xl border border-dusk-700 object-cover"
                  />
                )}
                <p className="mt-2 font-mono text-[10px] text-dusk-300">
                  ♥ {p.like_count} · {p.created_at}
                </p>
              </li>
            ))}
          </ul>
        ))}

      {/* ---- Aramalarım ---- */}
      {tab === "searches" &&
        (data.queries.length === 0 ? (
          <Empty text="Henüz arama yapmadın." />
        ) : (
          <ul className="space-y-3">
            {data.queries.map((q) => (
              <li key={q.id}>
                <a
                  href={`/history/${q.id}`}
                  className="block rounded-2xl border border-dusk-700/60 bg-dusk-900 p-4 transition-colors hover:border-amber-glow/60"
                >
                  <p className="text-sm text-dusk-100">
                    “{q.raw_text}”{" "}
                    <span className="font-mono text-[10px] text-teal-glow">
                      sonuçları gör →
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-dusk-300">
                    {[
                      q.parsed_location && `konum: ${q.parsed_location}`,
                      q.target_date && `tarih: ${q.target_date}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {q.created_at}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ))}

      {/* ---- Ayarlar ---- */}
      {tab === "settings" && (
        <form
          onSubmit={saveSettings}
          className="max-w-md space-y-4 rounded-2xl border border-dusk-700/60 bg-dusk-900 p-6"
        >
          <h2 className="font-display text-lg font-semibold text-dusk-100">
            Profili düzenle
          </h2>
          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-dusk-300">
              İsim
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-dusk-700 bg-dusk-950 p-3 text-dusk-100 focus:border-amber-glow focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-dusk-300">
              Doğum tarihi
            </span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-xl border border-dusk-700 bg-dusk-950 p-3 text-dusk-100 focus:border-amber-glow focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-dusk-300">
              Semt (varsayılan konum)
            </span>
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="örn. Kadıköy"
              className="w-full rounded-xl border border-dusk-700 bg-dusk-950 p-3 text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-6 py-2 text-sm"
            >
              {saving ? "kaydediliyor…" : "kaydet"}
            </button>
            {saveMsg && (
              <span className="font-mono text-xs text-teal-glow">{saveMsg}</span>
            )}
          </div>
          <p className="border-t border-dusk-700/60 pt-3 font-mono text-[11px] text-dusk-300">
            Şifreni değiştirmek için{" "}
            <a href="/forgot-password" className="text-teal-glow hover:underline">
              şifre sıfırlama
            </a>{" "}
            akışını kullanabilirsin.
          </p>
        </form>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dusk-700/60 bg-dusk-900 p-6 text-center text-sm text-dusk-200">
      {text}
    </p>
  );
}
