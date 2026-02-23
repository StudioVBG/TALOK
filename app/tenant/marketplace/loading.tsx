import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>

      {/* Filter buttons skeleton */}
      <div className="flex flex-wrap gap-3 mb-8">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-xl" />
        ))}
      </div>

      {/* 2x2 grid of offer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="flex items-start gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
