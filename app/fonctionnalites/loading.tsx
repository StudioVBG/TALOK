import { Skeleton } from "@/components/ui/skeleton";

export default function FeaturesLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="h-12 w-96 mx-auto mb-4" />
          <Skeleton className="h-6 w-[500px] mx-auto" />
        </div>
      </div>

      {/* Features grid skeleton */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
