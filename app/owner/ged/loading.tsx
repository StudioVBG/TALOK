import { Skeleton } from "@/components/ui/skeleton";

export default function GedLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Alerts panel */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Tabs */}
      <Skeleton className="h-10 w-80" />

      {/* Content */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-6 w-56" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
