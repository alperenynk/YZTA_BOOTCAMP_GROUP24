import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { sendEmail } from "@/lib/email";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "lokal.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const auth = betterAuth({
  database: new Database(DB_PATH),
  emailAndPassword: {
    enabled: true,
    // MVP: e-posta doğrulaması yok — mail servisi gerekmesin
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Lokál — şifre sıfırlama",
        html: `<p>Merhaba ${user.name || ""},</p>
<p>Şifreni sıfırlamak için <a href="${url}">buraya tıkla</a>. Bağlantı 1 saat geçerlidir.</p>
<p>Bu isteği sen yapmadıysan bu maili yok sayabilirsin.</p>`,
      });
    },
  },
});
