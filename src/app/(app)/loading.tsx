export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-3 w-24 rounded-sm bg-muted" />
      <div className="h-8 w-2/3 max-w-md rounded-sm bg-muted" />
      <div className="h-4 w-full max-w-xl rounded-sm bg-muted" />
      <div className="mt-6 h-40 rounded-md border bg-card" />
      <div className="h-28 rounded-md border bg-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
