// @ts-nocheck
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaseLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>

      {/* Property Card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-24 w-32 rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Lease Details */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-28 mb-4" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-2 w-full mt-2" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

