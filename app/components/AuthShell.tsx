"use client";

/** Giriş/kayıt ekranları için iki panelli kabuk: solda marka, sağda form */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-3xl overflow-hidden rounded-3xl border border-dusk-700/60 bg-dusk-900 shadow-lg sm:grid-cols-2">
      {/* Sol: marka paneli */}
      <div className="brand-panel relative hidden flex-col items-center justify-center p-10 sm:flex">
        {/* dekoratif daireler */}
        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute right-10 top-16 h-4 w-4 rounded-full bg-white/25" />
        <div className="absolute left-12 bottom-24 h-2.5 w-2.5 rounded-full bg-white/25" />

        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-white/10">
          <span className="text-6xl">🧭</span>
        </div>
        <p className="mt-8 font-display text-3xl font-semibold tracking-[0.25em]">
          LOKÁL
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.3em] opacity-85">
          ŞEHRİ HİSSET, ANI YAŞA
        </p>
        <p className="mt-6 max-w-[220px] text-center text-sm leading-relaxed opacity-80">
          Ruh haline, konumuna ve bütçene göre sana özel deneyimler.
        </p>
      </div>

      {/* Sağ: form */}
      <div className="p-8 sm:p-10">{children}</div>
    </div>
  );
}
