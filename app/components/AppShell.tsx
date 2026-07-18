"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNav from "./AuthNav";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/kesfet", label: "Keşfet" },
  { href: "/feed", label: "Akış" },
  { href: "/profile", label: "Profil" },
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="app-grain" aria-hidden="true" />

      <header className="app-nav">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="app-nav-logo">
            Lokál
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1 sm:gap-2">
              {NAV.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`app-nav-link${active ? " is-active" : ""}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <AuthNav />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </header>

      <main
        key={pathname}
        className="app-page-enter relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-10 lg:px-8"
      >
        {children}
      </main>

      <footer className="relative z-10 border-t border-dusk-700/60 py-6 text-center text-[0.68rem] uppercase tracking-[0.24em] text-dusk-300">
        Lokál · şehri hisset, anı yaşa ·{" "}
        <Link href="/privacy" className="transition-colors hover:text-dusk-100">
          gizlilik
        </Link>
      </footer>
    </div>
  );
}
