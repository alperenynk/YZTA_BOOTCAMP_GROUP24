import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import AppShell from "./components/AppShell";
import Toaster from "./components/Toaster";
import DialogHost from "./components/DialogHost";
import CommandPalette from "./components/CommandPalette";
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
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#14110c",
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
        {/* Tema tercihini ilk boyamadan önce uygula — varsayılan: landing ile aynı koyu */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("lokal-theme");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){document.documentElement.classList.add("dark")};
if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(function(){})}`,
          }}
        />
        <AppShell>{children}</AppShell>
        <Toaster />
        <DialogHost />
        <CommandPalette />
      </body>
    </html>
  );
}
