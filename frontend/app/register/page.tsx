"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Field from "@/app/components/Field";
import AuthShell from "@/app/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message?.includes("exist")
          ? "Bu e-posta ile zaten bir hesap var."
          : error.message ?? "Kayıt olunamadı."
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <p className="font-display text-lg font-semibold tracking-[0.2em] text-amber-glow sm:hidden">
        LOKÁL
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-dusk-100 sm:mt-0">
        Aramıza katıl
      </h1>
      <p className="mt-1 text-sm text-dusk-300">
        Ücretsiz hesap oluştur, şehri keşfetmeye başla
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field
          label="İsim"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
        <Field
          label="E-posta"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="Şifre (en az 8 karakter)"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name || !email || !password}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {loading ? "kayıt olunuyor…" : "Hesap oluştur"}
        </button>
      </form>

      <p className="mt-6 border-t border-dusk-700/60 pt-4 text-center text-sm text-dusk-200">
        Zaten hesabın var mı?{" "}
        <Link
          href="/login"
          className="font-semibold text-amber-glow hover:underline"
        >
          Giriş yap
        </Link>
      </p>
    </AuthShell>
  );
}
