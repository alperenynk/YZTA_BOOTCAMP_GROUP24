// Rota geçişlerinde anlık iskelet — boş beyaz ekran yerine
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="skeleton mx-auto h-8 w-64 rounded-full" />
      <div className="skeleton h-28 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
      </div>
    </div>
  );
}
