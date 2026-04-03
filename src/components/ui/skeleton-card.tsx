export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-muted mb-4" />
      <div className="h-3 w-full rounded bg-muted mb-2" />
      <div className="h-3 w-4/5 rounded bg-muted" />
    </div>
  );
}
