// @ts-nocheck
import { Skeleton } from "@/components/ui/skeleton";

export default function TenantDashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne Gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mon logement Card */}
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-5 w-28 bg-white/20" />
                <Skeleton className="h-8 w-64 bg-white/20" />
                <Skeleton className="h-4 w-48 bg-white/20" />
              </div>
              <Skeleton className="h-16 w-16 rounded-lg bg-white/20" />
            </div>
            <div className="mt-6 pt-6 border-t border-white/20 flex justify-between items-center">
              <div>
                <Skeleton className="h-3 w-20 bg-white/20" />
                <Skeleton className="h-7 w-28 mt-1 bg-white/20" />
              </div>
              <Skeleton className="h-9 w-28 bg-white/30 rounded-md" />
            </div>
          </div>

          {/* Factures */}
          <div className="rounded-xl border bg-card">
            <div className="p-4 border-b flex justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="p-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div>
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-20 mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Droite */}
        <div className="space-y-6">
          {/* Gestionnaire */}
          <div className="rounded-xl border bg-card p-4">
            <Skeleton className="h-6 w-36 mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-20 mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>

          {/* Demandes */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-12" />
            </div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

