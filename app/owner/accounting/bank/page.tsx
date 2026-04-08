import { Suspense } from "react";
import BankAccountsClient from "./BankAccountsClient";

export const metadata = { title: "Comptes bancaires | Talok" };

export default function BankAccountsPage() {
  return (
    <Suspense fallback={<BankAccountsSkeleton />}>
      <BankAccountsClient />
    </Suspense>
  );
}

function BankAccountsSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-28 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-12 bg-muted rounded-xl" />
    </div>
  );
}
