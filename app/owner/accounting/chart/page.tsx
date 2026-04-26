import { Suspense } from "react";
import ChartPageClient from "./ChartPageClient";

export const metadata = { title: "Plan comptable | Talok" };

export default function ChartPage() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartPageClient />
    </Suspense>
  );
}

function ChartSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}
