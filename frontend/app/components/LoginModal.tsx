"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Field from "@/app/components/Field";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.status === 401 || error.status === 403
          ? "E-posta veya şifre hatalı."
          : error.message ?? "Giriş yapılamadı."
      );
      return;
    }
    onClose(); // useSession otomatik güncellenir
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-dusk-700/60 bg-dusk-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* yeşil marka şeridi */}
        <div className="brand-panel relative px-6 py-6 text-center">
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-4 top-3 text-white/70 hover:text-white"
          >
            ✕
          </button>
          <p className="font-display text-xl font-semibold tracking-[0.3em]">
            LOKÁL
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.25em] opacity-80">
            ŞEHRİ HİSSET, ANI YAŞA
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-dusk-100">
              Tekrar hoş geldin
            </h2>
            <p className="mt-0.5 text-sm text-dusk-300">
              Devam etmek için giriş yap
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="E-posta"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              label="Şifre"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {loading ? "giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>

          <p className="border-t border-dusk-700/60 pt-3 text-center text-sm text-dusk-200">
            Hesabın yok mu?{" "}
            <Link
              href="/register"
              className="font-semibold text-amber-glow hover:underline"
            >
              Kayıt ol
            </Link>
            {" · "}
            <Link
              href="/forgot-password"
              className="text-dusk-300 hover:text-teal-glow"
            >
              Şifremi unuttum
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
