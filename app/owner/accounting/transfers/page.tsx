import { Suspense } from "react";
import TransfersPageClient from "./TransfersPageClient";

export const metadata = { title: "Virements internes | Talok" };

export default function TransfersPage() {
  return (
    <Suspense fallback={<TransfersSkeleton />}>
      <TransfersPageClient />
    </Suspense>
  );
}

function TransfersSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}
