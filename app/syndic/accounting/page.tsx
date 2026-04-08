import { Suspense } from "react";
import SyndicDashboardClient from "./SyndicDashboardClient";

export const metadata = { title: "Comptabilite Syndic | Talok" };

export default function SyndicAccountingPage() {
  return (
    <Suspense fallback={<SyndicDashboardSkeleton />}>
      <SyndicDashboardClient />
    </Suspense>
  );
}

function SyndicDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-10 bg-muted rounded-lg w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-muted rounded-xl" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
