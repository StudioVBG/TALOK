// @ts-nocheck
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-56 mt-2" />
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-12 w-36" />
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-16 mt-1" />
                </div>
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

