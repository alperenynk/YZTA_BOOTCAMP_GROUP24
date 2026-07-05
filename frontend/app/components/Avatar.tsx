"use client";

export default function Avatar({
  name,
  imageUrl = null,
  size = "md",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "md" | "xl";
}) {
  const cls =
    size === "xl"
      ? "h-28 w-28 text-3xl border-4 border-dusk-900"
      : "h-10 w-10 text-sm";

  if (imageUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imageUrl}
        alt={name}
        className={`${cls} shrink-0 rounded-full object-cover`}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr");

  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-glow to-teal-glow font-display font-semibold text-dusk-900`}
    >
      {initials}
    </div>
  );
}
