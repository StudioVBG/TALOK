import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-in fade-in duration-500">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
