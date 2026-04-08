import { Suspense } from "react";
import BudgetClient from "./BudgetClient";

export const metadata = { title: "Budget copropriete | Talok" };

export default function BudgetPage() {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <BudgetClient />
    </Suspense>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="h-10 bg-muted rounded-lg w-64" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
