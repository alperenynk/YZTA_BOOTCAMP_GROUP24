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
  const [consent, setConsent] = useState(false);
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
    router.push("/kesfet");
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
        <label className="flex cursor-pointer items-start gap-2 text-xs text-dusk-200">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-0.5 accent-amber-glow"
          />
          <span>
            <Link
              href="/privacy"
              target="_blank"
              className="text-teal-glow hover:underline"
            >
              Gizlilik Politikası ve KVKK Aydınlatma Metni
            </Link>
            &apos;ni okudum, kabul ediyorum.
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name || !email || !password || !consent}
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
