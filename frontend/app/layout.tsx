import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import AuthNav from "./components/AuthNav";
import ThemeToggle from "./components/ThemeToggle";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Lokál — Bugün Ne Yapsak?",
  description:
    "Ruh haline, konumuna ve bütçene göre 4 katmanlı deneyim önerisi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Tema tercihini ilk boyamadan önce uygula — varsayılan: krem (gündüz) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("lokal-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
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
                href="/"
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
                <ThemeToggle />
              </span>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          {children}
        </main>
        <footer className="border-t border-dusk-700/60 py-6 text-center font-mono text-xs text-dusk-300">
          LOKÁL · şehri hisset, anı yaşa
        </footer>
      </body>
    </html>
  );
}
