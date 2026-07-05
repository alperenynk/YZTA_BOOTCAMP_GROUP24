"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Field from "@/app/components/Field";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        Geçersiz veya eksik sıfırlama bağlantısı. Lütfen e-postandaki bağlantıyı
        kullan.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    setLoading(false);
    if (error) {
      setError("Bağlantı geçersiz ya da süresi dolmuş. Yeni bağlantı iste.");
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Yeni şifre (en az 8 karakter)"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="btn-primary w-full py-2.5 text-sm"
      >
        {loading ? "kaydediliyor…" : "şifreyi güncelle"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="font-display text-3xl font-semibold text-dusk-100">
        Yeni şifre belirle
      </h1>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
