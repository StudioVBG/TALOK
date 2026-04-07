import { Suspense } from "react";
import AccountingDashboard from "./AccountingDashboard";

export const metadata = { title: "Comptabilite | Talok" };

export default function AccountingPage() {
  return (
    <Suspense fallback={<AccountingDashboardSkeleton />}>
      <AccountingDashboard />
    </Suspense>
  );
}

function AccountingDashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
