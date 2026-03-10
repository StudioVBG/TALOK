import { Suspense } from "react";
import { getOwnerInvoices } from "@/features/billing/server/data-fetching";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { FinancesClient } from "./FinancesClient";

// Server Component (Async) — SOTA 2026 : Page Finances unifiée
export default async function OwnerMoneyPage() {
  const invoices = await getOwnerInvoices();

  return (
    <PullToRefreshContainer>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        }
      >
        <FinancesClient invoices={invoices as any} />
      </Suspense>
    </PullToRefreshContainer>
  );
}
