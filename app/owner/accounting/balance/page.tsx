import { Suspense } from "react";
import BalancePageClient from "./BalancePageClient";

export const metadata = { title: "Balance | Talok" };

export default function BalancePage() {
  return (
    <Suspense fallback={<BalanceSkeleton />}>
      <BalancePageClient />
    </Suspense>
  );
}

function BalanceSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}
