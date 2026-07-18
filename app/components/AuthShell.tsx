"use client";

/** Giriş/kayıt ekranları — landing ile aynı cam panel estetiği */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-panel mx-auto grid max-w-3xl overflow-hidden sm:grid-cols-2">
      <div className="brand-panel relative hidden flex-col items-center justify-center p-10 sm:flex">
        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-[rgba(143,191,127,0.08)]" />
        <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-[rgba(180,216,166,0.06)]" />
        <div className="absolute right-10 top-16 h-4 w-4 rounded-full bg-[rgba(239,231,214,0.15)]" />
        <div className="absolute bottom-24 left-12 h-2.5 w-2.5 rounded-full bg-[rgba(239,231,214,0.15)]" />

        <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-[rgba(239,231,214,0.12)] bg-[rgba(239,231,214,0.06)]">
          <span className="text-6xl">🧭</span>
        </div>
        <p className="mt-8 font-display text-3xl font-semibold tracking-[0.25em]">
          LOKÁL
        </p>
        <p className="mt-2 text-[0.68rem] uppercase tracking-[0.3em] opacity-85">
          ŞEHRİ HİSSET, ANI YAŞA
        </p>
        <p className="mt-6 max-w-[220px] text-center text-sm leading-relaxed opacity-80">
          Ruh haline, konumuna ve bütçene göre sana özel deneyimler.
        </p>
      </div>

      <div className="p-8 sm:p-10">{children}</div>
    </div>
  );
}
