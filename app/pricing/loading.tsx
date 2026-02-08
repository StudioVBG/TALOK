import { Skeleton } from "@/components/ui/skeleton";

export default function PricingLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="h-12 w-80 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
      </div>

      {/* Pricing cards skeleton */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 border rounded-2xl space-y-6">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-12 w-32" />
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
