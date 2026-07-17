"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNav from "./AuthNav";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="border-b border-dusk-700/60">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-display text-2xl font-semibold tracking-tight text-amber-glow"
          >
            Lokál
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-dusk-200 sm:gap-2">
            <Link
              href="/kesfet"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-dusk-800 hover:text-dusk-100"
            >
              Keşfet
            </Link>
            <Link
              href="/feed"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-dusk-800 hover:text-dusk-100"
            >
              Akış
            </Link>
            <Link
              href="/profile"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-dusk-800 hover:text-dusk-100"
            >
              Profil
            </Link>
            <span className="ml-2 flex items-center gap-3">
              <AuthNav />
              <NotificationBell />
              <ThemeToggle />
            </span>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-dusk-700/60 py-6 text-center font-mono text-xs text-dusk-300">
        LOKÁL · şehri hisset, anı yaşa ·{" "}
        <Link href="/privacy" className="hover:text-dusk-100">
          gizlilik
        </Link>
      </footer>
    </>
  );
}
