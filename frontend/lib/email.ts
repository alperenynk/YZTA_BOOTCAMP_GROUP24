/**
 * E-posta gönderimi — Resend (https://resend.com, ücretsiz katman).
 * RESEND_API_KEY yoksa mail konsola yazılır (geliştirme modu).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.trim() || key.startsWith("your-")) {
    console.log(
      `\n📧 [MOCK E-POSTA] Kime: ${opts.to}\nKonu: ${opts.subject}\n${opts.html.replace(/<[^>]+>/g, "")}\n`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Lokál <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    console.error("Resend hatası:", res.status, await res.text());
  }
}
