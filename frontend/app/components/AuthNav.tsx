"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

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
    <span className="flex items-center gap-3">
      <span className="text-dusk-200">{session.user.name}</span>
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
