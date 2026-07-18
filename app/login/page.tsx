"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Field from "@/app/components/Field";
import AuthShell from "@/app/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
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
    router.push("/kesfet");
    router.refresh();
  }

  return (
    <AuthShell>
      <p className="font-display text-lg font-semibold tracking-[0.2em] text-amber-glow sm:hidden">
        LOKÁL
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-dusk-100 sm:mt-0">
        Tekrar hoş geldin
      </h1>
      <p className="mt-1 text-sm text-dusk-300">Hesabına giriş yap</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        <p className="text-right text-xs">
          <Link
            href="/forgot-password"
            className="text-dusk-300 hover:text-teal-glow"
          >
            Şifreni mi unuttun?
          </Link>
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {loading ? "giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>

      <p className="mt-6 border-t border-dusk-700/60 pt-4 text-center text-sm text-dusk-200">
        Hesabın yok mu?{" "}
        <Link
          href="/register"
          className="font-semibold text-amber-glow hover:underline"
        >
          Kayıt ol
        </Link>
      </p>
    </AuthShell>
  );
}
