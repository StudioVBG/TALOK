import { Skeleton } from "@/components/ui/skeleton";

export function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-2 text-right">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  );
}

export function InvoiceListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <InvoiceRowSkeleton key={i} />
      ))}
    </div>
  );
}

