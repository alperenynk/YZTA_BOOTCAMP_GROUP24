"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoginModal from "@/app/components/LoginModal";
import Avatar from "@/app/components/Avatar";
import { toast } from "@/app/components/Toaster";
import { askConfirm, askInput } from "@/app/components/DialogHost";
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
  comment_count: number;
  is_mine: number;
}

interface Visit {
  id: number;
  title: string;
  layer: string;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_name: string;
  avatar_url: string | null;
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
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  // yorumlar: açık olan postlar ve içerikleri
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});

  // composer durumu
  const [content, setContent] = useState("");
  const [suggestionId, setSuggestionId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(() => {
    fetch("/api/feed")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((d) => {
        setPosts(d.posts ?? []);
        setIsAdmin(Boolean(d.viewer_is_admin));
        setHasMore(Boolean(d.has_more));
      })
      .catch(() => setPosts([]));
  }, []);

  async function loadMore() {
    if (!posts || posts.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const last = posts[posts.length - 1].id;
      const res = await fetch(`/api/feed?before=${last}`);
      if (!res.ok) return;
      const d = await res.json();
      setPosts((prev) => [...(prev ?? []), ...(d.posts ?? [])]);
      setHasMore(Boolean(d.has_more));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/my-visits")
      .then((res) => (res.ok ? res.json() : { visits: [] }))
      .then((d) => setVisits(d.visits ?? []))
      .catch(() => {});
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMyAvatar(d.avatar_url))
      .catch(() => {});
  }, [session]);

  async function deletePost(postId: number) {
    const ok = await askConfirm({
      title: "Paylaşımı sil?",
      message: "Bu paylaşım, beğenileri ve yorumlarıyla birlikte kalıcı olarak silinir.",
      confirmLabel: "sil",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
      toast("Paylaşım silindi.", "success");
    } else {
      toast("Silinemedi — bir daha dener misin?", "error");
    }
  }

  async function reportPost(postId: number) {
    if (!guardAuth()) return;
    const reason = await askInput({
      title: "Paylaşımı şikayet et",
      message: "Neden şikayet ediyorsun? (isteğe bağlı)",
      placeholder: "örn. uygunsuz içerik",
      confirmLabel: "şikayet et",
    });
    if (reason === null) return;
    const res = await fetch(`/api/posts/${postId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const d = await res.json();
    if (res.ok) toast("Şikayetin alındı, inceleyeceğiz. 🛡", "success");
    else toast(d.error ?? "Olmadı — bir daha dener misin?", "error");
  }

  async function toggleComments(postId: number) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    if (!comments[postId]) {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const d = await res.json();
        setComments((prev) => ({ ...prev, [postId]: d.comments ?? [] }));
      }
    }
  }

  async function sendComment(postId: number) {
    if (!guardAuth()) return;
    const content = (commentDraft[postId] ?? "").trim();
    if (!content) return;
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.status === 401) {
      setShowLogin(true);
      return;
    }
    if (!res.ok) return;
    setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
    // listeyi tazele + sayacı artır
    const d = await fetch(`/api/posts/${postId}/comments`).then((r) => r.json());
    setComments((prev) => ({ ...prev, [postId]: d.comments ?? [] }));
    setPosts(
      (prev) =>
        prev?.map((p) =>
          p.id === postId ? { ...p, comment_count: (d.comments ?? []).length } : p
        ) ?? null
    );
  }

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
          <Avatar name={session?.user.name ?? "?"} imageUrl={myAvatar} />
          <div className="min-w-0 flex-1 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => guardAuth()}
              aria-label="Yeni paylaşım metni"
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
                <p className="flex items-center text-sm">
                  <span className="font-semibold text-dusk-100">
                    {p.user_name}
                  </span>
                  <span className="ml-2 font-mono text-xs text-dusk-300">
                    {timeAgo(p.created_at)}
                  </span>
                  {p.is_mine === 1 || isAdmin ? (
                    <button
                      onClick={() => deletePost(p.id)}
                      title={p.is_mine ? "Paylaşımı sil" : "Moderatör: sil"}
                      className="ml-auto font-mono text-xs text-dusk-300 transition-colors hover:text-red-400"
                    >
                      {p.is_mine ? "sil ✕" : "🛡 sil"}
                    </button>
                  ) : (
                    <button
                      onClick={() => reportPost(p.id)}
                      title="Şikayet et"
                      aria-label="Paylaşımı şikayet et"
                      className="ml-auto font-mono text-xs text-dusk-300/60 transition-colors hover:text-amber-glow"
                    >
                      ⚑
                    </button>
                  )}
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
                    aria-label={p.liked_by_me ? "Beğeniyi geri al" : "Beğen"}
                    className={`flex items-center gap-1.5 font-mono text-xs transition-colors hover:text-amber-glow ${
                      p.liked_by_me ? "text-amber-glow" : ""
                    }`}
                  >
                    <span className={p.liked_by_me ? "heart-pop" : ""}>
                      {p.liked_by_me ? "♥" : "♡"}
                    </span>
                    {p.like_count > 0 && <span>{p.like_count}</span>}
                  </button>
                  <button
                    onClick={() => toggleComments(p.id)}
                    aria-label={`Yorumlar (${p.comment_count})`}
                    aria-expanded={openComments.has(p.id)}
                    className="flex items-center gap-1.5 font-mono text-xs transition-colors hover:text-teal-glow"
                  >
                    💬{p.comment_count > 0 && <span>{p.comment_count}</span>}
                  </button>
                </div>

                {openComments.has(p.id) && (
                  <div className="mt-3 space-y-2 rounded-2xl bg-dusk-800/60 p-3">
                    {(comments[p.id] ?? []).map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar
                          name={c.user_name}
                          imageUrl={c.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs">
                            <span className="font-semibold text-dusk-100">
                              {c.user_name}
                            </span>{" "}
                            <span className="font-mono text-[10px] text-dusk-300">
                              {timeAgo(c.created_at)}
                            </span>
                          </p>
                          <p className="text-sm text-dusk-100">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {comments[p.id] && comments[p.id].length === 0 && (
                      <p className="font-mono text-[11px] text-dusk-300">
                        ilk yorumu sen yaz ✨
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={commentDraft[p.id] ?? ""}
                        onChange={(e) =>
                          setCommentDraft((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && sendComment(p.id)}
                        placeholder="Yorum yaz…"
                        maxLength={300}
                        className="flex-1 rounded-full border border-dusk-700 bg-dusk-900 px-3 py-1.5 text-sm text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
                      />
                      <button
                        onClick={() => sendComment(p.id)}
                        disabled={!(commentDraft[p.id] ?? "").trim()}
                        className="btn-primary px-4 py-1.5 text-xs"
                      >
                        gönder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-dusk-700 px-6 py-2 font-mono text-xs text-dusk-200 transition-colors hover:border-amber-glow hover:text-dusk-100 disabled:opacity-40"
          >
            {loadingMore ? "yükleniyor…" : "daha fazla göster ↓"}
          </button>
        </div>
      )}
    </div>
  );
}
