"use client";

// Rota seviyesinde hata sınırı: bir sayfa çökerse uygulama değil, sadece o görünüm düşer
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl">🍂</p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-dusk-100">
        Bir şeyler ters gitti
      </h1>
      <p className="mt-2 text-sm text-dusk-200">
        Endişelenme, planların güvende. Bir daha deneyelim mi?
      </p>
      <button onClick={reset} className="btn-primary mt-5 px-6 py-2 text-sm">
        tekrar dene
      </button>
    </div>
  );
}
