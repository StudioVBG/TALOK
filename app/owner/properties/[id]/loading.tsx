import { Skeleton } from "@/components/ui/skeleton";

export default function PropertyDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-64 mb-4" />

      {/* Header skeleton */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-10 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Photo hero skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[450px] mb-8">
        <Skeleton className="col-span-1 md:col-span-3 rounded-2xl" />
        <div className="hidden md:flex flex-col gap-4">
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
