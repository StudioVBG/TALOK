import { Skeleton } from "@/components/ui/skeleton";

export default function InspectionDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Breadcrumb skeleton */}
      <div className="container mx-auto px-4 pt-4">
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Header skeleton */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
