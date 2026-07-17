"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Avatar from "@/app/components/Avatar";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // profil fotoğrafını hafif uçtan çek
  useEffect(() => {
    if (!session) {
      setAvatarUrl(null);
      return;
    }
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAvatarUrl(d.avatar_url))
      .catch(() => {});
  }, [session]);

  if (isPending) return null;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-amber-glow/50 px-3 py-1 text-amber-glow transition-colors hover:bg-amber-glow/10"
      >
        Giriş yap
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href="/profile"
        title="Profilim"
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-dusk-800"
      >
        <Avatar name={session.user.name} imageUrl={avatarUrl} size="sm" />
        <span className="text-dusk-100 normal-case">{session.user.name}</span>
      </Link>
      <button
        onClick={async () => {
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        }}
        className="text-dusk-300 transition-colors hover:text-dusk-100"
      >
        Çıkış
      </button>
    </span>
  );
}
