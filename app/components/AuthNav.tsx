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
      <Link href="/login" className="app-nav-outline">
        Giriş yap
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href="/profile"
        title="Profilim"
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-dusk-800/70"
      >
        <Avatar name={session.user.name} imageUrl={avatarUrl} size="sm" />
        <span className="hidden text-sm normal-case text-dusk-100 sm:inline">
          {session.user.name}
        </span>
      </Link>
      <button
        onClick={async () => {
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        }}
        className="text-[0.68rem] uppercase tracking-[0.18em] text-dusk-300 transition-colors hover:text-dusk-100"
      >
        Çıkış
      </button>
    </span>
  );
}
