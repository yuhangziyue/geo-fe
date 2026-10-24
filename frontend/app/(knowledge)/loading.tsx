// Shown while a dynamic Knowledge Center page (product list with filters, admin) renders on the server.
export default function KnowledgeLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-8 w-1/3 rounded bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
