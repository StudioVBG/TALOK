import { Skeleton } from "@/components/ui/skeleton";

export default function TicketDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6 animate-in fade-in duration-500">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-3/4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
