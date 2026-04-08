import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { FinancesDashboardClient } from "./FinancesDashboardClient";

export const metadata = {
  title: "Finances — Talok",
  description: "Dashboard financier : revenus, factures, dépôts de garantie",
};

export default function OwnerFinancesPage() {
  return (
    <PullToRefreshContainer>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        }
      >
        <FinancesDashboardClient />
      </Suspense>
    </PullToRefreshContainer>
  );
}
