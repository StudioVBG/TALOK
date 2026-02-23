import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-in fade-in duration-500">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6">
        <div className="flex gap-2 border-b">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 mb-[-1px]" />
          ))}
        </div>
      </div>

      {/* Roommates grid skeleton */}
      <div className="mb-8">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 text-center">
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-3" />
              <Skeleton className="h-4 w-24 mx-auto mb-2" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Expense table skeleton */}
      <div className="rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
