import { Suspense } from "react";
import ExportsPageClient from "./ExportsPageClient";

export const metadata = { title: "Exports comptables | Talok" };

export default function ExportsPage() {
  return (
    <Suspense fallback={<ExportsSkeleton />}>
      <ExportsPageClient />
    </Suspense>
  );
}

function ExportsSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-10 bg-muted rounded w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
