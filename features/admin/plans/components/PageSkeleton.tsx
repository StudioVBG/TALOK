/**
 * PageSkeleton component for Admin Plans loading state
 * Extracted from app/admin/plans/page.tsx
 */

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border bg-card p-6"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-10 w-full rounded bg-muted/40 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded bg-muted/30 animate-pulse" />
                <div className="h-6 w-24 rounded bg-muted/30 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
