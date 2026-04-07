import { Suspense } from "react";
import ReconciliationClient from "./ReconciliationClient";

export const metadata = { title: "Rapprochement bancaire | Talok" };

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<ReconciliationSkeleton />}>
      <ReconciliationClient />
    </Suspense>
  );
}

function ReconciliationSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded-lg" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
