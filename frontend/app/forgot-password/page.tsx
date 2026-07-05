"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import Field from "@/app/components/Field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    setSent(true); // güvenlik gereği her durumda aynı mesaj
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="font-display text-3xl font-semibold text-dusk-100">
        Şifremi unuttum
      </h1>
      {sent ? (
        <p className="rounded-xl border border-teal-glow/40 bg-teal-glow/5 p-4 text-sm text-dusk-100">
          Bu e-posta sistemde kayıtlıysa bir sıfırlama bağlantısı gönderdik.
          Gelen kutunu (ve spam klasörünü) kontrol et.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Kayıtlı e-postan"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {loading ? "gönderiliyor…" : "sıfırlama bağlantısı gönder"}
          </button>
        </form>
      )}
      <p className="text-center text-sm text-dusk-200">
        <Link href="/login" className="text-teal-glow hover:underline">
          Girişe dön
        </Link>
      </p>
    </div>
  );
}
