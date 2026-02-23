import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-in fade-in duration-500">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>

      {/* Hero banner skeleton */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 md:p-12 mb-8">
        <div className="grid md:grid-cols-2 gap-6 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <Skeleton className="h-4 w-32 bg-white/20" />
            <Skeleton className="h-16 md:h-24 w-64 bg-white/20" />
            <Skeleton className="h-4 w-full max-w-sm bg-white/20" />
            <Skeleton className="h-12 w-48 bg-white/20 rounded-2xl" />
          </div>
          <div className="hidden md:flex justify-center">
            <Skeleton className="h-48 w-48 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* History list skeleton - 7/12 */}
        <div className="lg:col-span-7 space-y-6">
          <Skeleton className="h-6 w-48" />
          <div className="rounded-xl border bg-card p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How to earn points - 5/12 */}
        <div className="lg:col-span-5 space-y-6">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
