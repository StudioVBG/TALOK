import { Skeleton } from "@/components/ui/skeleton";

interface DashboardLoadingProps {
  variant?: "dashboard" | "list" | "detail" | "form";
}

export default function DashboardLoading({ variant = "dashboard" }: DashboardLoadingProps) {
  if (variant === "list") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
        <Skeleton className="h-9 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    );
  }

  // Default: dashboard variant
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
