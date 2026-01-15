// @ts-nocheck
import { Skeleton } from "@/components/ui/skeleton";

export default function MoneyLoading() {
  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-3 w-24 mt-2" />
        </div>
        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-3 w-20 mt-2" />
        </div>
        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-3 w-28 mt-2" />
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

