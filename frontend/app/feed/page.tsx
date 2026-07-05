"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoginModal from "@/app/components/LoginModal";
import Avatar from "@/app/components/Avatar";
import { authClient } from "@/lib/auth-client";

interface FeedPost {
  id: number;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_name: string;
  avatar_url: string | null;
  suggestion_title: string | null;
  suggestion_layer: string | null;
  visit_liked: number | null;
  like_count: number;
  liked_by_me: number;
}

interface Visit {
  id: number;
  title: string;
  layer: string;
}

const LAYER_TR: Record<string, string> = {
  ticketed: "biletli etkinlik",
  free: "ücretsiz etkinlik",
  venue: "mekan",
  experience: "deneyim rotası",
};

const LAYER_ICON: Record<string, string> = {
  ticketed: "🎟",
  free: "🎈",
  venue: "📍",
  experience: "🧭",
};

// "22s / 5dk / 3sa / 2g" tarzı zaman etiketi (SQLite UTC saklar)
function timeAgo(sqliteUtc: string): string {
  const then = new Date(sqliteUtc.replace(" ", "T") + "Z").getTime();
  const diff = Math.max(0, Date.now() - then) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return `${Math.floor(diff / 86400)}g`;
}

export default function FeedPage() {
  const { data: session, isPending } = authClient.useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showLogin, setShowLogin] = useState(false);

  // composer durumu
  const [content, setContent] = useState("");
  const [suggestionId, setSuggestionId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFeed = useCallback(() => {
    fetch("/api/feed")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]));
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/my-visits")
      .then((res) => (res.ok ? res.json() : { visits: [] }))
      .then((d) => setVisits(d.visits ?? []))
      .catch(() => {});
  }, [session]);

  function guardAuth(): boolean {
    if (isPending) return false;
    if (!session) {
      setShowLogin(true);
      return false;
    }
    return true;
  }

  function pickImage(file: File | null) {
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleShare() {
    if (!guardAuth()) return;
    if (!content.trim() && !imageFile && !suggestionId) {
      setError("Bir şeyler yaz, görsel ekle ya da etkinlik seç.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("content", content.trim());
      if (suggestionId) form.set("suggestion_id", suggestionId);
      if (imageFile) form.set("image", imageFile);

      const res = await fetch("/api/posts", { method: "POST", body: form });
      if (res.status === 401) {
        setShowLogin(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Paylaşılamadı.");

      setContent("");
      setSuggestionId("");
      pickImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir sorun oluştu.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: FeedPost) {
    if (!guardAuth()) return;
    // iyimser güncelleme
    setPosts(
      (prev) =>
        prev?.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked_by_me: p.liked_by_me ? 0 : 1,
                like_count: p.like_count + (p.liked_by_me ? -1 : 1),
              }
            : p
        ) ?? null
    );
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) loadFeed(); // hata olursa gerçek durumu geri çek
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      <h1 className="font-display text-2xl font-semibold text-dusk-100">
        Akış
      </h1>

      {/* ---- Composer ---- */}
      <div className="rounded-2xl border border-dusk-700 bg-dusk-900/80 p-4">
        <div className="flex gap-3">
          <Avatar name={session?.user.name ?? "?"} />
          <div className="min-w-0 flex-1 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => guardAuth()}
              placeholder="Ne yenilikler var?"
              rows={2}
              maxLength={500}
              className="w-full resize-none bg-transparent text-dusk-100 placeholder:text-dusk-300 focus:outline-none"
            />

            {imagePreview && (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Yüklenecek görsel"
                  className="max-h-56 rounded-xl border border-dusk-700 object-cover"
                />
                <button
                  onClick={() => {
                    pickImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            )}

            {suggestionId && (
              <p className="font-mono text-xs text-teal-glow">
                {LAYER_ICON[visits.find((v) => String(v.id) === suggestionId)?.layer ?? ""] ?? "📍"}{" "}
                {visits.find((v) => String(v.id) === suggestionId)?.title}
                <button
                  onClick={() => setSuggestionId("")}
                  className="ml-2 text-dusk-300 hover:text-dusk-100"
                >
                  ✕
                </button>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-dusk-700/60 pt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (!guardAuth()) return;
                  pickImage(e.target.files?.[0] ?? null);
                }}
              />
              <button
                onClick={() => {
                  if (guardAuth()) fileInputRef.current?.click();
                }}
                title="Görsel ekle"
                className="rounded-full border border-dusk-600 px-3 py-1 font-mono text-xs text-dusk-200 hover:border-amber-glow"
              >
                🖼 görsel
              </button>

              <select
                value={suggestionId}
                onChange={(e) => {
                  if (!guardAuth()) return;
                  setSuggestionId(e.target.value);
                }}
                className="max-w-[220px] rounded-full border border-dusk-600 bg-dusk-900 px-3 py-1 font-mono text-xs text-dusk-200 focus:border-amber-glow focus:outline-none"
              >
                <option value="">🧭 gittiğim etkinlik…</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {LAYER_ICON[v.layer]} {v.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handleShare}
                disabled={posting}
                className="btn-primary ml-auto px-5 py-1.5 text-xs"
              >
                {posting ? "paylaşılıyor…" : "Paylaş"}
              </button>
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
            {session && visits.length === 0 && (
              <p className="font-mono text-[10px] text-dusk-300">
                ipucu: bir öneriye &quot;Gittim&quot; dediğinde burada
                etiketleyebilirsin
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- Akış ---- */}
      {posts === null ? (
        <p className="font-mono text-sm text-dusk-300">akış yükleniyor…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dusk-700 bg-dusk-900/60 p-6 text-center text-sm text-dusk-200">
          Henüz paylaşım yok — ilk anıyı sen paylaş! 🎉
        </p>
      ) : (
        <ul className="divide-y divide-dusk-700/60 rounded-2xl border border-dusk-700 bg-dusk-900/60">
          {posts.map((p) => (
            <li key={p.id} className="flex gap-3 p-4">
              <Avatar name={p.user_name} imageUrl={p.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-dusk-100">
                    {p.user_name}
                  </span>{" "}
                  <span className="font-mono text-xs text-dusk-300">
                    {timeAgo(p.created_at)}
                  </span>
                </p>

                {p.suggestion_title && (
                  <p className="mt-1 inline-block rounded-full border border-teal-glow/40 bg-teal-glow/5 px-2.5 py-0.5 font-mono text-[11px] text-teal-glow">
                    {LAYER_ICON[p.suggestion_layer ?? ""] ?? "📍"}{" "}
                    {p.suggestion_title}
                    <span className="text-dusk-300">
                      {" "}
                      · {LAYER_TR[p.suggestion_layer ?? ""] ?? ""}
                    </span>
                    {p.visit_liked === 1 && " · beğendi 👍"}
                    {p.visit_liked === 0 && " · beğenmedi 👎"}
                  </p>
                )}

                {p.content && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-dusk-100">
                    {p.content}
                  </p>
                )}

                {p.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.image_url}
                    alt="Paylaşılan görsel"
                    loading="lazy"
                    className="mt-2 max-h-96 w-auto rounded-xl border border-dusk-700 object-cover"
                  />
                )}

                <div className="mt-2 flex items-center gap-5 text-dusk-300">
                  <button
                    onClick={() => toggleLike(p)}
                    className={`flex items-center gap-1.5 font-mono text-xs transition-colors hover:text-amber-glow ${
                      p.liked_by_me ? "text-amber-glow" : ""
                    }`}
                  >
                    {p.liked_by_me ? "♥" : "♡"}
                    {p.like_count > 0 && <span>{p.like_count}</span>}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
