"use client";

export default function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="app-eyebrow mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-2xl border border-dusk-700 bg-dusk-900/80 p-3.5 text-dusk-100 placeholder:text-dusk-300 focus:border-amber-glow focus:outline-none"
      />
    </label>
  );
}
